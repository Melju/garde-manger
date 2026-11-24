// Edge Function « voice » : transforme une phrase dite à voix haute (« ajoute du lait aux courses »,
// « enlève 200 g de comté », « j'ai fini les yaourts ») en actions précises sur le stock et la liste
// de courses du foyer. Le client envoie un résumé du stock et de la liste ; on renvoie des actions
// qui citent les identifiants exacts. Rien n'est appliqué ici : l'app demande confirmation.

import { callClaude, extractJson } from '../_shared/claude.ts'
import { aiGate } from '../_shared/gate.ts'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

const CATEGORIES = 'fruits, legumes, viandes, viandes-vg, poissons, laitiers, epicerie, huiles, conserves, sucreries, patisserie, apero, boissons, surgeles, maison, pharmacie, autre'
const UNITS = ['', 'g', 'kg', 'mL', 'cL', 'L']
const TYPES = ['shop_add', 'shop_remove', 'stock_add', 'stock_remove', 'stock_finish', 'stock_open', 'stock_waste', 'ask']

type StockLine = { id: string; name: string; brand?: string; qty: number; size?: string; opened?: boolean; exp?: string; place?: string }
type ShopLine = { id: string; name: string; qty?: string }

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
  const text: string = typeof body.text === 'string' ? body.text.slice(0, 600).trim() : ''
  if (!text) return json({ error: 'Rien entendu' }, 400)
  const stock: StockLine[] = Array.isArray(body.stock) ? body.stock.slice(0, 400) : []
  const shopping: ShopLine[] = Array.isArray(body.shopping) ? body.shopping.slice(0, 200) : []

  const stockTxt = stock
    .map((p) => `${p.id} | ${p.name}${p.brand ? ` (${p.brand})` : ''} | ×${p.qty}${p.size ? ` | ${p.size}` : ''}${p.opened ? ' | ouvert' : ''}${p.exp ? ` | à consommer avant ${p.exp}` : ''}${p.place ? ` | ${p.place}` : ''}`)
    .join('\n')
  const shopTxt = shopping.map((s) => `${s.id} | ${s.name}${s.qty ? ` | ${s.qty}` : ''}`).join('\n')

  const prompt = `Tu es l'assistant vocal d'une appli de garde-manger familiale. L'utilisateur a dit (transcription automatique, fautes possibles) :
"""${text}"""

STOCK actuel (id | nom | nombre d'exemplaires | contenance restante/d'origine | état | date | emplacement). Nous sommes le ${new Date().toISOString().slice(0, 10)} :
${stockTxt || '(vide)'}

LISTE DE COURSES actuelle (id | nom | quantité) :
${shopTxt || '(vide)'}

Traduis la demande en actions. Types possibles :
- shop_add : ajouter à la liste de courses. Champs : name, quantity (nombre), unit (${UNITS.map((u) => `"${u}"`).join(',')}; "" = à l'unité), category (une parmi [${CATEGORIES}]).
- shop_remove : retirer un article de la liste de courses. Champ : id (de la LISTE).
- stock_add : l'utilisateur a acheté / range un produit dans le stock. Champs : name, quantity, unit, category.
- stock_remove : il a utilisé une partie. Champs : id (du STOCK), amount (nombre), unit ("" = exemplaires, sinon g/kg/mL/cL/L).
- stock_finish : produit terminé / fini / plus de … Champ : id.
- stock_open : produit ouvert / entamé. Champ : id.
- stock_waste : jeté / périmé / pourri. Champ : id.
- ask : demande ambiguë (plusieurs produits du stock correspondent et rien ne permet de choisir). Champs : question (courte), options : [{id, label}] (2 à 5 ids du STOCK), then (l'action voulue : stock_remove, stock_finish, stock_open ou stock_waste), amount et unit si then = stock_remove.

Règles :
- Utilise uniquement des id présents ci-dessus pour shop_remove et les actions stock_*. Rapproche les noms intelligemment (« comté » → « Comté AOP 18 mois », pluriels, fautes de transcription).
- Si un seul produit correspond, choisis-le sans demander. Préfère un exemplaire déjà ouvert pour stock_remove / stock_finish.
- « ajoute X » sans précision = liste de courses (shop_add). « j'ai acheté / je range X » = stock_add.
- « enlève X de la liste » = shop_remove. « enlève 200 g de X » / « j'ai utilisé » = stock_remove.
- Un produit absent du stock pour une action stock_* : ne l'invente pas, ajoute-le à "unknown".
- N'ajoute pas aux courses un article déjà présent dans la LISTE : signale-le dans reply.
- Plusieurs demandes dans une phrase = plusieurs actions, dans l'ordre.
- label : une phrase très courte en français décrivant l'action (ex « Lait 2 L aux courses », « −200 g de Comté »).
- Si l'utilisateur POSE UNE QUESTION (« est-ce que j'ai encore du beurre ? », « il reste combien d'œufs ? », « qu'est-ce qui périme bientôt ? », « c'est sur la liste ? »), ne crée aucune action : réponds dans "reply" en t'appuyant uniquement sur le STOCK et la LISTE ci-dessus (quantités, contenance restante, ouvert ou non).
- "reply" : toujours présent. Une ou deux phrases naturelles, au tutoiement, qui seront LUES À VOIX HAUTE : soit la réponse à la question, soit la confirmation de ce qui va être fait (ex « C'est noté, j'ajoute 2 litres de lait et des pommes à la liste de courses. »). Pas d'emoji, pas de liste, pas d'identifiants, orthographe soignée. S'il faut choisir (ask), pose la question.

Réponds STRICTEMENT en JSON, sans texte autour :
{"reply":string,"actions":[{"type":string,"label":string, ...champs}],"unknown":[string]}`

  const res = await callClaude({ apiKey: gate.apiKey, prompt, tier: 'fast', maxTokens: 1200 })
  if (!res.ok) return json({ error: res.detail }, res.status)
  const parsed = extractJson(res.text)

  const stockIds = new Set(stock.map((p) => p.id))
  const shopIds = new Set(shopping.map((s) => s.id))
  const cats = CATEGORIES.split(', ')
  const num = (v: unknown, d: number) => (isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d)
  const unit = (v: unknown) => (typeof v === 'string' && UNITS.includes(v) ? v : '')
  const str = (v: unknown, n = 80) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

  const actions = (Array.isArray(parsed?.actions) ? parsed.actions : [])
    .filter((a: any) => a && TYPES.includes(a.type))
    .map((a: any) => {
      const label = str(a.label, 90)
      switch (a.type) {
        case 'shop_add':
        case 'stock_add':
          return str(a.name)
            ? { type: a.type, label, name: str(a.name), quantity: num(a.quantity, 1), unit: unit(a.unit), category: cats.includes(a.category) ? a.category : 'autre' }
            : null
        case 'shop_remove':
          return shopIds.has(a.id) ? { type: a.type, label, id: a.id } : null
        case 'stock_remove':
          return stockIds.has(a.id) ? { type: a.type, label, id: a.id, amount: num(a.amount, 1), unit: unit(a.unit) } : null
        case 'stock_finish':
        case 'stock_open':
        case 'stock_waste':
          return stockIds.has(a.id) ? { type: a.type, label, id: a.id } : null
        case 'ask': {
          const options = (Array.isArray(a.options) ? a.options : [])
            .filter((o: any) => o && stockIds.has(o.id))
            .map((o: any) => ({ id: o.id, label: str(o.label, 60) }))
            .slice(0, 5)
          const then = ['stock_remove', 'stock_finish', 'stock_open', 'stock_waste'].includes(a.then) ? a.then : 'stock_finish'
          return options.length >= 2
            ? { type: 'ask', label, question: str(a.question, 120) || label, options, then, amount: num(a.amount, 1), unit: unit(a.unit) }
            : null
        }
      }
      return null
    })
    .filter(Boolean)
    .slice(0, 20)
  const unknown = (Array.isArray(parsed?.unknown) ? parsed.unknown : []).map((u: unknown) => str(u, 60)).filter(Boolean).slice(0, 10)

  const reply = str(parsed?.reply, 400)
  return json({ reply, actions, unknown })
})
