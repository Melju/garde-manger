// Edge Function « recipescan » : lit la photo (ou plusieurs) d'une recette papier, d'une page de
// livre ou d'une capture d'écran via Claude Vision et renvoie une recette structurée.
// Clé API côté serveur uniquement.

import { callClaude, extractJson } from '../_shared/claude.ts'
import { aiGate } from '../_shared/gate.ts'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

const COURSES = ['plat principal', 'entrée', 'apéritif', 'soupe', 'dessert']

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
  const images: { data: string; mediaType: string }[] = Array.isArray(body.images)
    ? body.images
        .filter((i: any) => i && typeof i.data === 'string' && i.data)
        .slice(0, 4)
        .map((i: any) => ({ data: i.data, mediaType: typeof i.mediaType === 'string' ? i.mediaType : 'image/jpeg' }))
    : []
  if (!images.length) return json({ error: 'Aucune image fournie' }, 400)

  const prompt = `Voici ${images.length > 1 ? 'les photos (pages successives)' : 'la photo'} d'une recette de cuisine (livre, feuille, carnet ou capture d'écran).
Recopie fidèlement la recette en français, sans rien inventer : si une information n'est pas lisible, laisse-la vide.

Donne :
- title : nom de la recette
- course : une seule valeur parmi [${COURSES.join(', ')}] (la plus probable)
- timeMin : temps total de préparation + cuisson en minutes (nombre entier), 0 si absent
- servings : nombre de personnes (nombre) ou null
- ingredients : liste de {"name": nom de l'ingrédient seul, au singulier ou pluriel naturel, sans quantité ; "qty": quantité telle qu'écrite (« 400 g », « 3 gousses », « 1 c. à soupe »), ou "" si absente}
- steps : étapes de préparation, une phrase claire par étape, dans l'ordre, sans numérotation

Réponds STRICTEMENT en JSON valide, sans texte autour :
{"title":string,"course":string,"timeMin":number,"servings":number|null,"ingredients":[{"name":string,"qty":string}],"steps":[string]}
Si l'image ne contient aucune recette lisible, renvoie {"title":"","course":"plat principal","timeMin":0,"servings":null,"ingredients":[],"steps":[]}.`

  const res = await callClaude({ apiKey: gate.apiKey, prompt, tier: 'smart', maxTokens: 3000, images })
  if (!res.ok) return json({ error: res.detail }, res.status)

  const p = extractJson(res.text) ?? {}
  const ingredients = (Array.isArray(p.ingredients) ? p.ingredients : [])
    .filter((i: any) => i && typeof i.name === 'string' && i.name.trim())
    .map((i: any) => ({
      name: String(i.name).slice(0, 80).trim(),
      qty: typeof i.qty === 'string' ? i.qty.slice(0, 40).trim() : '',
    }))
    .slice(0, 60)
  const steps = (Array.isArray(p.steps) ? p.steps : [])
    .filter((s: any) => typeof s === 'string' && s.trim())
    .map((s: string) => s.trim().slice(0, 600))
    .slice(0, 40)

  return json({
    title: typeof p.title === 'string' ? p.title.slice(0, 100).trim() : '',
    course: COURSES.includes(p.course) ? p.course : 'plat principal',
    timeMin: Math.max(0, Math.round(Number(p.timeMin) || 0)),
    servings: p.servings != null && !isNaN(Number(p.servings)) ? Number(p.servings) : null,
    ingredients,
    steps,
  })
})
