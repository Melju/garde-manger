// Edge Function « bulk » : transforme une liste d'articles tapée en vrac en
// produits structurés (tier « fast » / Haiku, économique). Cache par texte.

import { callClaude, extractJson } from '../_shared/claude.ts'
import { cacheGet, cacheSet, cacheKey } from '../_shared/cache.ts'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

const CATEGORIES = 'fruits, legumes, viandes, poissons, laitiers, epicerie, conserves, sucreries, apero, boissons, surgeles, autre'
const TTL = 60 * 60 * 1000 // 1 h

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* vide */
  }
  const text: string = typeof body.text === 'string' ? body.text.slice(0, 4000).trim() : ''
  if (!text) return json({ error: 'Aucun texte fourni' }, 400)

  const key = cacheKey('bulk', { text })
  const hit = cacheGet<any>(key)
  if (hit) return json({ items: hit, cached: true })

  const prompt = `Voici une liste d'articles de garde-manger / courses saisie en vrac par l'utilisateur
(une ligne ou séparés par des virgules, abréviations possibles).

Liste :
"""
${text}
"""

Transforme-la en articles structurés. Pour chaque article :
- name : nom propre et lisible en français (corrige les abréviations évidentes)
- quantity : nombre d'unités (entier, 1 par défaut)
- unit : "" si à l'unité, sinon "g","kg","mL","L" si une contenance au poids/volume est indiquée
- price : null (sauf si un prix est explicitement écrit)
- category : une seule valeur parmi [${CATEGORIES}]

Réponds STRICTEMENT en JSON valide, sans texte autour :
{"items":[{"name":string,"quantity":number,"unit":string,"price":number|null,"category":string}]}`

  const res = await callClaude({ prompt, tier: 'fast', maxTokens: 1500 })
  if (!res.ok) return json({ error: res.detail }, res.status)

  const parsed = extractJson(res.text)
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : []
  const cats = CATEGORIES.split(', ')
  const items = rawItems
    .filter((i: any) => i && typeof i.name === 'string' && i.name.trim())
    .map((i: any) => ({
      name: String(i.name).slice(0, 80).trim(),
      quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
      unit: typeof i.unit === 'string' && ['g', 'kg', 'mL', 'L'].includes(i.unit) ? i.unit : '',
      price: i.price != null && !isNaN(Number(i.price)) ? Number(i.price) : null,
      category: cats.includes(i.category) ? i.category : 'autre',
    }))
    .slice(0, 100)

  cacheSet(key, items, TTL)
  return json({ items })
})
