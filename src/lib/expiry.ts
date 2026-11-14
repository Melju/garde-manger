import type { Product } from '../types'
import { normalize } from './productIcon'

/** Statut de péremption d'un produit. */
export type ExpiryStatus = 'urgent' | 'soon' | 'ok' | 'expired' | 'still-good' | 'none'

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Tolérance par défaut (jours) après la date pour un produit congelé. */
export const FROZEN_GRACE_DAYS = 30

const GRACE_VEGETAL = ['vegan', 'veggie', 'tofu', 'seitan', 'tempeh', 'falafel', 'falafels', 'soja']
const GRACE_PREPARED = ['hache', 'hachee', 'marine', 'marines', 'nugget', 'nuggets', 'pane', 'panes', 'cordon', 'saucisse', 'saucisses', 'merguez', 'chipolata', 'burger', 'boulette', 'boulettes', 'tex', 'plat', 'pizza', 'lasagne', 'lasagnes', 'quiche', 'gratin', 'cuisine', 'cuisinee']

/**
 * Tolérance après la date d'un produit congelé (valeurs prudentes, la qualité baisse mais la sécurité reste) :
 * végétal 3 mois, viande/volaille en morceaux 3 mois, viande hachée / préparée / marinée 1 mois,
 * poisson 2 mois, légumes et fruits 6 mois.
 */
export function frozenGraceDays(product: Product): number {
  const words = normalize(product.name).split(/[^a-z0-9]+/).filter(Boolean)
  const has = (list: string[]) => words.some((w) => list.includes(w))
  if (has(GRACE_VEGETAL) || words.some((w) => w.startsWith('veget'))) return 90
  if (has(GRACE_PREPARED)) return 30
  switch (product.category) {
    case 'viandes':
    case 'viandes-vg':
      return 90
    case 'poissons':
      return 60
    case 'legumes':
    case 'fruits':
      return 180
    default:
      return FROZEN_GRACE_DAYS
  }
}

/** Produit rangé au congélateur (ou catégorie surgelés). */
export function isFrozen(product: Product): boolean {
  return product.location === 'Congélateur' || product.category === 'surgeles'
}

/** Nombre de jours (entier) avant péremption. Négatif si déjà périmé. null si pas de date. */
export function daysUntilExpiry(product: Product, now: Date = new Date()): number | null {
  if (!product.expiryDate) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const expiry = new Date(product.expiryDate + 'T00:00:00')
  return Math.round((expiry.getTime() - today.getTime()) / MS_PER_DAY)
}

/**
 * Statut de péremption :
 * - expired : date dépassée
 * - urgent  : périme dans 0 à 3 jours
 * - soon    : périme dans 4 à 14 jours
 * - ok      : périme dans plus de 14 jours
 * - none    : aucune date de péremption
 * Congelé : jamais « urgent », et tolérance après la date selon le type (« encore bon »).
 */
export function expiryStatus(product: Product, now: Date = new Date()): ExpiryStatus {
  const days = daysUntilExpiry(product, now)
  if (days === null) return 'none'
  // Congelé : pas d'urgence à l'approche de la date, et une tolérance après la date.
  if (isFrozen(product)) {
    if (days < -frozenGraceDays(product)) return 'expired'
    if (days < 0) return 'still-good'
    if (days <= 14) return 'soon'
    return 'ok'
  }
  // DDM (« à consommer de préférence ») : pas de danger une fois la date passée.
  if (product.dateType === 'ddm') {
    if (days < 0) return 'still-good'
    if (days <= 3) return 'soon'
    if (days <= 14) return 'soon'
    return 'ok'
  }
  if (days < 0) return 'expired'
  if (days <= 3) return 'urgent'
  if (days <= 14) return 'soon'
  return 'ok'
}

/** Libellé court pour le tag de statut (ex: « Demain », « 3 jours », « Périmé »). */
export function expiryLabel(product: Product, now: Date = new Date()): string {
  const days = daysUntilExpiry(product, now)
  if (days === null) return '—'
  if (isFrozen(product) && days < 0) {
    return days >= -frozenGraceDays(product) ? `Encore bon (${Math.abs(days)}j)` : `Périmé (${Math.abs(days)}j)`
  }
  if (days < 0) return product.dateType === 'ddm' ? 'Encore bon' : `Périmé (${Math.abs(days)}j)`
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Demain'
  if (days <= 30) return `${days} jours`
  const months = Math.round(days / 30)
  return `${months} mois`
}

/** Produits triés par urgence (le plus urgent en premier), filtrés sur urgent/soon/expired. */
export function priorityProducts(products: Product[], now: Date = new Date()): Product[] {
  return products
    .filter((p) => {
      const s = expiryStatus(p, now)
      // Un surgelé qui approche de sa date n'est pas une priorité (il se garde bien) : seulement s'il dépasse sa tolérance.
      if (isFrozen(p)) return s === 'expired'
      return s === 'urgent' || s === 'soon' || s === 'expired'
    })
    .sort((a, b) => {
      const da = daysUntilExpiry(a, now) ?? Infinity
      const db = daysUntilExpiry(b, now) ?? Infinity
      return da - db
    })
}

/** Nombre de produits réellement urgents (périme sous 3j ou déjà périmé). */
export function urgentCount(products: Product[], now: Date = new Date()): number {
  return products.filter((p) => {
    const s = expiryStatus(p, now)
    return s === 'urgent' || s === 'expired'
  }).length
}
