import type { BudgetConfig, Category, Expense, HistoryEntry, Product, Settings } from '../types'
import { categoryLabel } from '../types'
import { daysUntilExpiry, expiryStatus, expiryLabel } from './expiry'
import { monthKey, toISODate } from './dates'

// ===== Notifications =====

export type NotifSeverity = 'danger' | 'warn' | 'success' | 'info'
export type NotifKind = 'peremption' | 'stock'

export interface Notification {
  id: string
  kind: NotifKind
  severity: NotifSeverity
  title: string
  desc: string
}

/** Génère les notifications à partir du stock et des préférences. */
export function buildNotifications(products: Product[], settings: Settings): Notification[] {
  const list: Notification[] = []

  if (settings.notifExpiry) {
    for (const p of products) {
      const status = expiryStatus(p)
      if (status === 'urgent' || status === 'expired') {
        const days = daysUntilExpiry(p)
        list.push({
          id: `exp-${p.id}`,
          kind: 'peremption',
          severity: status === 'expired' ? 'danger' : days! <= 1 ? 'danger' : 'warn',
          title:
            status === 'expired'
              ? `${p.name} est périmé`
              : `${p.name} expire ${days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} jours`}`,
          desc: `Il reste ×${p.quantity}${p.unit ? ' ' + p.unit : ''} à consommer`,
        })
      } else if (status === 'soon') {
        list.push({
          id: `exp-${p.id}`,
          kind: 'peremption',
          severity: 'warn',
          title: `${p.name} expire dans ${expiryLabel(p).toLowerCase()}`,
          desc: 'Pensez à le cuisiner bientôt',
        })
      }
    }
  }

  if (settings.notifLowStock) {
    for (const p of products) {
      if (p.quantity <= settings.lowStockThreshold) {
        list.push({
          id: `low-${p.id}`,
          kind: 'stock',
          severity: 'info',
          title: `Stock bas : ${p.name}`,
          desc: `Il ne reste que ×${p.quantity}${p.unit ? ' ' + p.unit : ''}`,
        })
      }
    }
  }

  // Les alertes de péremption d'abord (plus urgentes).
  const order: NotifSeverity[] = ['danger', 'warn', 'info', 'success']
  return list.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
}

// ===== Statistiques & anti-gaspi (mois courant) =====

export interface MonthlyStats {
  productsCount: number
  consumed: number
  wasted: number
  consumptionRate: number // %
  expenses: number // €
  savings: number // €
  co2: number // kg
  score: number // 0-100
  weekly: number[] // consommation par semaine du mois
}

export function monthlyStats(
  products: Product[],
  history: HistoryEntry[],
  expenses: Expense[],
  now: Date = new Date(),
): MonthlyStats {
  const mk = monthKey(toISODate(now))
  const monthHistory = history.filter((h) => monthKey(h.date) === mk)
  const consumed = monthHistory.filter((h) => h.kind === 'consomme').length
  const wasted = monthHistory.filter((h) => h.kind === 'jete').length
  const prepared = monthHistory.filter((h) => h.kind === 'prepare').length

  const totalOutcome = consumed + wasted
  const consumptionRate = totalOutcome === 0 ? 100 : Math.round((consumed / totalOutcome) * 100)
  const score = consumptionRate

  const monthExpenses = expenses.filter((e) => monthKey(e.date) === mk)
  const expensesTotal = monthExpenses.reduce((s, e) => s + e.amount, 0)

  // Économies : valeur des produits consommés (à défaut, estimation 2,5 €/produit sauvé).
  const savings = monthHistory
    .filter((h) => h.kind === 'consomme')
    .reduce((s, h) => s + (h.amount ?? 2.5), 0)

  // CO₂ évité estimé : ~0,9 kg par produit sauvé du gaspillage.
  const co2 = Math.round(consumed * 0.9 * 10) / 10

  // Consommation par semaine du mois (jusqu'à 5 semaines).
  const weekly = computeWeekly(monthHistory, now)

  return {
    productsCount: products.length,
    consumed: consumed + prepared,
    wasted,
    consumptionRate,
    expenses: Math.round(expensesTotal),
    savings: Math.round(savings),
    co2,
    score,
    weekly,
  }
}

function computeWeekly(monthHistory: HistoryEntry[], now: Date): number[] {
  const weeks = [0, 0, 0, 0, 0]
  for (const h of monthHistory) {
    if (h.kind !== 'consomme' && h.kind !== 'prepare') continue
    const day = new Date(h.date + 'T00:00:00').getDate()
    const idx = Math.min(4, Math.floor((day - 1) / 7))
    weeks[idx]++
  }
  // Ne garder que les semaines pertinentes du mois courant.
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const nbWeeks = Math.ceil(daysInMonth / 7)
  return weeks.slice(0, nbWeeks)
}

// ===== Budget =====

export interface BudgetSummary {
  limit: number
  spent: number
  remaining: number
  ratio: number // 0-1
  daysLeft: number
  byCategory: { category: Category; label: string; amount: number; ratio: number }[]
}

export function budgetSummary(
  expenses: Expense[],
  config: BudgetConfig,
  now: Date = new Date(),
): BudgetSummary {
  const mk = monthKey(toISODate(now))
  const monthExpenses = expenses.filter((e) => monthKey(e.date) === mk)
  const spent = monthExpenses.reduce((s, e) => s + e.amount, 0)
  const limit = config.monthlyLimit
  const remaining = limit - spent
  const ratio = limit > 0 ? Math.min(1, spent / limit) : 0

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = daysInMonth - now.getDate()

  const totals = new Map<Category, number>()
  for (const e of monthExpenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount)
  const maxCat = Math.max(1, ...totals.values())
  const byCategory = [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      label: categoryLabel(category),
      amount: Math.round(amount),
      ratio: amount / maxCat,
    }))
    .sort((a, b) => b.amount - a.amount)

  return {
    limit,
    spent: Math.round(spent),
    remaining: Math.round(remaining),
    ratio,
    daysLeft,
    byCategory,
  }
}
