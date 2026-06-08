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
