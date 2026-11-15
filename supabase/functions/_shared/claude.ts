// Helper partagé pour appeler l'API Claude avec le bon modèle selon l'usage.
// - tier 'smart' → modèle créatif (recettes) : ANTHROPIC_MODEL_SMART (ou ANTHROPIC_MODEL)
// - tier 'fast'  → modèle économique (tâches utilitaires) : ANTHROPIC_MODEL_FAST
// La clé API est lue uniquement côté serveur (ANTHROPIC_API_KEY).

function env(name: string): string | undefined {
  const v = Deno.env.get(name)
  return v && v.trim() ? v.trim() : undefined
}

const KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SMART = env('ANTHROPIC_MODEL_SMART') ?? env('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5'
const FAST = env('ANTHROPIC_MODEL_FAST') ?? 'claude-haiku-4-5'

export type Tier = 'smart' | 'fast'

export function modelFor(tier: Tier): string {
  return tier === 'fast' ? FAST : SMART
}

export function hasKey(): boolean {
  return Boolean(KEY)
}

export type ClaudeResult =
  | { ok: true; text: string }
  | { ok: false; status: number; detail: string }

/** Appelle Claude et renvoie le texte de la réponse, ou une erreur structurée. */
export async function callClaude(opts: {
  /** Clé Anthropic du foyer (sinon la clé du serveur). */
  apiKey?: string
  prompt: string
  tier?: Tier
  maxTokens?: number
  system?: string
  /** Images jointes (vision) : data base64 (sans préfixe) + type MIME. */
  images?: { data: string; mediaType: string }[]
}): Promise<ClaudeResult> {
  const key = opts.apiKey ?? KEY
  if (!key) return { ok: false, status: 500, detail: 'Clé API non configurée côté serveur' }
  const model = modelFor(opts.tier ?? 'smart')
  const content: unknown[] = []
  for (const img of opts.images ?? []) {
    if (img.mediaType === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: img.data } })
    } else {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })
    }
  }
  content.push({ type: 'text', text: opts.prompt })
  let resp: Response
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: 'user', content }],
      }),
    })
  } catch (e) {
    return { ok: false, status: 502, detail: `Appel Anthropic impossible : ${String(e)}` }
  }
  if (!resp.ok) {
    if (opts.apiKey && (resp.status === 401 || resp.status === 403)) {
      return { ok: false, status: 502, detail: 'Ta clé Anthropic est refusée : vérifie-la dans Compte' }
    }
    return { ok: false, status: 502, detail: `Anthropic ${resp.status} : ${await resp.text()}` }
  }
  const data = await resp.json()
  const text: string = data?.content?.[0]?.text ?? ''
  return { ok: true, text }
}

/** Extrait le premier objet JSON d'un texte (au cas où le modèle l'enrobe). */
export function extractJson(text: string): any | null {
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
