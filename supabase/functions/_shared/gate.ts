// Garde-fou des fonctions IA : utilisateur connecté + quota mensuel du foyer,
// ou clé Anthropic personnelle du foyer (alors pas de quota, c'est son compte).

import { authenticate } from './auth.ts'

const BASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const DEFAULT_LIMIT = Number(Deno.env.get('AI_MONTHLY_LIMIT') ?? '60') || 60

function deny(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } })
}

/** Renvoie une Response d'erreur, ou { apiKey? } (clé perso du foyer si elle existe). */
export async function aiGate(req: Request): Promise<{ apiKey?: string } | Response> {
  const who = await authenticate(req)
  if (who instanceof Response) return who
  if (!BASE_URL || !SERVICE) return deny(500, 'Quota IA non configuré côté serveur')
  let r: any
  try {
    const resp = await fetch(`${BASE_URL}/rest/v1/rpc/ai_gate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
      body: JSON.stringify({ p_uid: who.uid, p_default_limit: DEFAULT_LIMIT }),
    })
    if (!resp.ok) return deny(502, 'Vérification du quota IA impossible')
    r = await resp.json()
  } catch {
    return deny(502, 'Vérification du quota IA impossible')
  }
  if (!r?.allowed) {
    if (r?.reason === 'no_household') return deny(403, 'Rejoins ou crée un foyer pour utiliser l’IA')
    return deny(429, `Quota IA du mois atteint (${r?.limit ?? DEFAULT_LIMIT} appels). Ajoute ta propre clé Anthropic dans Compte pour continuer.`)
  }
  return { apiKey: typeof r.key === 'string' ? r.key : undefined }
}
