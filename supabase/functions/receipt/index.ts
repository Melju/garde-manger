// Edge Function « receipt » : lit la photo d'un ticket de caisse via Claude Vision
// et en extrait la liste des articles alimentaires. Déclenché manuellement (1 appel
// par ticket). Clé API côté serveur uniquement.

import { callClaude, extractJson } from '../_shared/claude.ts'
import { aiGate } from '../_shared/gate.ts'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

const CATEGORIES = 'fruits, legumes, viandes, viandes-vg, poissons, laitiers, epicerie, huiles, conserves, sucreries, patisserie, apero, boissons, surgeles, autre'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)
  const gate = await aiGate(req)
  if (gate instanceof Response) return gate

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* vide */
  }
  const image: string = typeof body.image === 'string' ? body.image : ''
  const mediaType: string = typeof body.mediaType === 'string' ? body.mediaType : 'image/jpeg'
  if (!image) return json({ error: 'Aucune image fournie' }, 400)

  const prompt = `Voici la photo d'un ticket de caisse de courses alimentaires.
Extrais UNIQUEMENT les articles alimentaires / produits du quotidien achetés (ignore le total,
la TVA, le magasin, la carte de fidélité, les remises non liées à un produit).

Pour chaque article, donne :
- name : nom lisible et corrigé du produit (développe les abréviations si évident, en français)
- quantity : nombre de paquets / unités achetés (entier, 1 par défaut ; « 2 x 3,49 » = 2)
- size : contenance d'UN seul paquet telle qu'elle apparaît dans le libellé : poids ou volume
  (« 500 g », « 1 kg », « 1,5 L », « 33 cl ») OU nombre de sachets (« 12 sachets ») pour les boîtes de
  biscuits, thés, infusions, etc. Pour un lot (« 6X33CL »), donne la contenance d'une unité (« 33 cl »)
  et mets le nombre d'unités dans quantity. null si rien n'est lisible : ne devine jamais.
- unit : "" (obsolète, laisse vide)
- price : prix payé en euros (nombre) si visible, sinon null
- category : une seule valeur parmi [${CATEGORIES}]

Réponds STRICTEMENT en JSON valide, sans texte autour :
{"items":[{"name":string,"quantity":number,"size":string|null,"unit":string,"price":number|null,"category":string}]}
Si l'image n'est pas un ticket lisible, renvoie {"items":[]}.`

  const res = await callClaude({ apiKey: gate.apiKey,
    prompt,
    tier: 'smart',
    maxTokens: 2000,
    images: [{ data: image, mediaType }],
  })
  if (!res.ok) return json({ error: res.detail }, res.status)

  const parsed = extractJson(res.text)
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : []
  const cats = CATEGORIES.split(', ')
  const items = rawItems
    .filter((i: any) => i && typeof i.name === 'string' && i.name.trim())
    .map((i: any) => ({
      name: String(i.name).slice(0, 80).trim(),
      quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
      size: typeof i.size === 'string' && i.size.trim() ? String(i.size).slice(0, 24).trim() : null,
      unit: typeof i.unit === 'string' && ['g', 'kg', 'mL', 'L'].includes(i.unit) ? i.unit : '',
      price: i.price != null && !isNaN(Number(i.price)) ? Number(i.price) : null,
      category: cats.includes(i.category) ? i.category : 'autre',
    }))
    .slice(0, 80)

  return json({ items })
})
