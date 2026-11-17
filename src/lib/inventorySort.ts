import type { Product } from '../types'
import { CATEGORIES } from '../types'

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
    case 'expiry':
      // Les plus urgents d'abord ; sans date, en fin de liste.
      return arr.sort((a, b) => {
        if (!a.expiryDate !== !b.expiryDate) return a.expiryDate ? -1 : 1
        return (a.expiryDate ?? '').localeCompare(b.expiryDate ?? '') || byName(a, b)
      })
    case 'category':
      return arr.sort((a, b) => (catIndex.get(a.category) ?? 99) - (catIndex.get(b.category) ?? 99) || byName(a, b))
    case 'name':
      return arr.sort(byName)
    case 'added':
    default:
      return arr.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || byName(a, b))
  }
}
