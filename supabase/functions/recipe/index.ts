// Edge Function « recipe » : génère une recette à partir du stock via Claude.
// Modèle « smart » (Sonnet). Résultat mis en cache (entrées identiques) pour
// éviter de repayer un appel. La clé API reste côté serveur uniquement.

import { callClaude, extractJson } from '../_shared/claude.ts'
import { cacheGet, cacheSet, cacheKey } from '../_shared/cache.ts'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

const TTL = 30 * 60 * 1000 // 30 min

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* corps vide */
  }
  const ingredients: string[] = Array.isArray(body.ingredients)
    ? body.ingredients.filter((x: unknown) => typeof x === 'string').slice(0, 60)
    : []
  const expiring: string[] = Array.isArray(body.expiring)
    ? body.expiring.filter((x: unknown) => typeof x === 'string').slice(0, 15)
    : []
  const constraints: string = typeof body.constraints === 'string' ? body.constraints.slice(0, 400) : ''
  const preferences: string[] = Array.isArray(body.preferences)
    ? body.preferences.filter((x: unknown) => typeof x === 'string').slice(0, 12)
    : []
  const diets: string[] = Array.isArray(body.diets)
    ? body.diets.filter((x: unknown) => typeof x === 'string').slice(0, 10)
    : []
  const nocache = body.nocache === true

  const key = cacheKey('recipe', { ingredients, expiring, constraints, preferences, diets })
  if (!nocache) {
    const hit = cacheGet<any>(key)
    if (hit) return json({ recipe: hit, cached: true })
  }

  const prompt = `Tu es un chef cuisinier. Propose UNE seule recette familiale réaliste,
en utilisant EN PRIORITÉ les ingrédients déjà disponibles ci-dessous (tu peux en ajouter
quelques-uns courants si nécessaire).

Ingrédients disponibles : ${ingredients.length ? ingredients.join(', ') : 'aucun en particulier'}.
${expiring.length ? `À écouler en priorité (périment bientôt) : ${expiring.join(', ')}.` : ''}
${diets.length ? `Membres de la famille et contraintes : ${diets.join(' ; ')}.
Définitions des régimes : pescétarien = pas de viande terrestre mais poisson et fruits de mer autorisés ; végétarien = ni viande ni poisson ; végétalien = aucun produit animal (ni œufs ni lait) ; flexitarien = mange de tout mais privilégie le végétal. Les mentions « sans gluten/lactose/… » sont des allergies/intolérances STRICTES.
Tu PEUX proposer un plat principal avec viande ou poisson. Mais pour chaque membre dont le régime ou l'allergie est incompatible, fournis une ALTERNATIVE concrète (ingrédient de remplacement) clairement indiquée dans les étapes, par ex. « Variante pour Emma (végétarienne) : remplacer le poulet par des pois chiches ». Respecte toujours les aversions.` : ''}
${preferences.length ? `Goûts de la famille (plats qu'ils cuisinent/aiment souvent) — inspire-toi de ce style sans forcément les répéter : ${preferences.join(', ')}.` : ''}
${constraints ? `Contraintes : ${constraints}.` : ''}

Réponds STRICTEMENT en JSON valide, sans aucun texte autour, avec ce schéma exact :
{"title": string, "timeMin": number, "cuisine": string, "tags": string[], "ingredients": [{"name": string, "qty": string}], "steps": string[]}
Les quantités sont pour 4 personnes. Le titre est court. timeMin est le temps total en minutes.`

  const res = await callClaude({ prompt, tier: 'smart', maxTokens: 1200 })
  if (!res.ok) return json({ error: res.detail }, res.status)

  const recipe = extractJson(res.text)
  if (!recipe || typeof recipe.title !== 'string') {
    return json({ error: 'Réponse illisible du modèle', raw: res.text }, 502)
  }

  const clean = {
    title: String(recipe.title).slice(0, 120),
    timeMin: Number(recipe.timeMin) || 0,
    cuisine: typeof recipe.cuisine === 'string' ? recipe.cuisine.slice(0, 60) : '',
    tags: Array.isArray(recipe.tags) ? recipe.tags.filter((t: unknown) => typeof t === 'string').slice(0, 8) : [],
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients
          .filter((i: any) => i && typeof i.name === 'string')
          .map((i: any) => ({ name: String(i.name).slice(0, 80), qty: i.qty ? String(i.qty).slice(0, 40) : undefined }))
          .slice(0, 40)
      : [],
    steps: Array.isArray(recipe.steps)
      ? recipe.steps.filter((s: unknown) => typeof s === 'string').map((s: string) => s.slice(0, 400)).slice(0, 25)
      : [],
  }

  cacheSet(key, clean, TTL)
  return json({ recipe: clean })
})
