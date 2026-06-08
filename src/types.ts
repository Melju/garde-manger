// Modèle de données métier de l'application Garde-Manger.

/** Catégories de rangement d'un produit. */
export type Category = 'frais' | 'conserves' | 'epicerie' | 'surgeles'

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'frais', label: 'Frais' },
  { id: 'conserves', label: 'Conserves' },
  { id: 'epicerie', label: 'Épicerie' },
  { id: 'surgeles', label: 'Surgelés' },
]

export const CATEGORY_LABELS: Record<Category, string> = {
  frais: 'Frais',
  conserves: 'Conserves',
  epicerie: 'Épicerie',
  surgeles: 'Surgelés',
}

/** Mode de conservation / emplacement. */
export type Storage = 'placard' | 'frigo' | 'congelateur'

export const STORAGES: { id: Storage; label: string }[] = [
  { id: 'placard', label: 'Placard' },
  { id: 'frigo', label: 'Réfrigérateur' },
  { id: 'congelateur', label: 'Congélateur' },
]

export const STORAGE_LABELS: Record<Storage, string> = {
  placard: 'Placard',
  frigo: 'Réfrigérateur',
  congelateur: 'Congélateur',
}

/** Emplacement par défaut déduit de la catégorie. */
export function defaultStorage(category: Category): Storage {
  if (category === 'surgeles') return 'congelateur'
  if (category === 'frais') return 'frigo'
  return 'placard'
}

/** Un produit présent dans le garde-manger. */
export interface Product {
  id: string
  name: string
  category: Category
  /** Quantité en stock (nombre d'unités). */
  quantity: number
  /** Unité affichée à côté de la quantité (ex: « g », « packs », « ml »). Optionnel. */
  unit?: string
  /** Conditionnement / taille (ex: « 400g », « 500g »). Texte libre, optionnel. */
  size?: string
  /** Date de péremption au format ISO (YYYY-MM-DD). Optionnel. */
  expiryDate?: string
  /** Prix unitaire en euros, optionnel (pour le budget plus tard). */
  price?: number
  /** Code-barres EAN/UPC, optionnel (renseigné via le scan). */
  barcode?: string
  /** Emplacement de conservation (influe sur l'estimation de péremption). */
  storage?: Storage
  /** Horodatages ISO. */
  createdAt: string
  updatedAt: string
}

/** Un article de la liste de courses. */
export interface ShoppingItem {
  id: string
  name: string
  category: Category
  quantity: number
  unit?: string
  checked: boolean
  /** Origine de l'ajout : manuel ou généré automatiquement. */
  source: 'manuel' | 'auto'
  createdAt: string
}

/** Données saisies dans le formulaire de produit (sans les champs système). */
export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>

/** Données saisies pour un article de courses. */
export type ShoppingItemInput = Omit<ShoppingItem, 'id' | 'createdAt' | 'checked'>

// ===== Recettes =====

export interface RecipeIngredient {
  name: string
  /** Quantité affichée (texte libre : « 400g », « 3 gousses »). */
  qty?: string
}

export interface Recipe {
  id: string
  title: string
  /** Temps de préparation en minutes. */
  timeMin: number
  /** Type de cuisine ou libellé court (ex : « Italien », « Rapide »). */
  cuisine?: string
  /** Étiquettes : 'rapide', 'vegetarien', 'vegetalien', 'sans-gluten'… */
  tags: string[]
  favorite: boolean
  ingredients: RecipeIngredient[]
  /** Étapes de préparation, optionnel. */
  steps?: string[]
}

export type RecipeInput = Omit<Recipe, 'id'>

// ===== Famille =====

export type Diet = 'omnivore' | 'vegetarien' | 'vegetalien' | 'pescetarien' | 'flexitarien'

export const DIETS: { id: Diet; label: string }[] = [
  { id: 'omnivore', label: 'Omnivore' },
  { id: 'vegetarien', label: 'Végétarien' },
  { id: 'vegetalien', label: 'Végétalien' },
  { id: 'pescetarien', label: 'Pescétarien' },
  { id: 'flexitarien', label: 'Flexitarien' },
]

export const DIET_LABELS: Record<Diet, string> = {
  omnivore: 'Omnivore',
  vegetarien: 'Végétarien',
  vegetalien: 'Végétalien',
  pescetarien: 'Pescétarien',
  flexitarien: 'Flexitarien',
}

export const RESTRICTIONS = [
  'Sans gluten',
  'Sans lactose',
  'Sans œufs',
  'Sans fruits à coque',
  'Sans fruits de mer',
  'Sans porc',
] as const

export interface FamilyMember {
  id: string
  name: string
  diet: Diet
  restrictions: string[]
  aversions?: string
  /** Couleur de l'avatar (dégradé CSS ou couleur unie). */
  color: string
}

export type FamilyMemberInput = Omit<FamilyMember, 'id'>

// ===== Planning des repas =====

export type MealSlot = 'midi' | 'soir'

export const MEAL_SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'midi', label: 'Midi' },
  { id: 'soir', label: 'Soir' },
]

/** Plan de repas : clé `${dateISO}_${slot}` → intitulé du repas. */
export type MealPlan = Record<string, string>

// ===== Historique =====

export type HistoryKind = 'consomme' | 'jete' | 'ajoute' | 'prepare'

export interface HistoryEntry {
  id: string
  /** Date ISO (YYYY-MM-DD). */
  date: string
  /** Horodatage ISO complet pour l'heure affichée. */
  at: string
  kind: HistoryKind
  label: string
  /** Valeur monétaire associée (€), pour les économies/dépenses. */
  amount?: number
}

// ===== Budget / dépenses =====

export interface Expense {
  id: string
  date: string
  category: Category
  label: string
  amount: number
}

export interface BudgetConfig {
  /** Plafond mensuel en euros. */
  monthlyLimit: number
}

// ===== Paramètres =====

export interface Settings {
  notifExpiry: boolean
  notifLowStock: boolean
  /** Seuil de « stock bas » (quantité ≤ seuil). */
  lowStockThreshold: number
}
