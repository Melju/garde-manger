// Fonction Vercel : prévient les autres membres du foyer qu'un article a été ajouté à la liste de courses.
// Source de api/push-shopping.js (généré par `npm run build:api`, ne pas éditer le fichier généré).
import webpush from 'web-push'

const env = (k: string) => process.env[k] ?? ''
const ORIGINS = ['https://food.graphikeo.com', 'http://localhost:5173']

function cors(req: any, res: any) {
  const o = req.headers?.origin
  if (o && ORIGINS.includes(o)) res.setHeader('Access-Control-Allow-Origin', o)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
}

function summary(who: string, items: string[]): { title: string; body: string } {
  const name = who || 'Quelqu’un'
  if (items.length === 1) return { title: 'Liste de courses', body: `${name} a ajouté « ${items[0]} »` }
  const shown = items.slice(0, 4).join(', ')
  const more = items.length > 4 ? ` et ${items.length - 4} autre${items.length - 4 > 1 ? 's' : ''}` : ''
  return { title: 'Liste de courses', body: `${name} a ajouté ${items.length} articles : ${shown}${more}` }
}

export default async function handler(req: any, res: any) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'méthode' })
  const base = env('SUPABASE_URL')
  const anon = env('SUPABASE_ANON_KEY')
  if (!base || !anon || !env('VAPID_PRIVATE_KEY') || !env('VAPID_PUBLIC_KEY') || !env('PUSH_SECRET')) {
    return res.status(500).json({ error: 'config manquante' })
  }

  // Appelant : vrai utilisateur connecté (jeton vérifié par GoTrue).
  const auth = String(req.headers?.authorization ?? '')
  if (!auth.toLowerCase().startsWith('bearer ')) return res.status(401).json({ error: 'connexion requise' })
  const u = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anon, authorization: auth } })
  if (!u.ok) return res.status(401).json({ error: 'session invalide' })
  const user = (await u.json()) as { id?: string }
  if (!user?.id) return res.status(401).json({ error: 'session invalide' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  const items: string[] = Array.isArray(body.items)
    ? body.items.filter((x: unknown) => typeof x === 'string' && x.trim()).map((x: string) => x.trim().slice(0, 80)).slice(0, 50)
    : []
  if (!items.length) return res.status(400).json({ error: 'rien à signaler' })

  const r = await fetch(`${base}/rest/v1/rpc/push_shopping_targets`, {
    method: 'POST',
    headers: { apikey: anon, authorization: `Bearer ${anon}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_secret: env('PUSH_SECRET'), p_user: user.id }),
  })
  if (!r.ok) return res.status(502).json({ error: `cibles ${r.status}` })
  const t = (await r.json()) as { who: string; subs: { endpoint: string; p256dh: string; auth: string }[] }

  webpush.setVapidDetails(env('VAPID_SUBJECT') || 'https://food.graphikeo.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  const payload = JSON.stringify({ ...summary(t.who, items), tag: `miamm-shopping-${Date.now()}`, url: './' })
  let sent = 0
  for (const s of t.subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 6 })
      sent++
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await fetch(`${base}/rest/v1/rpc/push_forget`, {
          method: 'POST',
          headers: { apikey: anon, authorization: `Bearer ${anon}`, 'content-type': 'application/json' },
          body: JSON.stringify({ p_secret: env('PUSH_SECRET'), p_endpoint: s.endpoint }),
        }).catch(() => {})
      }
    }
  }
  return res.status(200).json({ sent })
}
