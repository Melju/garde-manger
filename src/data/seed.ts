import type {
  BudgetConfig,
  Expense,
  FamilyMember,
  HistoryEntry,
  MealPlan,
  Product,
  Recipe,
  Settings,
  ShoppingItem,
} from '../types'
import { newId } from './repository'
import { addDays, startOfWeek, toISODate } from '../lib/dates'

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

/** Recettes de démonstration. */
export function seedRecipes(): Recipe[] {
  return [
    {
      id: newId(),
      title: "Pasta all'arrabbiata",
      timeMin: 25,
      cuisine: 'Italien',
      tags: ['vegetarien'],
      favorite: true,
      ingredients: [
        { name: 'Spaghetti', qty: '400g' },
        { name: 'Tomates pelées', qty: '1 boîte' },
        { name: 'Ail', qty: '3 gousses' },
        { name: "Huile d'olive", qty: '3 c.s.' },
        { name: 'Piment', qty: '2' },
        { name: 'Persil frais', qty: '1 bouquet' },
      ],
      steps: [
        'Faire revenir l’ail et le piment dans l’huile.',
        'Ajouter les tomates, laisser mijoter 15 min.',
        'Cuire les pâtes al dente, mélanger et parsemer de persil.',
      ],
    },
    {
      id: newId(),
      title: 'Omelette aux herbes',
      timeMin: 10,
      cuisine: 'Rapide',
      tags: ['rapide', 'vegetarien'],
      favorite: false,
      ingredients: [
        { name: 'Œufs', qty: '6' },
        { name: 'Crème fraîche', qty: '2 c.s.' },
        { name: 'Herbes', qty: '1 poignée' },
      ],
    },
    {
      id: newId(),
      title: 'Salade César',
      timeMin: 15,
      cuisine: 'Frais',
      tags: ['rapide'],
      favorite: false,
      ingredients: [
        { name: 'Salade', qty: '1' },
        { name: 'Poulet', qty: '200g' },
        { name: 'Parmesan', qty: '50g' },
        { name: 'Croutons', qty: '1 poignée' },
      ],
    },
    {
      id: newId(),
      title: 'Gratin de courgettes',
      timeMin: 40,
      cuisine: 'Four',
      tags: ['vegetarien'],
      favorite: false,
      ingredients: [
        { name: 'Courgettes', qty: '3' },
        { name: 'Crème fraîche', qty: '20cl' },
        { name: 'Comté', qty: '100g' },
        { name: 'Œufs', qty: '2' },
      ],
    },
  ]
}

/** Membres de la famille de démonstration. */
export function seedFamily(): FamilyMember[] {
  const make = (m: Omit<FamilyMember, 'id'>): FamilyMember => ({ ...m, id: newId() })
  return [
    make({ name: 'Julien', diet: 'omnivore', restrictions: [], color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }),
    make({ name: 'Marie', diet: 'omnivore', restrictions: [], color: 'linear-gradient(135deg, #ec4899, #be185d)' }),
    make({ name: 'Paul', diet: 'vegetarien', restrictions: [], color: 'linear-gradient(135deg, #22c55e, #15803d)' }),
    make({ name: 'Emma', diet: 'omnivore', restrictions: ['Sans gluten'], color: 'linear-gradient(135deg, #f59e0b, #d97706)' }),
  ]
}

/** Plan de repas de démonstration (semaine en cours). */
export function seedMealPlan(): MealPlan {
  const monday = startOfWeek(new Date())
  const d = (n: number) => toISODate(addDays(monday, n))
  return {
    [`${d(0)}_midi`]: "Pasta all'arrabbiata",
    [`${d(0)}_soir`]: 'Gratin de courgettes',
    [`${d(1)}_soir`]: 'Salade César',
    [`${d(3)}_midi`]: 'Omelette aux herbes',
  }
}

/** Historique de démonstration (mois courant). */
export function seedHistory(): HistoryEntry[] {
  const make = (daysAgo: number, kind: HistoryEntry['kind'], label: string, amount?: number): HistoryEntry => {
    const date = addDays(new Date(), -daysAgo)
    return { id: newId(), date: toISODate(date), at: date.toISOString(), kind, label, amount }
  }
  return [
    make(0, 'consomme', 'Yaourts nature consommé (×1)', 0.5),
    make(1, 'prepare', "Pasta all'arrabbiata préparée"),
    make(2, 'consomme', 'Lait consommé (×1)', 1.1),
    make(3, 'jete', 'Salade jetée (périmée)'),
    make(5, 'consomme', 'Œufs consommés (×3)', 1.5),
    make(8, 'consomme', 'Comté consommé (×1)', 4),
    make(12, 'jete', 'Tomates jetées'),
  ]
}

/** Dépenses de démonstration (mois courant). */
export function seedExpenses(): Expense[] {
  const make = (daysAgo: number, category: Expense['category'], label: string, amount: number): Expense => ({
    id: newId(),
    date: toISODate(addDays(new Date(), -daysAgo)),
    category,
    label,
    amount,
  })
  return [
    make(1, 'frais', 'Courses Carrefour', 64),
    make(1, 'epicerie', 'Courses Carrefour', 38),
    make(6, 'frais', 'Marché', 41),
    make(6, 'epicerie', 'Épicerie', 22),
    make(10, 'surgeles', 'Picard', 28),
    make(14, 'conserves', 'Conserves', 19),
  ]
}

export function seedBudget(): BudgetConfig {
  return { monthlyLimit: 400 }
}

export function seedSettings(): Settings {
  return { notifExpiry: true, notifLowStock: true, lowStockThreshold: 1 }
}
