import type { Product } from '../types'

/** Statut de péremption d'un produit. */
export type ExpiryStatus = 'urgent' | 'soon' | 'ok' | 'expired' | 'none'

const MS_PER_DAY = 1000 * 60 * 60 * 24

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
 */
export function expiryStatus(product: Product, now: Date = new Date()): ExpiryStatus {
  const days = daysUntilExpiry(product, now)
  if (days === null) return 'none'
  if (days < 0) return 'expired'
  if (days <= 3) return 'urgent'
  if (days <= 14) return 'soon'
  return 'ok'
}

/** Libellé court pour le tag de statut (ex: « Demain », « 3 jours », « Périmé »). */
export function expiryLabel(product: Product, now: Date = new Date()): string {
  const days = daysUntilExpiry(product, now)
  if (days === null) return '—'
  if (days < 0) return `Périmé (${Math.abs(days)}j)`
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
