// Modèle de données métier de l'application Garde-Manger.

/** Catégorie (type d'aliment) d'un produit. */
export type Category =
  | 'fruits'
  | 'legumes'
  | 'viandes'
  | 'viandes-vg'
  | 'poissons'
  | 'laitiers'
  | 'epicerie'
  | 'huiles'
  | 'conserves'
  | 'sucreries'
  | 'patisserie'
  | 'apero'
  | 'boissons'
  | 'surgeles'
  | 'maison'
  | 'autre'

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'fruits', label: 'Fruits' },
  { id: 'legumes', label: 'Légumes' },
  { id: 'viandes', label: 'Viandes' },
  { id: 'viandes-vg', label: 'Viandes VG' },
  { id: 'poissons', label: 'Poissons' },
  { id: 'laitiers', label: 'Laitiers' },
  { id: 'epicerie', label: 'Épicerie' },
  { id: 'huiles', label: 'Huiles' },
  { id: 'conserves', label: 'Conserves' },
  { id: 'sucreries', label: 'Sucreries' },
  { id: 'patisserie', label: 'Pâtisserie' },
  { id: 'apero', label: 'Apéro' },
  { id: 'boissons', label: 'Boissons' },
  { id: 'surgeles', label: 'Surgelés' },
  { id: 'maison', label: 'Maison' },
  { id: 'autre', label: 'Autre' },
]

const CAT_MAP: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]))

/** Libellé d'une catégorie, avec repli sur « Autre » pour les valeurs inconnues (anciennes données). */
export function categoryLabel(c: string): string {
  return CAT_MAP[c] ?? 'Autre'
}

/** @deprecated utiliser categoryLabel() — conservé pour compat. */
export const CATEGORY_LABELS = CAT_MAP as Record<Category, string>

/** Hors alimentaire (entretien, hygiène, animaux, divers) : ni date de péremption ni conservation à renseigner. */
export const isNonFood = (c: Category | string | undefined): boolean => c === 'maison'

/** Mode de conservation (influe sur l'estimation de péremption). */
export type Conservation = 'frais' | 'refrigere' | 'congele'

export const CONSERVATIONS: { id: Conservation; label: string }[] = [
  { id: 'frais', label: 'Frais' },
  { id: 'refrigere', label: 'Réfrigéré' },
  { id: 'congele', label: 'Congelé' },
]

/** Conservation par défaut déduite de la catégorie. */
export function defaultConservation(category: Category): Conservation {
  if (category === 'surgeles') return 'congele'
  if (['viandes', 'viandes-vg', 'poissons', 'laitiers', 'fruits', 'legumes'].includes(category)) return 'refrigere'
  return 'frais'
}

/** Type de date de péremption : DLC (limite stricte) ou DDM (préférence). */
export type DateType = 'dlc' | 'ddm'

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
  /** Marque du produit (ex : « Garden Gourmet »). Optionnel. */
  brand?: string
  /** Date de péremption au format ISO (YYYY-MM-DD). Optionnel. */
  expiryDate?: string
  /** Prix unitaire en euros, optionnel (pour le budget plus tard). */
  price?: number
  /** Code-barres EAN/UPC, optionnel (renseigné via le scan). */
  barcode?: string
  /** Mode de conservation (influe sur l'estimation de péremption). */
  conservation?: Conservation
  /** Type de date : DLC (limite stricte) ou DDM (préférence). */
  dateType?: DateType
  /** Emplacement libre (ex : « Placard cuisine »), optionnel. */
  location?: string
  /** Date d'ouverture (ISO) : le produit se garde alors moins longtemps. */
  openedAt?: string
  /** Membre qui a ajouté le produit (cloud uniquement). */
  createdBy?: string
  // ----- Données enrichies Open Food Facts (optionnelles) -----
  /** URL de la photo du produit. */
  imageUrl?: string
  /** Nutri-Score : 'a' à 'e'. */
  nutriscore?: string
  /** Groupe NOVA (degré de transformation) 1 à 4. */
  nova?: number
  /** Énergie en kcal pour 100 g/mL. */
  kcal?: number
  /** Allergènes (clés OFF normalisées : gluten, milk, eggs…). */
  allergens?: string[]
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

/** Article détecté sur un ticket de caisse (scan Claude Vision). */
export interface ReceiptItem {
  name: string
  quantity: number
  unit: string
  /** Contenance d'UN paquet (« 500 g », « 12 sachets ») si lisible. */
  size?: string | null
  price: number | null
  category: Category
}

/**
 * Article appris pour les courses (catégorie, unité, dernière quantité, fréquence).
 * Partagé au sein du foyer en mode cloud.
 */
export interface ShopCatalogEntry {
  name: string
  category: Category
  /** Unité brute mémorisée (g, kg, L, mL… ou '' pour un nombre). */
  unit: string
  /** Dernière quantité saisie (dans l'unité de base). */
  qty: number
  /** Nombre d'ajouts, pour le tri par fréquence. */
  count: number
  /** Dernier ajout (ISO). */
  at: string
}

// ===== Recettes =====

export interface RecipeIngredient {
  name: string
  /** Quantité affichée (texte libre : « 400g », « 3 gousses »). */
  qty?: string
  /** Produit choisi dans le stock. Absent = ingrédient générique, rapproché par nom dès qu'un produit correspond. */
  productId?: string
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
  /** Nombre de personnes pour lesquelles les quantités sont données. */
  servings?: number
  /** Unité de la quantité de base : « personnes » par défaut, ou « crêpes », « portions »… */
  servingsUnit?: string
  /** Icône choisie à la main (nom du fichier dans public/icons) ; sinon devinée. */
  icon?: string
  /** Notes libres : conservation, astuces, variantes. */
  notes?: string
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
  /** Avatar illustré choisi (ex : « animal-07 »), sinon l'initiale sur fond de couleur. */
  avatar?: string
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
  /** Données permettant d'annuler l'action (corriger une erreur). */
  meta?: {
    productId?: string
    name?: string
    qty?: number
    category?: Category
    conservation?: Conservation
  }
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
