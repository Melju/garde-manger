// Edge Function « expiry » : lit la date de péremption sur la photo d'un emballage
// via Claude Vision. Renvoie la date ISO et le type (DLC ou DDM). 1 appel par photo.

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

  const today = new Date().toISOString().slice(0, 10)
  const prompt = `Voici la photo d'un emballage alimentaire. Trouve la date limite imprimée ou gravée
(date de péremption). Nous sommes le ${today}. Le format est européen : jour/mois/année.

- type : "dlc" si la mention est « à consommer jusqu'au » / « DLC » / « use by » ;
  "ddm" si c'est « à consommer de préférence avant » / « DDM » / « best before » / « meilleur avant » ;
  null si aucune mention ne permet de trancher.
- date : au format AAAA-MM-JJ. Années à 2 chiffres : 20xx. Si seuls le mois et l'année sont lisibles
  (ex. « 11/2027 »), donne le dernier jour de ce mois. Si plusieurs dates (date de production, lot),
  garde uniquement la date limite de consommation, jamais la date de fabrication ni le numéro de lot.
- raw : le texte de la date tel que lu sur l'emballage.
- confident : false si la lecture est douteuse (flou, reflet, chiffres ambigus), sinon true.

Réponds STRICTEMENT en JSON valide, sans texte autour :
{"date":string|null,"type":"dlc"|"ddm"|null,"raw":string,"confident":boolean}
Si aucune date n'est lisible, renvoie {"date":null,"type":null,"raw":"","confident":false}.`

  const res = await callClaude({
    prompt,
    tier: 'smart',
    maxTokens: 300,
    images: [{ data: image, mediaType }],
  })
  if (!res.ok) return json({ error: res.detail }, res.status)

  const p = extractJson(res.text) ?? {}
  const date = typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : null
  const type = p.type === 'dlc' || p.type === 'ddm' ? p.type : null
  return json({
    date,
    type,
    raw: typeof p.raw === 'string' ? p.raw.slice(0, 40) : '',
    confident: p.confident !== false,
  })
})
