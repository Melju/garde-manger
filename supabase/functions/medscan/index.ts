// Edge Function « medscan » : lit la photo d'une boîte de médicament via Claude Vision (modèle économique)
// et renvoie nom, laboratoire, forme, contenu de la boîte et date de péremption si visible. 1 appel par photo.

import { callClaude, extractJson } from '../_shared/claude.ts'
import { aiGate } from '../_shared/gate.ts'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

const FORMS = ['comprime', 'gelule', 'effervescent', 'sachet', 'sirop', 'gouttes', 'collyre', 'spray', 'creme', 'pastille', 'suppositoire', 'patch', 'soin', 'autre']
const UNITS = ['comprimé', 'gélule', 'sachet', 'dose', 'unidose', 'pastille', 'ampoule', 'patch', 'suppositoire', 'mL', 'g', 'pièce']

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
  const mediaType: string = ['image/jpeg', 'image/png', 'image/webp'].includes(body.mediaType) ? body.mediaType : 'image/jpeg'
  if (!image) return json({ error: 'Aucune image fournie' }, 400)
  if (image.length > 1_500_000) return json({ error: 'Image trop lourde' }, 413)

  const today = new Date().toISOString().slice(0, 10)
  const prompt = `Photo d'une boîte de médicament ou de produit de pharmacie. Lis ce qui est imprimé. Nous sommes le ${today}.
Réponds UNIQUEMENT en JSON :
{"name":string|null,"lab":string|null,"form":string|null,"count":number|null,"unit":string|null,"expiry":string|null}
- name : nom commercial + dosage, court (« Doliprane 1000 mg »). null si ce n'est pas un produit de pharmacie.
- lab : laboratoire, ou null.
- form : une valeur parmi [${FORMS.join(', ')}] (poudre en sachet = sachet, comprimé à dissoudre = effervescent, solution/suspension buvable = sirop, crème/pommade/gel = creme).
- count + unit : contenu d'UNE boîte (« 8 comprimés » → 8, "comprimé" ; « 150 ml » → 150, "mL"). unit parmi [${UNITS.join(', ')}]. null si illisible.
- expiry : date de péremption (EXP, « À utiliser avant ») au format AAAA-MM-JJ ; si seuls mois/année, dernier jour du mois. null si non visible. Ne devine jamais.`

  const res = await callClaude({
    apiKey: gate.apiKey,
    prompt,
    tier: 'fast',
    maxTokens: 200,
    images: [{ data: image, mediaType }],
  })
  if (!res.ok) return json({ error: res.detail }, res.status)

  const p = extractJson(res.text) ?? {}
  const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)
  const count = Number(p.count)
  return json({
    name: str(p.name, 80),
    lab: str(p.lab, 60),
    form: FORMS.includes(p.form) ? p.form : null,
    count: isFinite(count) && count > 0 && count < 10000 ? Math.round(count * 100) / 100 : null,
    unit: UNITS.includes(p.unit) ? p.unit : p.unit === 'ml' ? 'mL' : null,
    expiry: typeof p.expiry === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.expiry) ? p.expiry : null,
  })
})
