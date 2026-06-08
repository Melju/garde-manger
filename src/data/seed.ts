import type { Product, ShoppingItem } from '../types'
import { newId } from './repository'

/** Renvoie une date ISO (YYYY-MM-DD) décalée de `days` jours par rapport à aujourd'hui. */
function inDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const now = new Date().toISOString()

/** Jeu de données de démonstration, chargé au premier lancement. */
export function seedProducts(): Product[] {
  const make = (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product => ({
    ...p,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  })
  return [
    make({ name: 'Yaourts nature', category: 'frais', quantity: 2, unit: 'packs', expiryDate: inDays(1) }),
    make({ name: 'Crème fraîche', category: 'frais', quantity: 1, size: '20cl', expiryDate: inDays(2) }),
    make({ name: 'Poulet', category: 'frais', quantity: 1, size: '500g', expiryDate: inDays(3) }),
    make({ name: 'Comté 18 mois', category: 'frais', quantity: 1, size: '200g', expiryDate: inDays(7) }),
    make({ name: 'Tomates pelées Mutti', category: 'conserves', quantity: 4, size: '400g', expiryDate: inDays(720) }),
    make({ name: 'Spaghetti n°5 Barilla', category: 'epicerie', quantity: 2, size: '500g', expiryDate: inDays(540) }),
    make({ name: 'Riz basmati', category: 'epicerie', quantity: 3, size: '1kg', expiryDate: inDays(400) }),
    make({ name: 'Petits pois', category: 'surgeles', quantity: 2, size: '750g', expiryDate: inDays(300) }),
    make({ name: 'Lait demi-écrémé', category: 'frais', quantity: 6, unit: 'briques', expiryDate: inDays(20) }),
    make({ name: 'Œufs', category: 'frais', quantity: 12, expiryDate: inDays(12) }),
  ]
}

/** Liste de courses de démonstration. */
export function seedShopping(): ShoppingItem[] {
  return [
    {
      id: newId(),
      name: 'Beurre doux',
      category: 'frais',
      quantity: 1,
      checked: false,
      source: 'manuel',
      createdAt: now,
    },
    {
      id: newId(),
      name: 'Farine T55',
      category: 'epicerie',
      quantity: 1,
      unit: 'kg',
      checked: false,
      source: 'manuel',
      createdAt: now,
    },
  ]
}
