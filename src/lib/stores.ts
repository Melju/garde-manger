import type { Category } from '../types'
import { normalize } from './productIcon'

/**
 * Magasin courant + habitudes d'achat par magasin.
 * Stockage local (localStorage) : le magasin se renseigne une fois, il reste choisi jusqu'à changement.
 */
const LS_CUR = 'miamm.store.current'
const LS_LIST = 'miamm.store.list'
const LS_HABITS = 'miamm.store.habits.v1'

export const PRESET_STORES = [
  'Colruyt', 'Delhaize', 'Carrefour', 'Lidl', 'Aldi', 'Intermarché', 'Leclerc', 'Auchan', 'Cora', 'Match',
]

export interface Habit {
  name: string
  category: Category
  unit: string
  qty: number
  count: number
  at: string
}
type HabitMap = Record<string, Record<string, Habit>>

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export function getCurrentStore(): string {
  return read<string>(LS_CUR, '')
}
export function setCurrentStore(name: string) {
  write(LS_CUR, name)
}
export function getStores(): string[] {
  const custom = read<string[]>(LS_LIST, [])
  return [...new Set([...custom, ...PRESET_STORES])]
}
export function addStore(name: string) {
  const n = name.trim()
  if (!n) return
  const custom = read<string[]>(LS_LIST, [])
  if (!getStores().some((s) => normalize(s) === normalize(n))) write(LS_LIST, [n, ...custom])
}

/** Mémorise que ces articles ont été achetés dans ce magasin. */
export function recordPurchases(
  store: string,
  items: { name: string; category: Category; unit?: string; quantity?: number }[],
) {
  if (!store) return
  const all = read<HabitMap>(LS_HABITS, {})
  const mine = (all[store] ??= {})
  const now = new Date().toISOString()
  for (const it of items) {
    const k = normalize(it.name).trim()
    if (!k) continue
    const prev = mine[k]
    mine[k] = {
      name: it.name.trim(),
      category: it.category,
      unit: it.unit ?? prev?.unit ?? '',
      qty: it.quantity ?? prev?.qty ?? 1,
      count: (prev?.count ?? 0) + 1,
      at: now,
    }
  }
  write(LS_HABITS, all)
}

export function habitsFor(store: string): Habit[] {
  if (!store) return []
  const mine = read<HabitMap>(LS_HABITS, {})[store] ?? {}
  return Object.values(mine).sort((a, b) => b.count - a.count || b.at.localeCompare(a.at))
}

export function isUsualAt(store: string, name: string): number {
  if (!store) return 0
  const mine = read<HabitMap>(LS_HABITS, {})[store] ?? {}
  return mine[normalize(name).trim()]?.count ?? 0
}

/** Magasins où ce produit est acheté d'habitude. */
export function storesFor(name: string): string[] {
  const k = normalize(name).trim()
  if (!k) return []
  const all = read<HabitMap>(LS_HABITS, {})
  return Object.keys(all).filter((s) => all[s][k])
}

/** Définit les magasins d'un produit (ajoute ceux cochés, retire les autres). */
export function setProductStores(
  name: string,
  category: Category,
  unit: string | undefined,
  quantity: number | undefined,
  stores: string[],
) {
  const k = normalize(name).trim()
  if (!k) return
  const all = read<HabitMap>(LS_HABITS, {})
  for (const s of Object.keys(all)) {
    if (!stores.includes(s) && all[s][k]) delete all[s][k]
  }
  const now = new Date().toISOString()
  for (const s of stores) {
    const mine = (all[s] ??= {})
    const prev = mine[k]
    mine[k] = {
      name: name.trim(),
      category,
      unit: unit ?? prev?.unit ?? '',
      qty: quantity ?? prev?.qty ?? 1,
      count: Math.max(prev?.count ?? 0, 1),
      at: prev?.at ?? now,
    }
  }
  write(LS_HABITS, all)
}
