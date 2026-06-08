import type { Category } from '../types'

/** Article appris : mémorise catégorie, unité, dernière quantité et fréquence. */
export interface ShopEntry {
  name: string
  category: Category
  /** Unité brute mémorisée (g, kg, L, mL… ou '' pour un nombre). */
  unit: string
  /** Dernière quantité saisie (dans l'unité de base). */
  qty: number
  /** Nombre d'ajouts (pour le tri par fréquence). */
  count: number
  /** Dernier ajout (ISO). */
  at: string
}

const KEY = 'gm.shopcat'

/** Charge le catalogue d'apprentissage (par appareil). */
export function loadShopCatalog(): Record<string, ShopEntry> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, ShopEntry>) : {}
  } catch {
    return {}
  }
}

/** Mémorise un ajout : incrémente la fréquence, retient unité + quantité. */
export function recordShopItem(
  name: string,
  category: Category,
  unit: string,
  qty: number,
): void {
  try {
    const map = loadShopCatalog()
    const k = name.trim().toLowerCase()
    if (!k) return
    const prev = map[k]
    map[k] = {
      name: name.trim(),
      category,
      unit,
      qty,
      count: (prev?.count ?? 0) + 1,
      at: new Date().toISOString(),
    }
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // stockage indisponible : on ignore (l'apprentissage est best-effort)
  }
}
