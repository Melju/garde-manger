// Edge Function « costs » : estime ce que coûtent des recettes (part réellement utilisée de chaque
// ingrédient) et des articles de la liste de courses (prix d'achat du paquet).
//
// Sources, de la plus fiable à la moins fiable :
//  1. les prix relevés par le foyer (tickets, étiquettes), envoyés par l'app ;
//  2. Open Prices (Open Food Facts), prix collaboratifs France/Belgique, pour les articles avec code-barres ;
//  3. une estimation par l'IA (prix courant en supermarché, gamme standard).
// Rien n'est enregistré ici : l'app met les résultats en cache.

import { callClaude, extractJson } from '../_shared/claude.ts'
import { aiGate } from '../_shared/gate.ts'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

type Known = { name: string; store: string; price: number; unitPrice?: number | null; unitLabel?: string | null }
type RecipeIn = { id: string; title: string; servings?: number; ingredients: { name: string; qty?: string }[] }
type ItemIn = { key: string; name: string; qty?: string; barcode?: string }

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null
}

/** Prix médian d'un code-barres sur Open Prices (12 derniers mois, en euros). */
async function openPrice(code: string): Promise<{ price: number; n: number } | null> {
  try {
    const since = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10)
    const u = `https://prices.openfoodfacts.org/api/v1/prices?product_code=${encodeURIComponent(code)}&currency=EUR&date__gte=${since}&size=50&order_by=-date`
    const r = await fetch(u, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const d = await r.json()
    const prices = (d.items ?? []).map((i: any) => Number(i.price)).filter((p: number) => p > 0 && p < 500)
    const m = median(prices)
    return m ? { price: Math.round(m * 100) / 100, n: prices.length } : null
  } catch {
    return null
  }
}

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
  const recipes: RecipeIn[] = Array.isArray(body.recipes) ? body.recipes.slice(0, 12) : []
  const items: ItemIn[] = Array.isArray(body.items) ? body.items.slice(0, 60) : []
  const known: Known[] = Array.isArray(body.known) ? body.known.slice(0, 300) : []
  if (!recipes.length && !items.length) return json({ recipes: [], items: [] })

  // Open Prices pour les articles avec code-barres (en parallèle, 8 à la fois).
  const open = new Map<string, { price: number; n: number }>()
  const withCode = items.filter((i) => i.barcode && /^\d{8,14}$/.test(i.barcode))
  for (let i = 0; i < withCode.length; i += 8) {
    const batch = withCode.slice(i, i + 8)
    const res = await Promise.all(batch.map((it) => openPrice(it.barcode!)))
    batch.forEach((it, j) => res[j] && open.set(it.key, res[j]!))
  }

  const knownTxt = known
    .map((k) => `${k.name} | ${k.store} | ${k.price.toFixed(2)} €${k.unitPrice ? ` | ${k.unitPrice.toFixed(2)} ${k.unitLabel ?? ''}` : ''}`)
    .join('\n')
  const recipesTxt = recipes
    .map(
      (r) =>
        `RECETTE ${r.id} « ${r.title} » pour ${r.servings ?? 4} :\n` +
        r.ingredients.map((g) => `- ${g.name}${g.qty ? ` : ${g.qty}` : ''}`).join('\n'),
    )
    .join('\n\n')
  const itemsTxt = items
    .filter((i) => !open.has(i.key))
    .map((i) => `${i.key} | ${i.name}${i.qty ? ` | ${i.qty}` : ''}`)
    .join('\n')

  const prompt = `Tu estimes des prix de courses alimentaires en supermarché (France / Belgique, gamme standard, ni premier prix ni bio, ${new Date().getFullYear()}).

PRIX RÉELS RELEVÉS PAR LE FOYER (nom | magasin | prix du paquet | prix au kilo ou au litre) :
${knownTxt || '(aucun)'}

${recipes.length ? `RECETTES : pour chaque ingrédient, donne le coût de la QUANTITÉ UTILISÉE dans la recette (au prorata du paquet : 2 œufs = 2/6 d'une boîte de 6). Sel, poivre, épices, huile en petite quantité : coût de quelques centimes.\n${recipesTxt}\n` : ''}
${itemsTxt ? `ARTICLES DE LA LISTE DE COURSES (clé | nom | quantité) : donne le prix d'ACHAT pour cette quantité (prix du paquet le plus courant).\n${itemsTxt}\n` : ''}
Règles :
- Si un prix réel du foyer correspond clairement à l'ingrédient ou à l'article, utilise-le (src "ticket"), sinon estime (src "estimation").
- Montants en euros, nombres décimaux, réalistes.

Réponds STRICTEMENT en JSON :
{"recipes":[{"id":string,"lines":[{"name":string,"cost":number,"src":"ticket"|"estimation"}]}],"items":[{"key":string,"price":number,"src":"ticket"|"estimation"}]}`

  const needAi = recipes.length || itemsTxt
  let parsed: any = { recipes: [], items: [] }
  if (needAi) {
    const res = await callClaude({ apiKey: gate.apiKey, prompt, tier: 'fast', maxTokens: 3500 })
    if (!res.ok) return json({ error: res.detail }, res.status)
    parsed = extractJson(res.text) ?? parsed
  }

  const num = (v: unknown) => (isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 1000 ? Math.round(Number(v) * 100) / 100 : 0)
  const ids = new Set(recipes.map((r) => r.id))
  const outRecipes = (Array.isArray(parsed.recipes) ? parsed.recipes : [])
    .filter((r: any) => r && ids.has(r.id))
    .map((r: any) => {
      const lines = (Array.isArray(r.lines) ? r.lines : []).map((l: any) => ({
        name: String(l.name ?? '').slice(0, 80),
        cost: num(l.cost),
        src: l.src === 'ticket' ? 'ticket' : 'estimation',
      }))
      const total = Math.round(lines.reduce((s: number, l: any) => s + l.cost, 0) * 100) / 100
      return { id: r.id, total, lines }
    })
  const keys = new Set(items.map((i) => i.key))
  const outItems = [
    ...[...open.entries()].map(([key, v]) => ({ key, price: v.price, src: 'openprices', n: v.n })),
    ...(Array.isArray(parsed.items) ? parsed.items : [])
      .filter((i: any) => i && keys.has(i.key) && !open.has(i.key))
      .map((i: any) => ({ key: i.key, price: num(i.price), src: i.src === 'ticket' ? 'ticket' : 'estimation' })),
  ]
  return json({ recipes: outRecipes, items: outItems })
})
