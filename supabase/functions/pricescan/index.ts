// Edge Function « pricescan » : lit le prix sur la photo d'une étiquette de rayon (ou d'un
// emballage) via Claude Vision. 1 appel par photo.

import { callClaude, extractJson } from '../_shared/claude.ts'
import { requireUser } from '../_shared/auth.ts'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)
  const denied = await requireUser(req)
  if (denied) return denied

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* vide */
  }
  const image: string = typeof body.image === 'string' ? body.image : ''
  const mediaType: string = typeof body.mediaType === 'string' ? body.mediaType : 'image/jpeg'
  if (!image) return json({ error: 'Aucune image fournie' }, 400)

  const prompt = `Voici la photo d'une étiquette de prix en rayon de supermarché (ou d'un emballage avec son prix).
Trouve le prix de vente TTC du produit, en euros, pour UNE unité à l'achat.

- price : le prix à payer pour une unité (le gros prix de l'étiquette). Pas le prix au kilo ni au litre.
  Si une promotion est affichée, prends le prix promotionnel actuellement à payer.
- unitPrice : le prix au kilo / au litre / à la pièce s'il est indiqué (nombre), sinon null.
- unitLabel : l'unité de ce prix de référence (« kg », « L », « pièce »…), sinon null.
- name : le nom du produit tel qu'imprimé sur l'étiquette, sinon null.
- confident : false si la lecture est douteuse (flou, reflet, plusieurs prix ambigus), sinon true.

Réponds STRICTEMENT en JSON valide, sans texte autour :
{"price":number|null,"unitPrice":number|null,"unitLabel":string|null,"name":string|null,"confident":boolean}
Si aucun prix n'est lisible, renvoie {"price":null,"unitPrice":null,"unitLabel":null,"name":null,"confident":false}.`

  const res = await callClaude({
    prompt,
    tier: 'smart',
    maxTokens: 300,
    images: [{ data: image, mediaType }],
  })
  if (!res.ok) return json({ error: res.detail }, res.status)

  const p = extractJson(res.text) ?? {}
  const num = (v: unknown) => (v != null && !isNaN(Number(v)) && Number(v) > 0 ? Number(v) : null)
  return json({
    price: num(p.price),
    unitPrice: num(p.unitPrice),
    unitLabel: typeof p.unitLabel === 'string' ? p.unitLabel.slice(0, 12) : null,
    name: typeof p.name === 'string' ? p.name.slice(0, 80) : null,
    confident: p.confident !== false,
  })
})
