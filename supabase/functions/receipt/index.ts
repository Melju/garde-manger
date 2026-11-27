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
  const mediaType: string = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(body.mediaType) ? body.mediaType : 'image/jpeg'
  if (!image) return json({ error: 'Aucune image fournie' }, 400)
  // Produits déjà connus du foyer : l'IA rattache les lignes du ticket à ceux-ci (libellés abrégés compris).
  const known: string[] = Array.isArray(body.known)
    ? body.known.filter((k: unknown) => typeof k === 'string' && k.trim()).slice(0, 400).map((k: string) => k.slice(0, 90))
    : []
  const knownBlock = known.length
    ? `

Produits que ce foyer a déjà achetés (numérotés) :
${known.map((k, i) => `${i + 1}. ${k}`).join('\n')}

Pour chaque article du ticket, si c'est clairement le MÊME produit qu'un de cette liste (même produit et même
variante, la marque peut être absente du ticket), mets son numéro dans known. Sinon known = null. Ne force jamais
une correspondance douteuse : un yaourt nature n'est pas un yaourt fraise.`
    : ''

  const prompt = `Voici un ticket de caisse de courses alimentaires (photo, capture d'écran ou ticket électronique en PDF).
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
- price : prix d'UNE unité en euros (nombre) si visible, sinon null (« 2 x 3,49 » → 3.49)
- category : une seule valeur parmi [${CATEGORIES}]${known.length ? '\n- known : numéro du produit déjà connu correspondant (voir la liste plus bas), ou null' : ''}

Indique aussi store : le nom court de l'enseigne du magasin (« Lidl », « Colruyt », « Carrefour Market »…), ou null si illisible.

Réponds STRICTEMENT en JSON valide, sans texte autour :
{"store":string|null,"items":[{"name":string,"quantity":number,"size":string|null,"unit":string,"price":number|null,"category":string${known.length ? ',"known":number|null' : ''}}]}
Si le document n'est pas un ticket lisible, renvoie {"store":null,"items":[]}.${knownBlock}`

  const res = await callClaude({ apiKey: gate.apiKey,
    prompt,
    tier: 'smart',
    maxTokens: 2400,
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
      known: Number.isInteger(Number(i.known)) && Number(i.known) >= 1 && Number(i.known) <= known.length ? Number(i.known) - 1 : null,
    }))
    .slice(0, 80)

  const store = typeof parsed?.store === 'string' && parsed.store.trim() ? String(parsed.store).trim().slice(0, 40) : null
  return json({ items, store })
})
