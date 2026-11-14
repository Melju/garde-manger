import type { HistoryEntry } from '../types'
import { addDays, toISODate } from './dates'

/** Quantité d'une entrée d'historique (meta.qty, sinon « ×n » du libellé, sinon 1). */
function qtyOf(h: HistoryEntry): number {
  if (h.meta?.qty && h.meta.qty > 0) return h.meta.qty
  const m = h.label.match(/×\s*(\d+)/)
  return m ? Number(m[1]) : 1
}

export function nameOf(h: HistoryEntry): string {
  return (h.meta?.name ?? h.label.replace(/\s+(consommé|jeté).*$/i, '')).trim()
}

export interface ConsumptionEvent {
  id: string
  date: string
  at: string
  name: string
  qty: number
}

/** Toutes les consommations, de la plus récente à la plus ancienne. */
export function consumptionEvents(history: HistoryEntry[]): ConsumptionEvent[] {
  return history
    .filter((h) => h.kind === 'consomme')
    .map((h) => ({ id: h.id, date: h.date, at: h.at, name: nameOf(h), qty: qtyOf(h) }))
    .sort((a, b) => b.at.localeCompare(a.at))
}

export interface Bucket {
  key: string
  /** Libellé court sous la barre. */
  label: string
  value: number
}

/** Quantités consommées par jour sur les `days` derniers jours (aujourd'hui inclus). */
export function dailySeries(events: ConsumptionEvent[], days = 30): Bucket[] {
  const sums = new Map<string, number>()
  for (const e of events) sums.set(e.date, (sums.get(e.date) ?? 0) + e.qty)
  const today = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i - (days - 1))
    const key = toISODate(d)
    return { key, label: String(d.getDate()), value: sums.get(key) ?? 0 }
  })
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

/** Quantités consommées par mois sur les `months` derniers mois (mois courant inclus). */
export function monthlySeries(events: ConsumptionEvent[], months = 12): Bucket[] {
  const sums = new Map<string, number>()
  for (const e of events) {
    const k = e.date.slice(0, 7)
    sums.set(k, (sums.get(k) ?? 0) + e.qty)
  }
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, label: MONTH_INITIALS[d.getMonth()], value: sums.get(key) ?? 0 }
  })
}

/** Produits les plus consommés parmi des événements. */
export function topProducts(events: ConsumptionEvent[], n = 5): { name: string; qty: number }[] {
  const m = new Map<string, { name: string; qty: number }>()
  for (const e of events) {
    const k = e.name.toLowerCase()
    const cur = m.get(k)
    if (cur) cur.qty += e.qty
    else m.set(k, { name: e.name, qty: e.qty })
  }
  return [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, n)
}

/** Variation en % entre deux totaux (null si pas de base de comparaison). */
export function trendPct(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
