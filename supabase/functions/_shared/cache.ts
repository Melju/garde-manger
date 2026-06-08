// Cache mémoire simple avec TTL (par conteneur ; réinitialisé au redéploiement).
// Évite de repayer un appel Claude identique (même entrée) dans une fenêtre courte.

interface Entry {
  value: unknown
  expires: number
}

const store = new Map<string, Entry>()
const MAX = 200 // garde-fou mémoire

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key)
  if (!e) return null
  if (Date.now() > e.expires) {
    store.delete(key)
    return null
  }
  return e.value as T
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  if (store.size >= MAX) {
    // purge le plus ancien (Map conserve l'ordre d'insertion)
    const first = store.keys().next().value
    if (first !== undefined) store.delete(first)
  }
  store.set(key, { value, expires: Date.now() + ttlMs })
}

/** Clé stable à partir d'un objet (tri des clés pour l'indépendance d'ordre). */
export function cacheKey(prefix: string, obj: unknown): string {
  return prefix + ':' + JSON.stringify(obj, Object.keys(obj as object).sort())
}
