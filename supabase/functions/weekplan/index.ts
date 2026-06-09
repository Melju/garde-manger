// Edge Function « weekplan » : génère un menu de la semaine (midi/soir) via Claude,
// en tenant compte du stock, des produits à écouler, des régimes/allergies et des goûts.
// Tier « smart » (créatif). Pas de cache (chaque semaine est unique).

import { callClaude, extractJson } from '../_shared/claude.ts'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* vide */
  }
  const stock: string[] = Array.isArray(body.stock) ? body.stock.filter((x: unknown) => typeof x === 'string').slice(0, 50) : []
  const expiring: string[] = Array.isArray(body.expiring) ? body.expiring.filter((x: unknown) => typeof x === 'string').slice(0, 15) : []
  const preferences: string[] = Array.isArray(body.preferences) ? body.preferences.filter((x: unknown) => typeof x === 'string').slice(0, 12) : []
  const diets: string[] = Array.isArray(body.diets) ? body.diets.filter((x: unknown) => typeof x === 'string').slice(0, 10) : []

  const prompt = `Tu es un chef qui planifie les repas d'une famille pour la semaine (7 jours, midi et soir).

Stock disponible : ${stock.length ? stock.join(', ') : 'varié'}.
${expiring.length ? `À écouler en priorité (périment bientôt) : ${expiring.join(', ')}.` : ''}
${diets.length ? `Membres de la famille et contraintes : ${diets.join(' ; ')}.
Définitions : pescétarien = pas de viande terrestre mais poisson et fruits de mer autorisés ; végétarien = ni viande ni poisson ; végétalien = aucun produit animal ; flexitarien = mange de tout, privilégie le végétal. « sans gluten/lactose/… » = allergies strictes.
Tu peux prévoir des plats avec viande/poisson, mais propose une alternative pour les membres incompatibles (ex. version végétarienne).` : ''}
${preferences.length ? `Goûts / plats fréquents : ${preferences.join(', ')}.` : ''}

Propose un menu varié et réaliste : des plats simples en semaine, un peu plus élaborés le week-end,
évite de répéter le même plat, équilibre légumes/féculents/protéines, et utilise en priorité le stock
et les produits à écouler.

Réponds STRICTEMENT en JSON valide, sans texte autour. "day" = 0 (Lundi) à 6 (Dimanche),
"slot" = "midi" ou "soir", "title" = nom court du repas :
{"meals":[{"day":0,"slot":"midi","title":"…"},{"day":0,"slot":"soir","title":"…"}, … 14 entrées]}`

  const res = await callClaude({ prompt, tier: 'smart', maxTokens: 2000 })
  if (!res.ok) return json({ error: res.detail }, res.status)

  const parsed = extractJson(res.text)
  const raw = Array.isArray(parsed?.meals) ? parsed.meals : []
  const meals = raw
    .filter((m: any) => m && typeof m.title === 'string' && m.title.trim())
    .map((m: any) => ({
      day: Math.max(0, Math.min(6, Math.round(Number(m.day) || 0))),
      slot: m.slot === 'soir' ? 'soir' : 'midi',
      title: String(m.title).slice(0, 80).trim(),
    }))
    .slice(0, 14)

  return json({ meals, days: DAYS })
})
