// Edge Function « enrich » : à partir d'un nom de produit, devine catégorie,
// conservation, unité et durée de conservation typique. Tier « fast » (Haiku),
// mis en cache. Sert à pré-remplir le formulaire d'ajout (moins de saisie).

import { callClaude, extractJson } from '../_shared/claude.ts'
import { cacheGet, cacheSet, cacheKey } from '../_shared/cache.ts'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

const CATEGORIES = 'fruits, legumes, viandes, poissons, laitiers, epicerie, conserves, sucreries, apero, boissons, surgeles, autre'
const TTL = 24 * 60 * 60 * 1000 // 24 h

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* vide */
  }
  const name: string = typeof body.name === 'string' ? body.name.slice(0, 120).trim() : ''
  if (!name) return json({ error: 'Nom manquant' }, 400)

  const key = cacheKey('enrich', { name: name.toLowerCase() })
  const hit = cacheGet<any>(key)
  if (hit) return json({ ...hit, cached: true })

  const prompt = `Pour le produit alimentaire « ${name} », donne ses caractéristiques typiques pour un garde-manger.

Réponds STRICTEMENT en JSON valide, sans texte autour :
{"category": une valeur parmi [${CATEGORIES}],
 "conservation": "frais" | "refrigere" | "congele",
 "unit": "" | "g" | "kg" | "mL" | "L" | "pièce",
 "shelfLifeDays": nombre de jours de conservation typique APRÈS achat}
Règles : conservation = "refrigere" pour frais réfrigéré (viande, poisson, laitier, légume frais), "congele" pour surgelé, "frais" pour épicerie/ambiant. unit = "" si le produit se compte à l'unité.`

  const res = await callClaude({ prompt, tier: 'fast', maxTokens: 300 })
  if (!res.ok) return json({ error: res.detail }, res.status)

  const r = extractJson(res.text)
  if (!r) return json({ error: 'Réponse illisible' }, 502)

  const cats = CATEGORIES.split(', ')
  const out = {
    category: cats.includes(r.category) ? r.category : 'autre',
    conservation: ['frais', 'refrigere', 'congele'].includes(r.conservation) ? r.conservation : 'frais',
    unit: ['', 'g', 'kg', 'mL', 'L', 'pièce'].includes(r.unit) ? r.unit : '',
    shelfLifeDays: Math.max(0, Math.min(3650, Math.round(Number(r.shelfLifeDays) || 0))),
  }
  cacheSet(key, out, TTL)
  return json(out)
})
