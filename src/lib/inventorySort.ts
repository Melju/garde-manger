import type { Product } from '../types'
import { CATEGORIES } from '../types'
import { expiryStatus, type ExpiryStatus } from './expiry'

export type InventorySort = 'expiry' | 'category' | 'added' | 'name'

export const SORT_OPTIONS: { value: InventorySort; label: string }[] = [
  { value: 'expiry', label: 'Date de péremption' },
  { value: 'category', label: 'Catégorie' },
  { value: 'added', label: "Date d'ajout" },
  { value: 'name', label: 'Nom (A → Z)' },
]

const KEY = 'miamm.inventory.sort.default'

/** Tri par défaut du stock (réglage par appareil). */
export function defaultSort(): InventorySort {
  try {
    const v = localStorage.getItem(KEY) as InventorySort | null
    return v && SORT_OPTIONS.some((o) => o.value === v) ? v : 'added'
  } catch {
    return 'added'
  }
}
export function setDefaultSort(v: InventorySort) {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* ignore */
  }
}

const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
const catIndex = new Map(CATEGORIES.map((c, i) => [c.id, i]))

/** Trie le stock ; à égalité, par nom pour garder les produits identiques côte à côte. */
export function sortProducts(list: Product[], sort: InventorySort): Product[] {
  const arr = [...list]
  switch (sort) {
    case 'expiry': {
      // Périmés d'abord, puis « encore bon » (DDM ou congelé dépassé), puis le reste par date ; sans date à la fin.
      const rank: Record<ExpiryStatus, number> = { expired: 0, 'still-good': 1, urgent: 2, soon: 2, ok: 2, none: 3 }
      const st = new Map(arr.map((p) => [p.id, expiryStatus(p)]))
      return arr.sort(
        (a, b) =>
          rank[st.get(a.id)!] - rank[st.get(b.id)!] ||
          (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '') ||
          byName(a, b),
      )
    }
    case 'category':
      return arr.sort((a, b) => (catIndex.get(a.category) ?? 99) - (catIndex.get(b.category) ?? 99) || byName(a, b))
    case 'name':
      return arr.sort(byName)
    case 'added':
    default:
      return arr.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || byName(a, b))
  }
}
