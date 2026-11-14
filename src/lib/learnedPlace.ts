import type { Category, Product } from '../types'
import { normalize } from './productIcon'
import { tokens } from './learnedShelf'

/**
 * Apprentissage du rangement : où l'utilisateur range habituellement un produit
 * (nom exact, noms proches, puis catégorie). Stockage local, nourri aussi par le stock.
 */
type Counts = Record<string, number>
interface Store {
  byName: Record<string, Counts>
  byCat: Record<string, Counts>
}
const LS_KEY = 'miamm.learnedPlace.v1'

function load(): Store {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Store) : { byName: {}, byCat: {} }
  } catch {
    return { byName: {}, byCat: {} }
  }
}
function save(s: Store) {
  try {
    const keys = Object.keys(s.byName)
    if (keys.length > 800) for (const k of keys.slice(0, keys.length - 800)) delete s.byName[k]
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}
function bump(map: Record<string, Counts>, key: string, loc: string) {
  const c = (map[key] ??= {})
  c[loc] = (c[loc] ?? 0) + 1
}
function top(c?: Counts): { loc: string; n: number; total: number } | null {
  if (!c) return null
  let best: string | null = null
  let total = 0
  for (const [l, n] of Object.entries(c)) {
    total += n
    if (best === null || n > c[best]) best = l
  }
  return best ? { loc: best, n: c[best], total } : null
}

export function learnPlace(name: string, category: Category, location?: string) {
  const loc = (location ?? '').trim()
  const key = normalize(name).trim()
  if (!loc || key.length < 2) return
  const s = load()
  bump(s.byName, key, loc)
  bump(s.byCat, category, loc)
  save(s)
}

/** Reconstruit les compteurs à partir du stock (prend le max pour ne rien perdre). */
export function seedPlaces(products: Product[]) {
  const s = load()
  const fresh: Store = { byName: {}, byCat: {} }
  for (const p of products) {
    const loc = (p.location ?? '').trim()
    const key = normalize(p.name).trim()
    if (!loc || key.length < 2) continue
    bump(fresh.byName, key, loc)
    bump(fresh.byCat, p.category, loc)
  }
  for (const [k, c] of Object.entries(fresh.byName)) for (const [l, n] of Object.entries(c)) s.byName[k] = { ...(s.byName[k] ?? {}), [l]: Math.max(n, s.byName[k]?.[l] ?? 0) }
  for (const [k, c] of Object.entries(fresh.byCat)) for (const [l, n] of Object.entries(c)) s.byCat[k] = { ...(s.byCat[k] ?? {}), [l]: Math.max(n, s.byCat[k]?.[l] ?? 0) }
  save(s)
}

/** Emplacement habituel : nom exact, noms proches (mots communs), puis catégorie (au moins 2 observations). */
export function placeFor(name: string, category: Category): { loc: string; source: 'name' | 'similar' | 'category' } | null {
  const s = load()
  const key = normalize(name).trim()
  const exact = top(s.byName[key])
  if (exact) return { loc: exact.loc, source: 'name' }
  const tk = tokens(name)
  if (tk.length) {
    const agg: Counts = {}
    for (const [k, c] of Object.entries(s.byName)) {
      const kt = tokens(k)
      const shared = tk.filter((t) => kt.includes(t)).length
      if (shared > 0 && shared / Math.min(tk.length, kt.length) >= 0.5) for (const [l, n] of Object.entries(c)) agg[l] = (agg[l] ?? 0) + n
    }
    const sim = top(agg)
    if (sim) return { loc: sim.loc, source: 'similar' }
  }
  const cat = top(s.byCat[category])
  if (cat && cat.total >= 2) return { loc: cat.loc, source: 'category' }
  return null
}

/** Valeur par défaut tant que rien n'a été appris. */
export function defaultPlace(category: Category): string {
  if (category === 'surgeles') return 'Congélateur'
  if (['viandes', 'poissons', 'laitiers', 'fruits', 'legumes'].includes(category)) return 'Réfrigérateur'
  if (['epicerie', 'conserves', 'sucreries', 'apero', 'boissons'].includes(category)) return 'Placard'
  return ''
}
