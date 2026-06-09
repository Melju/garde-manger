import type {
  BudgetConfig,
  Expense,
  FamilyMember,
  HistoryEntry,
  MealPlan,
  Product,
  ProductInput,
  Recipe,
  Settings,
  ShopCatalogEntry,
  ShoppingItem,
  ShoppingItemInput,
} from '../types'

/**
 * Contrat d'accès aux données, indépendant du backend.
 * L'implémentation actuelle est LocalStorage ; une implémentation Supabase
 * pourra la remplacer sans toucher au reste de l'application.
 *
 * Les produits et les courses utilisent des opérations fines (héritage v1).
 * Les autres collections utilisent un schéma get/save (lecture complète /
 * écriture complète), plus simple et tout aussi facile à porter sur Supabase.
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
  updateShoppingItem(id: string, patch: Partial<ShoppingItemInput>): Promise<void>
  toggleShoppingItem(id: string): Promise<ShoppingItem | null>
  removeShoppingItem(id: string): Promise<void>
  clearCheckedShopping(): Promise<void>

  // Recettes
  getRecipes(): Promise<Recipe[]>
  saveRecipes(recipes: Recipe[]): Promise<void>

  // Famille
  getFamily(): Promise<FamilyMember[]>
  saveFamily(members: FamilyMember[]): Promise<void>

  // Planning des repas
  getMealPlan(): Promise<MealPlan>
  saveMealPlan(plan: MealPlan): Promise<void>

  // Historique
  getHistory(): Promise<HistoryEntry[]>
  saveHistory(entries: HistoryEntry[]): Promise<void>
  removeHistory(id: string): Promise<void>

  // Dépenses
  getExpenses(): Promise<Expense[]>
  saveExpenses(expenses: Expense[]): Promise<void>

  // Budget
  getBudget(): Promise<BudgetConfig>
  saveBudget(config: BudgetConfig): Promise<void>

  // Paramètres
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>

  // Catalogue d'apprentissage des courses (partagé au foyer en cloud)
  getShopCatalog(): Promise<ShopCatalogEntry[]>
  saveShopCatalog(entries: ShopCatalogEntry[]): Promise<void>

  /** Réinitialise toutes les données au jeu de démonstration. */
  resetDemo(): Promise<void>
}

/** Génère un identifiant unique simple. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
