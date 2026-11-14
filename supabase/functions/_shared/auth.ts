// Garde-fou des fonctions IA : exige un utilisateur connecté (pas seulement la clé anon,
// qui est publique) et limite le débit par compte pour borner le coût Anthropic.
// Les fonctions tournent avec VERIFY_JWT=false : la vérification se fait donc ici,
// en demandant à GoTrue si le jeton est celui d'un vrai utilisateur.

const BASE_URL = Deno.env.get('SUPABASE_URL')
const ANON = Deno.env.get('SUPABASE_ANON_KEY')

const TOKEN_TTL = 60_000 // un jeton validé est mémorisé 60 s (évite un aller-retour par appel)
const WINDOW_MS = 10 * 60_000
const MAX_CALLS = 120 // appels IA par compte et par fenêtre de 10 min
const MAX_ENTRIES = 500

const tokens = new Map<string, { uid: string; expires: number }>()
const usage = new Map<string, { start: number; count: number }>()

function deny(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } })
}

function trim<V>(m: Map<string, V>) {
  if (m.size >= MAX_ENTRIES) {
    const first = m.keys().next().value
    if (first !== undefined) m.delete(first)
  }
}

/** Authentifie l'appelant (jeton + limite de débit) : renvoie son id, ou une Response d'erreur. */
export async function authenticate(req: Request): Promise<{ uid: string } | Response> {
  const h = req.headers.get('authorization') ?? ''
  const token = h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : ''
  if (!token) return deny(401, 'Connexion requise')
  if (!BASE_URL || !ANON) return deny(500, 'Authentification non configurée côté serveur')

  let uid: string | null = null
  const hit = tokens.get(token)
  if (hit && hit.expires > Date.now()) uid = hit.uid
  if (!uid) {
    try {
      const r = await fetch(`${BASE_URL}/auth/v1/user`, {
        headers: { apikey: ANON, authorization: `Bearer ${token}` },
      })
      if (!r.ok) return deny(401, 'Session invalide : reconnecte-toi')
      const u = await r.json()
      if (!u?.id) return deny(401, 'Session invalide : reconnecte-toi')
      uid = String(u.id)
    } catch {
      return deny(502, 'Vérification de la session impossible')
    }
    trim(tokens)
    tokens.set(token, { uid, expires: Date.now() + TOKEN_TTL })
  }

  const now = Date.now()
  let u = usage.get(uid)
  if (!u || now - u.start > WINDOW_MS) {
    trim(usage)
    u = { start: now, count: 0 }
    usage.set(uid, u)
  }
  u.count++
  if (u.count > MAX_CALLS) return deny(429, 'Trop de demandes IA, réessaie dans quelques minutes')
  return { uid }
}

/** Renvoie une Response d'erreur si l'appelant n'est pas autorisé, sinon null. */
export async function requireUser(req: Request): Promise<Response | null> {
  const r = await authenticate(req)
  return r instanceof Response ? r : null
}
