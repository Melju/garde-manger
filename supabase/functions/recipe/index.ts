// Edge Function « recipe » : génère une recette à partir du stock via l'API Claude.
// La clé API n'est jamais dans l'app : elle est lue depuis l'environnement serveur
// (ANTHROPIC_API_KEY). Le routeur principal vérifie déjà le JWT de l'utilisateur.

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-3-5-haiku-latest'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Extrait le premier objet JSON d'un texte (au cas où le modèle l'enrobe). */
function extractJson(text: string): any | null {
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0])
      } catch {
        /* ignore */
      }
    }
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)
  if (!ANTHROPIC_KEY) return json({ error: 'Clé API non configurée côté serveur' }, 500)

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

  const prompt = `Tu es un chef cuisinier. Propose UNE seule recette familiale réaliste,
en utilisant EN PRIORITÉ les ingrédients déjà disponibles ci-dessous (tu peux en ajouter
quelques-uns courants si nécessaire).

Ingrédients disponibles : ${ingredients.length ? ingredients.join(', ') : 'aucun en particulier'}.
${expiring.length ? `À écouler en priorité (périment bientôt) : ${expiring.join(', ')}.` : ''}
${constraints ? `Contraintes : ${constraints}.` : ''}

Réponds STRICTEMENT en JSON valide, sans aucun texte autour, avec ce schéma exact :
{"title": string, "timeMin": number, "cuisine": string, "tags": string[], "ingredients": [{"name": string, "qty": string}], "steps": string[]}
Les quantités sont pour 4 personnes. Le titre est court. timeMin est le temps total en minutes.`

  let resp: Response
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (e) {
    return json({ error: 'Appel Anthropic impossible', detail: String(e) }, 502)
  }

  if (!resp.ok) {
    const detail = await resp.text()
    return json({ error: `Anthropic ${resp.status}`, detail }, 502)
  }

  const data = await resp.json()
  const text: string = data?.content?.[0]?.text ?? ''
  const recipe = extractJson(text)
  if (!recipe || typeof recipe.title !== 'string') {
    return json({ error: 'Réponse illisible du modèle', raw: text }, 502)
  }

  // Normalisation défensive.
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

  return json({ recipe: clean })
})
