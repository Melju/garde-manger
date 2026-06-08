import type { Product, ProductInput, ShoppingItem, ShoppingItemInput } from '../types'

/**
 * Contrat d'accès aux données, indépendant du backend.
 * L'implémentation actuelle est LocalStorage ; une implémentation Supabase
 * pourra la remplacer sans toucher au reste de l'application.
 */
export interface Repository {
  // Produits
  listProducts(): Promise<Product[]>
  addProduct(input: ProductInput): Promise<Product>
  updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product>
  /** Modifie la quantité (delta peut être négatif). Supprime le produit si la quantité tombe à 0 ou moins. */
  adjustQuantity(id: string, delta: number): Promise<Product | null>
  removeProduct(id: string): Promise<void>

  // Liste de courses
  listShopping(): Promise<ShoppingItem[]>
  addShoppingItem(input: ShoppingItemInput): Promise<ShoppingItem>
  toggleShoppingItem(id: string): Promise<ShoppingItem | null>
  removeShoppingItem(id: string): Promise<void>
  clearCheckedShopping(): Promise<void>
}

/** Génère un identifiant unique simple. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
