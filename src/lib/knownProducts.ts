import type { Category, HistoryEntry, Product } from '../types'

/** Produit déjà connu du foyer (en stock ou acheté avant), pour reconnaître les lignes d'un ticket. */
export interface KnownProduct {
  name: string
  brand?: string
  category: Category
  size?: string
  location?: string
  conservation?: Product['conservation']
  dateType?: Product['dateType']
  imageUrl?: string
  barcode?: string
}

const MAX = 350

const key = (name: string, brand?: string) =>
  `${(brand ?? '').trim().toLowerCase()}|${name.trim().toLowerCase()}`

/**
 * Catalogue des produits connus : d'abord ceux du stock (fiche complète), puis ceux déjà
 * consommés ou jetés (historique). Les plus récents d'abord, limité pour garder un prompt léger.
 */
export function buildKnownCatalog(products: Product[], history: HistoryEntry[]): KnownProduct[] {
  const out = new Map<string, KnownProduct>()
  const sorted = [...products].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
  for (const p of sorted) {
    if (!p.name?.trim()) continue
    const k = key(p.name, p.brand)
    if (out.has(k)) continue
    out.set(k, {
      name: p.name.trim(),
      brand: p.brand?.trim() || undefined,
      category: p.category,
      size: p.size || undefined,
      location: p.location,
      conservation: p.conservation,
      dateType: p.dateType,
      imageUrl: p.imageUrl,
      barcode: p.barcode,
    })
  }
  const names = new Set([...out.values()].map((k) => k.name.toLowerCase()))
  for (const h of [...history].sort((a, b) => b.at.localeCompare(a.at))) {
    const n = h.meta?.name?.trim()
    if (!n || names.has(n.toLowerCase()) || !h.meta?.category) continue
    names.add(n.toLowerCase())
    out.set(key(n), { name: n, category: h.meta.category })
  }
  return [...out.values()].slice(0, MAX)
}

/** Libellé envoyé à l'IA : « Pim's orange · LU · 150 g ». */
export function knownLabel(k: KnownProduct): string {
  return [k.name, k.brand, k.size].filter(Boolean).join(' · ').slice(0, 90)
}
