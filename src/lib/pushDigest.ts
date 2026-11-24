import type { Product, Settings } from '../types'
import { daysUntilExpiry, expiryStatus } from './expiry'

export interface Digest {
  title: string
  body: string
}

/**
 * Résumé quotidien envoyé en notification : produits à consommer vite (0 à 3 jours, ou périmés depuis 2 jours au plus),
 * plus le stock bas si activé. Renvoie null s'il n'y a rien à signaler (pas de notification « tout va bien »).
 * Réutilise expiryStatus : congelé, DDM et tolérances sont donc traités comme dans l'app.
 */
export function buildDigest(all: Product[], settings: Settings): Digest | null {
  // La pharmacie a son propre suivi : pas de « Doliprane à consommer vite » dans le résumé.
  const products = all.filter((p) => p.category !== 'pharmacie')
  const urgent: { name: string; days: number }[] = []
  if (settings.notifExpiry) {
    for (const p of products) {
      const st = expiryStatus(p)
      const d = daysUntilExpiry(p)
      if (d == null) continue
      if ((st === 'urgent' && d >= 0) || (st === 'expired' && d >= -2)) urgent.push({ name: p.name, days: d })
    }
    urgent.sort((a, b) => a.days - b.days)
  }
  const low = settings.notifLowStock ? products.filter((p) => p.quantity <= settings.lowStockThreshold).length : 0
  if (!urgent.length && !low) return null

  const when = (d: number) => (d < 0 ? 'périmé' : d === 0 ? "aujourd'hui" : d === 1 ? 'demain' : `dans ${d} j`)
  const parts: string[] = []
  if (urgent.length) {
    const shown = urgent.slice(0, 3).map((u) => `${u.name} (${when(u.days)})`)
    const more = urgent.length - shown.length
    parts.push(shown.join(', ') + (more > 0 ? ` et ${more} autre${more > 1 ? 's' : ''}` : ''))
  }
  if (low) parts.push(`${low} produit${low > 1 ? 's' : ''} en stock bas`)

  return {
    title: urgent.length ? `${urgent.length} produit${urgent.length > 1 ? 's' : ''} à consommer vite` : 'Stock bas',
    body: parts.join(' · '),
  }
}
