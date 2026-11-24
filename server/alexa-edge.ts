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
import { consumeAmount, countLabel, countPerPack, countUnit, formatContenance, parseContenance } from '../src/lib/contenance'
import { openShelfDays } from '../src/lib/openShelf'
import { isIngredientInStock } from '../src/lib/recipesLib'
import { defaultConservation, type Category, type Product } from '../src/types'
import { answerScreen, byExpiry, doneScreen, gridScreen, homeScreen, listScreen, matching, nameTile, priorityProducts, productScreen, recipeScreen, recipesScreen, weekDates, weekScreen, productTile, urgent, urgentCount, type Tile } from './alexa-apl'

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
  // Deno ne sait pas vérifier une chaîne X.509 : la confiance repose sur l'adresse du certificat
  // (seul Amazon publie sur s3.amazonaws.com/echo.api/), son nom, son émetteur, sa validité et la signature.
  const hostOk = /CN=echo-api\.amazon\.com/.test(String(leaf.subject)) && /O=Amazon/.test(String(leaf.issuer))
  if (!hostOk) return 'certificat non Amazon'
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

type Screen = { document: unknown; data: unknown }
/** Ajoute l'écran (Echo Show) à la réponse ; la session reste ouverte, micro fermé, pour pouvoir toucher l'écran. */
function attach(r: any, screen: Screen | null, apl: boolean) {
  if (!apl || !screen) return r
  r.response.directives = [
    { type: 'Alexa.Presentation.APL.RenderDocument', token: 'miam', document: screen.document, datasources: screen.data },
  ]
  if (r.response.shouldEndSession === true) delete r.response.shouldEndSession
  return r
}
type UI = { apl: boolean; view?: 'grid' | 'recipe'; lieu?: string; query?: string }

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
async function setConfig(key: string, value: string) {
  try {
    const k = env('SUPABASE_SERVICE_ROLE_KEY')
    await fetch(`${env('SUPABASE_URL')}/rest/v1/push_config`, {
      method: 'POST',
      headers: { apikey: k, authorization: `Bearer ${k}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key, value: value.slice(0, 900) }),
    })
  } catch {
    /* rien */
  }
}
/** Trace la dernière erreur (table push_config, clé alexa_last_error) pour le diagnostic. */
async function note(msg: string) {
  try {
    const k = env('SUPABASE_SERVICE_ROLE_KEY')
    await fetch(`${env('SUPABASE_URL')}/rest/v1/push_config`, {
      method: 'POST',
      headers: {
        apikey: k,
        authorization: `Bearer ${k}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key: 'alexa_last_error', value: `${new Date().toISOString()} ${msg}`.slice(0, 900) }),
    })
  } catch {
    /* rien */
  }
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
  | { t: 'hist_del'; id: string }

function open(link: { user_id: string; household_id: string }) {
  const jwt = userJwt(link.user_id)
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { jwt, sb, repo: new SupabaseRepository(sb as any, link.household_id) }
}

const firstName = (n?: string) => {
  const w = (n ?? '').split(/[.\s@_\d]/)[0]
  return w.length >= 3 ? w.charAt(0).toUpperCase() + w.slice(1) : ''
}
/** Prénom à afficher : le nom de profil, sinon le seul membre de la famille qui commence par la même lettre. */
async function displayName(link: any, repo: SupabaseRepository) {
  const f = firstName(link.name)
  if (f) return f
  const initial = (link.name ?? '').trim().charAt(0).toLowerCase()
  if (!initial) return ''
  const fam = await repo.getFamily().catch(() => [])
  const hits = fam.filter((m: any) => (m.name ?? '').trim().toLowerCase().startsWith(initial))
  return hits.length === 1 ? String(hits[0].name).split(' ')[0] : ''
}

async function handleHome(link: any, apl: boolean, text: ((name: string) => string) | null) {
  const { repo } = open(link)
  const name = await displayName(link, repo)
  const r: any = text ? say(text(name), { end: false, reprompt: 'Que veux-tu faire ?' }) : { version: '1.0', response: {} }
  if (!apl) return r
  const [allProducts, shopping] = await Promise.all([repo.listProducts(), repo.listShopping()])
  const products = allProducts.filter((p) => p.category !== 'pharmacie')
  return attach(
    r,
    homeScreen({
      name,
      total: products.length,
      soon: urgentCount(products),
      shop: shopping.filter((s) => !s.checked).length,
      urgent: urgent(products).map(productTile),
    }),
    apl,
  )
}

async function handleList(link: any, apl: boolean) {
  const { repo } = open(link)
  const shopping = await repo.listShopping()
  const left = shopping.filter((s) => !s.checked)
  const names = left.map((s) => s.name)
  const speech = !names.length
    ? 'La liste de courses est vide.'
    : names.length <= 12
      ? `Sur la liste : ${names.slice(0, -1).join(', ')}${names.length > 1 ? ' et ' : ''}${names[names.length - 1]}.`
      : `Il y a ${names.length} articles, dont ${names.slice(0, 8).join(', ')}.`
  return attach(say(speech), listScreen(shopping), apl)
}

async function handleCommand(text: string, link: { user_id: string; household_id: string; name: string }, alexaUser: string, ui: UI = { apl: false }) {
  const { jwt, sb, repo } = open(link)
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
  if (!actions.length) {
    const r = say(reply || 'Je n’ai pas compris. Tu peux reformuler ?', { end: false, reprompt: 'Que veux-tu faire ?' })
    if (!ui.apl || !reply) return r
    if (ui.view === 'grid') {
      const l = ui.lieu ? norm(ui.lieu) : ''
      const food = products.filter((p) => p.category !== 'pharmacie')
      const list = byExpiry(l ? food.filter((p) => norm(p.location ?? '').includes(l)) : food)
      const title = ui.lieu ? ui.lieu.charAt(0).toUpperCase() + ui.lieu.slice(1) : 'Tout le stock'
      const nav = l.startsWith('refri') ? 'frigo' : l.startsWith('congel') ? 'congel' : l ? '' : 'stock'
      return attach(r, gridScreen(title, `${list.length} produit${list.length > 1 ? 's' : ''}`, list.slice(0, 90).map(productTile), nav), true)
    }
    if (ui.view === 'recipe')
      return attach(r, answerScreen(reply, { title: 'Idées de repas', tiles: urgent(products.filter((p) => p.category !== 'pharmacie'), 12).map(productTile), tilesTitle: 'À utiliser en priorité', nav: 'recipe' }), true)
    return attach(r, answerScreen(reply, { tiles: matching(products, ui.query || text).map(productTile), tilesTitle: 'Dans ton stock' }), true)
  }

  const ask = actions.find((a) => a.type === 'ask')
  if (ask) {
    // Choix à faire : Alexa pose la question, la réponse revient dans la même session.
    const names = (ask.options as { id: string; label: string }[]).map((o) => o.label).join(', ou ')
    const r = say(`${ask.question} ${names} ?`, {
      end: false,
      reprompt: ask.question,
      attrs: { pending: ask },
    })
    const labels = (ask.options as { label: string }[]).map((o) => o.label)
    return attach(r, answerScreen(ask.question, { title: 'Une précision', options: labels }), ui.apl)
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
  const tiles: Tile[] = []
  for (const a of actions) {
    if (a.type === 'shop_add') tiles.push(nameTile(a.name, 'Ajouté aux courses'))
    else if (a.type === 'stock_add') tiles.push(nameTile(a.name, 'Ajouté au stock'))
    else if (a.type === 'shop_remove') {
      const it = shopping.find((s) => s.id === a.id)
      if (it) tiles.push(nameTile(it.name, 'Retiré des courses'))
    } else {
      const p = products.find((x) => x.id === a.id)
      const verb = { stock_finish: 'Terminé', stock_waste: 'Jeté', stock_open: 'Ouvert', stock_remove: 'Entamé' }[a.type as string]
      if (p) tiles.push({ ...productTile(p), sub: verb ?? productTile(p).sub, tone: 'ok' })
    }
  }
  return attach(say(reply || 'C’est fait.', { card: actions.map((a) => a.label).join('\n') }), doneScreen(reply || 'C’est fait.', tiles), ui.apl)
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const quiet = (screen: any, apl: boolean, attrs: Record<string, unknown> = {}) =>
  attach({ version: '1.0', sessionAttributes: attrs, response: {} }, screen, apl)

/** Navigation par la barre du bas et les compteurs de l'accueil (sans voix, sauf les idées repas qui passent par l'IA). */
async function handleNav(key: string, link: any, alexaUser: string, apl: boolean) {
  if (key === 'home') return handleHome(link, apl, null)
  if (key === 'recipe') return handleCommand(FIXED.RecetteIntent(), link, alexaUser, { apl, view: 'recipe' })
  const { repo } = open(link)
  if (key === 'list') return quiet(listScreen(await repo.listShopping()), apl)
  if (key === 'week') return handleWeek(link, apl, 0, false)
  if (key === 'recipes') {
    const [recipes, products] = await Promise.all([repo.getRecipes(), repo.listProducts()])
    return quiet(recipesScreen(recipes, products), apl)
  }
  const products = (await repo.listProducts()).filter((p) => p.category !== 'pharmacie')
  const count = (n: number) => `${n} produit${n > 1 ? 's' : ''}`
  if (key === 'urgent') {
    const list = priorityProducts(products)
    return quiet(gridScreen('À consommer vite', count(list.length), list.map(productTile), 'urgent'), apl)
  }
  if (key === 'frigo' || key === 'congel') {
    const want = key === 'frigo' ? ['refrigerateur', 'frigo'] : ['congel']
    const list = byExpiry(products.filter((p) => want.some((w) => norm(p.location ?? '').includes(w))))
    return quiet(gridScreen(key === 'frigo' ? 'Réfrigérateur' : 'Congélateur', count(list.length), list.slice(0, 90).map(productTile), key), apl)
  }
  const list = byExpiry(products)
  const label = list.length > 120 ? `${list.length} produits, les 120 plus urgents` : count(list.length)
  return quiet(gridScreen('Tout le stock', label, list.slice(0, 120).map(productTile), 'stock'), apl)
}

/** « J'en ai utilisé » : retire une portion ou des unités, puis réaffiche la fiche à jour. */
async function handleUse(id: string, amount: number, unit: string, label: string, link: any, alexaUser: string, apl: boolean) {
  const { sb, repo } = open(link)
  const [products, shopping] = await Promise.all([repo.listProducts(), repo.listShopping()])
  const p = products.find((x) => x.id === id)
  if (!p || !(amount > 0)) return quiet(null, apl)
  if (!label)
    label = unit === 'g' || unit === 'mL' ? formatContenance(amount, unit) : unit ? countLabel(amount, unit) : `${amount}`
  const undo: Undo[] = []
  const pack = countPerPack(p.size)
  const action =
    pack && p.quantity > 1 && unit === pack.unit
      ? { type: 'stock_sachets', id, amount }
      : unit
        ? { type: 'stock_remove', id, amount, unit }
        : { type: 'stock_remove', id, amount }
  await applyOne(action, repo, sb, products, shopping, undo)
  await rpc('alexa_set_undo', { p_alexa: alexaUser, p_undo: { at: Date.now(), ops: undo } }).catch(() => {})
  const after = (await repo.listProducts()).filter((x) => x.name === p.name && x.category === p.category)
  const split = (undo.find((u) => u.t === 'prod_del') as { id: string } | undefined)?.id
  const same = after.find((x) => x.id === split) ?? after.find((x) => x.id === id) ?? after[0]
  if (!same) {
    const text = `${p.name} : il n’en reste plus, je le retire du stock.`
    return attach(say(text), doneScreen(text, [{ ...productTile(p), sub: 'Terminé', tone: 'ok' }]), apl)
  }
  const allSame = after.filter((x) => countPerPack(x.size)?.unit === pack?.unit)
  const sachetsLeft = pack ? allSame.reduce((n, x) => n + (x.quantity > 1 ? x.quantity * (countPerPack(x.size)?.per ?? 0) : (parseContenance(x.size)?.value ?? 0)), 0) : 0
  const left = pack && p.quantity > 1
    ? countLabel(sachetsLeft, pack.unit)
    : same.quantity > 1 ? `${same.quantity} unités` : same.size ? same.size.split('/')[0] : same.quantity === 1 ? 'une unité' : ''
  const text = `C’est noté, ${label} de ${p.name}.${left ? ` Il en reste ${left}.` : ''}`
  return attach(say(text), productScreen(same), apl)
}

/** Planning de la semaine (comme l'écran Planning de l'app). */
async function handleWeek(link: any, apl: boolean, offset: number, speak: boolean) {
  const { repo } = open(link)
  const [plan, recipes] = await Promise.all([repo.getMealPlan(), repo.getRecipes()])
  let r: any = { version: '1.0', response: {} }
  if (speak) {
    const todayIso = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
    const days = weekDates(0).filter((d) => d >= todayIso)
    const names = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const parts: string[] = []
    for (const d of days) {
      const m = plan[`${d}_midi`], e = plan[`${d}_soir`]
      if (!m && !e) continue
      const day = d === todayIso ? 'aujourd’hui' : names[new Date(d + 'T12:00:00Z').getUTCDay()]
      parts.push(`${day}${m ? `, midi : ${m}` : ''}${e ? `, soir : ${e}` : ''}`)
    }
    r = say(parts.length ? `Au menu : ${parts.slice(0, 5).join(' ; ')}.` : 'Rien n’est prévu cette semaine. Tu peux planifier tes repas dans l’app.')
  }
  return attach(r, weekScreen(plan, recipes, offset), apl)
}

async function handleRecipe(id: string, link: any, apl: boolean) {
  const { repo } = open(link)
  const [recipes, products] = await Promise.all([repo.getRecipes(), repo.listProducts()])
  const r = recipes.find((x) => x.id === id)
  return quiet(r ? recipeScreen(r, products) : recipesScreen(recipes, products), apl)
}

/** Ajoute les ingrédients manquants d'une recette aux courses (comme le bouton du Planning). */
async function handleRecipeShop(id: string, link: any, alexaUser: string, apl: boolean) {
  const { repo } = open(link)
  const [recipes, products, shopping] = await Promise.all([repo.getRecipes(), repo.listProducts(), repo.listShopping()])
  const r = recipes.find((x) => x.id === id)
  if (!r) return quiet(null, apl)
  const have = new Set(shopping.filter((s) => !s.checked).map((s) => norm(s.name)))
  const ids: string[] = []
  for (const ing of r.ingredients) {
    if (isIngredientInStock(ing, products) || have.has(norm(ing.name))) continue
    const it = await repo.addShoppingItem({ name: ing.name, category: 'autre' as Category, quantity: 1, source: 'auto' })
    ids.push(it.id)
  }
  if (ids.length) await rpc('alexa_set_undo', { p_alexa: alexaUser, p_undo: { at: Date.now(), ops: [{ t: 'shop_del', ids }] } }).catch(() => {})
  const text = ids.length
    ? `J’ai ajouté ${ids.length} ingrédient${ids.length > 1 ? 's' : ''} aux courses.`
    : 'Les ingrédients manquants sont déjà sur la liste.'
  return attach(say(text), recipeScreen(r, products), apl)
}

/** Boutons de la fiche produit. */
async function handleAct(kind: string, id: string, link: any, alexaUser: string, apl: boolean) {
  const { sb, repo } = open(link)
  const [products, shopping] = await Promise.all([repo.listProducts(), repo.listShopping()])
  const p = products.find((x) => x.id === id)
  if (!p) return attach(say('Ce produit n’est plus dans le stock.'), doneScreen('Ce produit n’est plus dans le stock.', [], false), apl)
  const a =
    kind === 'shop'
      ? { type: 'shop_add', name: p.name, category: p.category, quantity: 1 }
      : { type: { finish: 'stock_finish', open: 'stock_open', waste: 'stock_waste' }[kind] ?? '', id: p.id }
  if (!a.type) return quiet(null, apl)
  const undo: Undo[] = []
  await applyOne(a, repo, sb, products, shopping, undo)
  await rpc('alexa_set_undo', { p_alexa: alexaUser, p_undo: { at: Date.now(), ops: undo } }).catch(() => {})
  const text =
    kind === 'finish' ? `${p.name} : terminé, je le retire du stock.` : kind === 'waste' ? `${p.name} : noté comme jeté.` : kind === 'open' ? `${p.name} : noté comme entamé.` : `${p.name} ajouté aux courses.`
  const sub = { finish: 'Terminé', waste: 'Jeté', open: 'Entamé', shop: 'Ajouté aux courses' }[kind] ?? ''
  return attach(say(text), doneScreen(text, [{ ...productTile(p), sub, tone: 'ok' }]), apl)
}

async function logHistory(undo: Undo[], sb: any, hid: string, kind: string, label: string, meta: Record<string, unknown>) {
  const now = new Date()
  const id = randomUUID()
  undo.push({ t: 'hist_del', id })
  await sb.from('history').insert({
    id,
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
    await logHistory(undo, sb, hid, 'consomme', `${p.name} consommé (×${p.quantity})`, { ...meta, qty: p.quantity })
    return
  }
  if (a.type === 'stock_waste') {
    await repo.removeProduct(p.id)
    await logHistory(undo, sb, hid, 'jete', `${p.name} jeté (périmé)`, { ...meta, qty: p.quantity })
    return
  }
  if (a.type === 'stock_open') {
    const days = openShelfDays(p.name, p.category).days
    const exp = new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10)
    const keep = p.expiryDate && p.expiryDate < exp ? p.expiryDate : exp
    await repo.updateProduct(p.id, { openedAt: new Date().toISOString(), expiryDate: keep })
    return
  }
  // Plusieurs boîtes de sachets : on retire des sachets sur l'ensemble, comme dans l'app.
  const pack = countPerPack(p.size)
  if ((a.type === 'stock_sachets' || (a.type === 'stock_remove' && a.unit && countUnit(a.unit))) && pack && p.quantity > 1) {
    const n = Math.max(1, Math.round(a.amount))
    const remaining = p.quantity * pack.per - n
    await logHistory(undo, sb, hid, 'consomme', `${p.name} : ${countLabel(Math.min(n, p.quantity * pack.per), pack.unit)}`, { ...meta, qty: 0 })
    if (remaining <= 0) {
      await repo.removeProduct(p.id)
      return
    }
    const full = Math.floor(remaining / pack.per)
    const rem = remaining % pack.per
    const partial = `${rem} ${pack.unit}/${pack.per} ${pack.unit}`
    if (rem === 0) await repo.updateProduct(p.id, { quantity: full })
    else if (full === 0) await repo.updateProduct(p.id, { quantity: 1, size: partial })
    else {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = p as any
      await repo.updateProduct(p.id, { quantity: full })
      const np = await repo.addProduct({ ...rest, quantity: 1, size: partial })
      undo.push({ t: 'prod_del', id: np.id })
    }
    return
  }
  if (a.type === 'stock_remove') {
    const parsed = parseContenance(p.size)
    if (!a.unit || !parsed) {
      const n = Math.min(a.unit ? 1 : Math.max(1, Math.round(a.amount)), p.quantity)
      await repo.adjustQuantity(p.id, -n)
      await logHistory(undo, sb, hid, 'consomme', `${p.name} consommé (×${n})`, { ...meta, qty: n })
      return
    }
    const newSize = consumeAmount(p.size!, a.amount, a.unit)
    if (newSize === null) {
      await repo.adjustQuantity(p.id, -1)
      await logHistory(undo, sb, hid, 'consomme', `${p.name} consommé (×1)`, { ...meta, qty: 1 })
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

async function handleUndo(link: { user_id: string; household_id: string; last_undo?: any }, alexaUser: string, apl = false) {
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
        else {
          // Recréé avec son identifiant et sa date d'ajout d'origine (liens des recettes, historique).
          const np = await repo.addProduct(rest)
          await sb.from('products').update({ id, created_at: (op.snap as any).createdAt }).eq('id', np.id)
        }
      } else if (op.t === 'hist_del') {
        await sb.from('history').delete().eq('id', op.id)
      }
    } catch {
      /* au mieux */
    }
  }
  await rpc('alexa_set_undo', { p_alexa: alexaUser, p_undo: null }).catch(() => {})
  return attach(say('C’est annulé, tout est revenu comme avant.'), doneScreen('C’est annulé, tout est revenu comme avant.', [], false), apl)
}

// ---------- Point d'entrée ----------
const VERBS: Record<string, string> = {
  AjouterIntent: 'ajoute',
  EnleverIntent: 'enlève',
  JaiIntent: 'j’ai',
  QuestionIntent: 'Question :',
  PlusIntent: 'on n’a plus',
  CommandeIntent: '',
}

// Questions courantes, sans texte libre : Alexa les reconnaît mieux en phrases entières.
const FIXED: Record<string, (lieu?: string) => string> = {
  ContenuIntent: (lieu) =>
    lieu
      ? `Qu’est-ce qu’il y a dans le ${lieu} ? Ne cite que les produits dont l’emplacement est « ${lieu} » (sans tenir compte des majuscules), et résume en quelques mots.`
      : 'Qu’est-ce que j’ai en stock ? Résume en quelques mots, en citant d’abord ce qui périme bientôt.',
  RecetteIntent: () => 'Qu’est-ce que je peux cuisiner avec ce que j’ai, en priorité ce qui périme bientôt ? Propose une ou deux idées courtes.',
  ListeIntent: () => 'Qu’est-ce qu’il y a sur la liste de courses ? Lis-la simplement.',
}

const out = (status: number, o: unknown) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json;charset=UTF-8' } })

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return out(405, { error: 'méthode' })
  const raw = await req.text()
  const bad = await verifyAmazon(req, raw).catch((e) => String(e))
  if (bad) {
    await note(`vérification : ${bad}`)
    return out(400, { error: bad })
  }
  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return out(400, { error: 'json' })
  }
  const ts = Date.parse(body?.request?.timestamp ?? '')
  if (!ts || Math.abs(Date.now() - ts) > 150_000) { await note('horodatage'); return out(400, { error: 'horodatage' }) }
  const appId = body?.session?.application?.applicationId ?? body?.context?.System?.application?.applicationId
  const want = await allowedSkill()
  if (want && appId !== want) { await note(`skill inconnue ${appId}`); return out(400, { error: 'skill inconnue' }) }

  const send = (o: unknown) => out(200, o)
  const rq = body.request ?? {}
  const alexaUser: string = body?.session?.user?.userId ?? body?.context?.System?.user?.userId ?? ''
  const apl = !!body?.context?.System?.device?.supportedInterfaces?.['Alexa.Presentation.APL']
  // Trace de la dernière requête (diagnostic) : type, intention, début de l'identifiant Alexa.
  void setConfig('alexa_last_req', `${new Date().toISOString()} ${rq.type} ${rq.intent?.name ?? ''} ${alexaUser.slice(0, 40)} ${JSON.stringify(rq.error ?? rq.reason ?? '')}`)
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
      return send(await handleHome(link, apl, (n) => `Salut${n ? ` ${n}` : ''} ! Qu’est-ce que je fais ?`))
    if (intent === 'AMAZON.HelpIntent' || intent === 'AMAZON.NavigateHomeIntent')
      return send(
        await handleHome(
          link,
          apl,
          () =>
            'Tu peux me dire : ajoute du pain aux courses, enlève deux cents grammes de comté, j’ai fini les yaourts, ou est-ce qu’il reste du beurre. Pour revenir en arrière, dis : annule.',
        ),
      )
    if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent' || intent === 'AMAZON.NoIntent') return send(say('À plus tard !'))
    if (intent === 'AnnulerIntent') return send(await handleUndo(link, alexaUser, apl))

    // Touches sur l'écran (Echo Show).
    if (rq.type === 'Alexa.Presentation.APL.UserEvent') {
      const [kind, value] = (rq.arguments ?? []) as string[]
      if (kind === 'toggle' && value) {
        const { repo } = open(link)
        await repo.toggleShoppingItem(value)
        const shopping = await repo.listShopping()
        return send(attach({ version: '1.0', sessionAttributes: body?.session?.attributes ?? {}, response: {} }, listScreen(shopping), apl))
      }
      if (kind === 'nav' && value) return send(await handleNav(value, link, alexaUser, apl))
      if (kind === 'product' && value) {
        const { repo } = open(link)
        const p = (await repo.listProducts()).find((x) => x.id === value)
        return send(p ? quiet(productScreen(p), apl) : await handleNav('stock', link, alexaUser, apl))
      }
      if (kind === 'week') return send(await handleWeek(link, apl, Number(value) || 0, false))
      if (kind === 'recipe' && value) return send(await handleRecipe(value, link, apl))
      if (kind === 'recipeShop' && value) return send(await handleRecipeShop(value, link, alexaUser, apl))
      if (kind === 'use' && value && rq.arguments?.[2]) {
        const [, , amount, unit, label] = rq.arguments as string[]
        return send(await handleUse(value, Number(amount), unit || '', label || '', link, alexaUser, apl))
      }
      if (kind === 'act' && value && rq.arguments?.[2]) return send(await handleAct(value, String(rq.arguments[2]), link, alexaUser, apl))
      if (kind === 'clear') {
        const { repo } = open(link)
        const done = (await repo.listShopping()).filter((s) => s.checked)
        await repo.clearCheckedShopping()
        const undo: Undo[] = done.map((it) => ({ t: 'shop_add', item: { name: it.name, category: it.category, quantity: it.quantity, unit: it.unit } }))
        await rpc('alexa_set_undo', { p_alexa: alexaUser, p_undo: { at: Date.now(), ops: undo } }).catch(() => {})
        return send(quiet(listScreen(await repo.listShopping()), apl))
      }
      if (kind === 'answer' && value) {
        const pend = body?.session?.attributes?.pending
        const text = pend
          ? `${pend.question} Réponse : ${value}. (Action : ${pend.then}${pend.then === 'stock_remove' ? ` ${pend.amount} ${pend.unit}` : ''})`
          : value
        return send(await handleCommand(text, link, alexaUser, { apl }))
      }
      return send({ version: '1.0', response: {} })
    }

    // Réponse à une question de choix (« le comté »).
    const pending = body?.session?.attributes?.pending
    const phrase: string = rq.intent?.slots?.phrase?.value ?? ''
    if (pending && phrase) {
      const text = `${pending.question} Réponse : ${phrase}. (Action : ${pending.then}${pending.then === 'stock_remove' ? ` ${pending.amount} ${pending.unit}` : ''})`
      return send(await handleCommand(text, link, alexaUser, { apl, query: phrase }))
    }
    if (intent === 'ListeIntent') return send(await handleList(link, apl))
    if (intent === 'SemaineIntent') return send(await handleWeek(link, apl, 0, true))
    if (intent === 'RecettesIntent') {
      const r = await handleNav('recipes', link, alexaUser, apl)
      return send(apl ? r : say('Tes recettes sont dans l’app.'))
    }
    if (intent === 'RecetteIntent') {
      // Repas déjà prévu au planning : on le donne plutôt que d'inventer.
      const { repo } = open(link)
      const [plan, recipes] = await Promise.all([repo.getMealPlan(), repo.getRecipes()])
      const d = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
      const hour = Number(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', timeZone: 'Europe/Paris' }).slice(0, 2))
      const slot = hour < 14 && plan[`${d}_midi`] ? 'midi' : 'soir'
      const planned = plan[`${d}_${slot}`]
      if (planned) {
        const r = recipes.find((x) => x.title.toLowerCase() === planned.toLowerCase())
        const text = `${slot === 'midi' ? 'Ce midi' : 'Ce soir'}, c’est ${planned}, c’est prévu au planning.`
        if (r) return send(attach(say(text), recipeScreen(r, await repo.listProducts()), apl))
        return send(attach(say(text), weekScreen(plan, recipes, 0), apl))
      }
    }
    if (intent in FIXED) {
      const lieu = rq.intent?.slots?.lieu?.resolutions?.resolutionsPerAuthority?.[0]?.values?.[0]?.value?.name ?? rq.intent?.slots?.lieu?.value
      const view = intent === 'ContenuIntent' ? 'grid' : intent === 'RecetteIntent' ? 'recipe' : undefined
      return send(await handleCommand(FIXED[intent](lieu), link, alexaUser, { apl, view, lieu }))
    }
    if (intent in VERBS && phrase) {
      const verb = VERBS[intent]
      return send(await handleCommand(verb ? `${verb} ${phrase}` : phrase, link, alexaUser, { apl, query: phrase }))
    }
    if (intent === 'AMAZON.FallbackIntent' || intent in VERBS)
      return send(
        say('Je n’ai pas saisi. Commence par un verbe, par exemple : ajoute du lait, j’ai fini le beurre, ou est-ce qu’il reste des œufs.', {
          end: false,
          reprompt: 'Que veux-tu faire ?',
        }),
      )
    return send(say('Je n’ai pas compris.', { end: false, reprompt: 'Que veux-tu faire ?' }))
  } catch (e) {
    await note(`erreur : ${e instanceof Error ? `${e.message} ${e.stack ?? ''}` : String(e)}`)
    return send(say('Oups, Miam miam a eu un souci. Réessaie dans un instant.'))
  }
})
