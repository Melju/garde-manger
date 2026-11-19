// Fonction du NAS (edge function « alexa ») : point d'entrée de la skill Alexa « Miam miam ».
// Source de supabase/functions/alexa/index.ts (généré par `npm run build:alexa`, ne pas éditer le fichier généré).
// Elle tourne sur le NAS pour garder les secrets (signature des sessions) là où ils sont déjà.
//
// 1. Vérifie que la requête vient bien d'Amazon (signature, certificat, horodatage, identifiant de skill).
// 2. Retrouve le membre du foyer associé au compte Alexa (code d'association saisi dans l'app).
// 3. Envoie la phrase à la fonction « voice » du NAS, au nom de ce membre (quota IA du foyer).
// 4. Applique les actions sur le stock et la liste de courses, puis répond à voix haute.
import { X509Certificate, createHmac, verify as cryptoVerify, randomUUID } from 'node:crypto'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SupabaseRepository } from '../src/data/supabaseRepository'
import { consumeAmount, parseContenance } from '../src/lib/contenance'
import { openShelfDays } from '../src/lib/openShelf'
import { defaultConservation, type Category, type Product } from '../src/types'

declare const Deno: any
const env = (k: string) => Deno.env.get(k) ?? ''

// ---------- Vérification Amazon ----------
const certCache = new Map<string, { pem: string; at: number }>()

function validCertUrl(u: string): boolean {
  try {
    const url = new URL(u)
    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 's3.amazonaws.com' &&
      (url.port === '' || url.port === '443') &&
      url.pathname.startsWith('/echo.api/') &&
      !url.pathname.includes('/../')
    )
  } catch {
    return false
  }
}

async function verifyAmazon(req: Request, raw: string): Promise<string | null> {
  const certUrl = req.headers.get('signaturecertchainurl') ?? ''
  const sig = req.headers.get('signature-256') ?? ''
  if (!certUrl || !sig) return 'en-têtes de signature absents'
  if (!validCertUrl(certUrl)) return 'URL de certificat invalide'
  let pem = certCache.get(certUrl)
  if (!pem || Date.now() - pem.at > 3600_000) {
    const r = await fetch(certUrl)
    if (!r.ok) return 'certificat introuvable'
    pem = { pem: await r.text(), at: Date.now() }
    certCache.set(certUrl, pem)
  }
  const parts = pem.pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []
  if (!parts.length) return 'certificat vide'
  const chain = parts.map((p) => new X509Certificate(p))
  const leaf = chain[0]
  const now = Date.now()
  if (now < Date.parse(leaf.validFrom) || now > Date.parse(leaf.validTo)) return 'certificat expiré'
  const san = (leaf as any).subjectAltName as string | undefined
  const hostOk = san ? san.includes('echo-api.amazon.com') : !!(leaf as any).checkHost?.('echo-api.amazon.com')
  if (!hostOk) return 'certificat non Amazon'
  for (let i = 0; i < chain.length - 1; i++) if (!chain[i].verify(chain[i + 1].publicKey)) return 'chaîne de certificats invalide'
  const ok = cryptoVerify('sha256', new TextEncoder().encode(raw), leaf.publicKey, Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)))
  return ok ? null : 'signature invalide'
}

// ---------- Réponses Alexa ----------
const esc = (t: string) => t.replace(/&/g, 'et').replace(/[<>]/g, '')
function say(text: string, opts: { end?: boolean; reprompt?: string; attrs?: Record<string, unknown>; card?: string } = {}) {
  return {
    version: '1.0',
    sessionAttributes: opts.attrs ?? {},
    response: {
      outputSpeech: { type: 'SSML', ssml: `<speak>${esc(text)}</speak>` },
      ...(opts.reprompt ? { reprompt: { outputSpeech: { type: 'PlainText', text: opts.reprompt } } } : {}),
      ...(opts.card ? { card: { type: 'Simple', title: 'Miam miam', content: opts.card } } : {}),
      shouldEndSession: opts.end ?? true,
    },
  }
}

// ---------- Supabase ----------
// Le secret partagé est relu dans la base (table push_config) avec la clé de service, disponible sur le NAS.
let pushSecret = ''
async function secret() {
  if (pushSecret) return pushSecret
  const k = env('SUPABASE_SERVICE_ROLE_KEY')
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/push_config?key=eq.secret&select=value`, {
    headers: { apikey: k, authorization: `Bearer ${k}` },
  })
  pushSecret = ((await r.json()) as { value: string }[])[0]?.value ?? ''
  return pushSecret
}
/** Identifiant de la skill (table push_config, clé alexa_skill_id) : refuse les autres skills. */
let skillId: string | null = null
async function allowedSkill() {
  if (skillId !== null) return skillId
  const k = env('SUPABASE_SERVICE_ROLE_KEY')
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/push_config?key=eq.alexa_skill_id&select=value`, {
    headers: { apikey: k, authorization: `Bearer ${k}` },
  })
  skillId = ((await r.json()) as { value: string }[])[0]?.value ?? ''
  return skillId
}
async function rpc(name: string, args: Record<string, unknown>) {
  const base = env('SUPABASE_URL')
  const anon = env('SUPABASE_ANON_KEY')
  const r = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: anon, authorization: `Bearer ${anon}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_secret: await secret(), ...args }),
  })
  if (!r.ok) throw new Error(`${name} ${r.status}`)
  return r.json()
}

/** Jeton de session court (5 min) au nom du membre associé : la sécurité par foyer (RLS) s'applique. */
function userJwt(userId: string) {
  const b64 = (o: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  const now = Math.floor(Date.now() / 1000)
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ sub: userId, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 300 })
  const s = createHmac('sha256', env('JWT_SECRET')).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${s}`
}

const toBase = (v: number, u: string) => {
  const l = u.toLowerCase()
  return l === 'kg' || l === 'l' ? v * 1000 : l === 'cl' ? v * 10 : v
}
const baseUnit = (u: string) => {
  const l = u.toLowerCase()
  return l === 'kg' || l === 'g' ? 'g' : l === 'l' || l === 'cl' || l === 'ml' ? 'mL' : ''
}

type Undo =
  | { t: 'shop_del'; ids: string[] }
  | { t: 'shop_add'; item: { name: string; category: string; quantity: number; unit?: string } }
  | { t: 'prod_del'; id: string }
  | { t: 'prod_restore'; snap: Product }

async function handleCommand(text: string, link: { user_id: string; household_id: string; name: string }, alexaUser: string) {
  const jwt = userJwt(link.user_id)
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const repo = new SupabaseRepository(sb as any, link.household_id)
  const [products, shopping] = await Promise.all([repo.listProducts(), repo.listShopping()])

  // Compréhension : la même fonction que l'assistant vocal de l'app.
  const r = await fetch(`${env('SUPABASE_URL')}/functions/v1/voice`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_ANON_KEY'), authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      stock: products.slice(0, 400).map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand || undefined,
        qty: p.quantity,
        size: p.size || undefined,
        opened: !!p.openedAt || undefined,
        exp: p.expiryDate || undefined,
        place: p.location || undefined,
      })),
      shopping: shopping
        .filter((s) => !s.checked)
        .map((s) => ({ id: s.id, name: s.name, qty: s.unit ? `${s.quantity} ${s.unit}` : `×${s.quantity}` })),
    }),
  })
  const data: any = await r.json().catch(() => ({}))
  if (!r.ok) return say(data?.error ? `Désolé, ${data.error}` : 'Désolé, je n’ai pas pu comprendre pour l’instant.')
  const reply: string = data.reply || ''
  const actions: any[] = Array.isArray(data.actions) ? data.actions : []
  if (!actions.length) return say(reply || 'Je n’ai pas compris. Tu peux reformuler ?', { end: false, reprompt: 'Que veux-tu faire ?' })

  const ask = actions.find((a) => a.type === 'ask')
  if (ask) {
    // Choix à faire : Alexa pose la question, la réponse revient dans la même session.
    const names = (ask.options as { id: string; label: string }[]).map((o) => o.label).join(', ou ')
    return say(`${ask.question} ${names} ?`, {
      end: false,
      reprompt: ask.question,
      attrs: { pending: ask },
    })
  }

  const undo: Undo[] = []
  for (const a of actions) {
    try {
      await applyOne(a, repo, sb, products, shopping, undo)
    } catch {
      /* une action ratée n'empêche pas les autres */
    }
  }
  await rpc('alexa_set_undo', { p_alexa: alexaUser, p_undo: { at: Date.now(), ops: undo } }).catch(() => {})
  return say(reply || 'C’est fait.', { card: actions.map((a) => a.label).join('\n') })
}

async function logHistory(sb: any, hid: string, kind: string, label: string, meta: Record<string, unknown>) {
  const now = new Date()
  await sb.from('history').insert({
    id: randomUUID(),
    household_id: hid,
    entry_date: now.toISOString().slice(0, 10),
    at: now.toISOString(),
    kind,
    label,
    meta,
  })
}

async function applyOne(a: any, repo: SupabaseRepository, sb: any, products: Product[], shopping: any[], undo: Undo[]) {
  const hid = (repo as any).householdId as string
  if (a.type === 'shop_add') {
    const unit = baseUnit(a.unit || '')
    const quantity = a.unit ? Math.round(toBase(a.quantity, a.unit)) : Math.max(1, Math.round(a.quantity))
    const it = await repo.addShoppingItem({ name: a.name, category: a.category, quantity, unit: unit || undefined, source: 'manuel' })
    undo.push({ t: 'shop_del', ids: [it.id] })
    return
  }
  if (a.type === 'shop_remove') {
    const it = shopping.find((s) => s.id === a.id)
    if (!it) return
    await repo.removeShoppingItem(it.id)
    undo.push({ t: 'shop_add', item: { name: it.name, category: it.category, quantity: it.quantity, unit: it.unit } })
    return
  }
  if (a.type === 'stock_add') {
    const withSize = !!a.unit
    const p = await repo.addProduct({
      name: a.name,
      category: a.category as Category,
      quantity: withSize ? 1 : Math.max(1, Math.round(a.quantity)),
      size: withSize ? `${a.quantity} ${a.unit}` : undefined,
      conservation: defaultConservation(a.category as Category),
    } as any)
    undo.push({ t: 'prod_del', id: p.id })
    return
  }
  const p = products.find((x) => x.id === a.id)
  if (!p) return
  undo.push({ t: 'prod_restore', snap: { ...p } })
  const meta = { name: p.name, category: p.category, conservation: p.conservation }
  if (a.type === 'stock_finish') {
    await repo.removeProduct(p.id)
    await logHistory(sb, hid, 'consomme', `${p.name} consommé (×${p.quantity})`, { ...meta, qty: p.quantity })
    return
  }
  if (a.type === 'stock_waste') {
    await repo.removeProduct(p.id)
    await logHistory(sb, hid, 'jete', `${p.name} jeté (périmé)`, { ...meta, qty: p.quantity })
    return
  }
  if (a.type === 'stock_open') {
    const days = openShelfDays(p.name, p.category).days
    const exp = new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10)
    const keep = p.expiryDate && p.expiryDate < exp ? p.expiryDate : exp
    await repo.updateProduct(p.id, { openedAt: new Date().toISOString(), expiryDate: keep })
    return
  }
  if (a.type === 'stock_remove') {
    const parsed = parseContenance(p.size)
    if (!a.unit || !parsed) {
      const n = Math.min(a.unit ? 1 : Math.max(1, Math.round(a.amount)), p.quantity)
      await repo.adjustQuantity(p.id, -n)
      await logHistory(sb, hid, 'consomme', `${p.name} consommé (×${n})`, { ...meta, qty: n })
      return
    }
    const newSize = consumeAmount(p.size!, a.amount, a.unit)
    if (newSize === null) {
      await repo.adjustQuantity(p.id, -1)
      await logHistory(sb, hid, 'consomme', `${p.name} consommé (×1)`, { ...meta, qty: 1 })
      return
    }
    if (p.quantity > 1) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = p as any
      await repo.updateProduct(p.id, { quantity: p.quantity - 1 })
      const np = await repo.addProduct({ ...rest, quantity: 1, size: newSize })
      undo.push({ t: 'prod_del', id: np.id })
      return
    }
    await repo.updateProduct(p.id, { size: newSize })
  }
}

async function handleUndo(link: { user_id: string; household_id: string; last_undo?: any }, alexaUser: string) {
  const u = link.last_undo
  if (!u?.ops?.length || Date.now() - (u.at ?? 0) > 3600_000) return say('Il n’y a rien à annuler.')
  const jwt = userJwt(link.user_id)
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const repo = new SupabaseRepository(sb as any, link.household_id)
  const products = await repo.listProducts()
  for (const op of [...(u.ops as Undo[])].reverse()) {
    try {
      if (op.t === 'shop_del') for (const id of op.ids) await repo.removeShoppingItem(id)
      else if (op.t === 'shop_add') await repo.addShoppingItem({ ...op.item, category: op.item.category as Category, source: 'manuel' })
      else if (op.t === 'prod_del') await repo.removeProduct(op.id)
      else if (op.t === 'prod_restore') {
        const { id, createdAt: _c, updatedAt: _u, ...rest } = op.snap as any
        if (products.some((p) => p.id === id)) await repo.updateProduct(id, rest)
        else await repo.addProduct(rest)
      }
    } catch {
      /* au mieux */
    }
  }
  await rpc('alexa_set_undo', { p_alexa: alexaUser, p_undo: null }).catch(() => {})
  return say('C’est annulé, tout est revenu comme avant.')
}

// ---------- Point d'entrée ----------
const VERBS: Record<string, string> = {
  AjouterIntent: 'ajoute',
  EnleverIntent: 'enlève',
  JaiIntent: 'j’ai',
  QuestionIntent: '',
  CommandeIntent: '',
}

const out = (status: number, o: unknown) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json;charset=UTF-8' } })

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return out(405, { error: 'méthode' })
  const raw = await req.text()
  const bad = await verifyAmazon(req, raw).catch((e) => String(e))
  if (bad) return out(400, { error: bad })
  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return out(400, { error: 'json' })
  }
  const ts = Date.parse(body?.request?.timestamp ?? '')
  if (!ts || Math.abs(Date.now() - ts) > 150_000) return out(400, { error: 'horodatage' })
  const appId = body?.session?.application?.applicationId ?? body?.context?.System?.application?.applicationId
  const want = await allowedSkill()
  if (want && appId !== want) return out(400, { error: 'skill inconnue' })

  const send = (o: unknown) => out(200, o)
  const rq = body.request ?? {}
  const alexaUser: string = body?.session?.user?.userId ?? body?.context?.System?.user?.userId ?? ''
  try {
    if (rq.type === 'SessionEndedRequest') return send({ version: '1.0', response: {} })
    const intent: string = rq.intent?.name ?? ''

    // Association : n'importe qui peut demander un code, il ne sert qu'une fois et 10 minutes.
    if (intent === 'AssocierIntent') {
      const code: string = await rpc('alexa_new_code', { p_alexa: alexaUser })
      const spaced = code.split('').join(' ')
      return send(
        say(`Voici ton code : ${spaced}. Je répète : ${spaced}. Saisis-le dans l’app Miam miam, dans Paramètres, rubrique Alexa. Il est valable dix minutes.`, {
          card: `Code d'association : ${code} (valable 10 minutes)`,
        }),
      )
    }

    const link = await rpc('alexa_lookup', { p_alexa: alexaUser })
    if (!link) {
      return send(
        say('Je ne connais pas encore ton foyer. Dis : Alexa, demande à Miam miam de m’associer, puis saisis le code dans l’app.', {
          end: true,
        }),
      )
    }

    if (rq.type === 'LaunchRequest')
      return send(
        say(`Salut ${link.name ? link.name.split(/[.\s]/)[0] : ''} ! Qu’est-ce que je fais ? Par exemple : ajoute du lait aux courses.`, {
          end: false,
          reprompt: 'Que veux-tu faire ?',
        }),
      )
    if (intent === 'AMAZON.HelpIntent')
      return send(
        say(
          'Tu peux me dire : ajoute du pain aux courses, enlève deux cents grammes de comté, j’ai fini les yaourts, ou est-ce qu’il reste du beurre. Pour revenir en arrière, dis : annule.',
          { end: false, reprompt: 'Que veux-tu faire ?' },
        ),
      )
    if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent' || intent === 'AMAZON.NoIntent') return send(say('À plus tard !'))
    if (intent === 'AnnulerIntent') return send(await handleUndo(link, alexaUser))

    // Réponse à une question de choix (« le comté »).
    const pending = body?.session?.attributes?.pending
    const phrase: string = rq.intent?.slots?.phrase?.value ?? ''
    if (pending && phrase) {
      const text = `${pending.question} Réponse : ${phrase}. (Action : ${pending.then}${pending.then === 'stock_remove' ? ` ${pending.amount} ${pending.unit}` : ''})`
      return send(await handleCommand(text, link, alexaUser))
    }
    if (intent in VERBS && phrase) {
      const verb = VERBS[intent]
      return send(await handleCommand(verb ? `${verb} ${phrase}` : phrase, link, alexaUser))
    }
    if (intent === 'AMAZON.FallbackIntent' || intent in VERBS)
      return send(say('Je n’ai pas bien compris. Tu peux répéter ?', { end: false, reprompt: 'Que veux-tu faire ?' }))
    return send(say('Je n’ai pas compris.', { end: false, reprompt: 'Que veux-tu faire ?' }))
  } catch (e) {
    return send(say('Oups, Miam miam a eu un souci. Réessaie dans un instant.'))
  }
})
