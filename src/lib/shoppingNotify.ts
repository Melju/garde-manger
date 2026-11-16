import { supabase } from '../data/supabaseClient'

/** Fonction Vercel qui envoie la notification aux autres membres du foyer. */
const ENDPOINT = 'https://garde-manger-eosin.vercel.app/api/push-shopping'
const DELAY = 20_000 // on regroupe les ajouts faits à la suite en une seule notification

let pending: string[] = []
let timer: number | undefined

async function flush(keepalive = false) {
  window.clearTimeout(timer)
  timer = undefined
  const items = [...new Set(pending)]
  pending = []
  if (!items.length || !supabase) return
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      keepalive,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    })
  } catch {
    /* notification perdue : sans gravité */
  }
}

/** Signale des articles ajoutés à la liste de courses (envoi groupé après 20 s de calme). */
export function notifyShoppingAdded(names: string[]) {
  if (!names.length) return
  pending.push(...names)
  window.clearTimeout(timer)
  timer = window.setTimeout(() => void flush(), DELAY)
}

if (typeof document !== 'undefined') {
  // L'appli passe en arrière-plan : on envoie tout de suite ce qui attend.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && pending.length) void flush(true)
  })
}
