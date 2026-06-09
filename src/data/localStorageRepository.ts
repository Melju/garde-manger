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
import { newId, type Repository } from './repository'
import {
  seedBudget,
  seedExpenses,
  seedFamily,
  seedHistory,
  seedMealPlan,
  seedProducts,
  seedRecipes,
  seedSettings,
  seedShopping,
} from './seed'

const PRODUCTS_KEY = 'gm.products'
const SHOPPING_KEY = 'gm.shopping'
const RECIPES_KEY = 'gm.recipes'
const FAMILY_KEY = 'gm.family'
const MEALPLAN_KEY = 'gm.mealplan'
const HISTORY_KEY = 'gm.history'
const EXPENSES_KEY = 'gm.expenses'
const BUDGET_KEY = 'gm.budget'
const SETTINGS_KEY = 'gm.settings'
const SHOPCAT_KEY = 'gm.shopcatalog'
const SEEDED_KEY = 'gm.seeded'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/**
 * Implémentation du Repository basée sur LocalStorage.
 * Les méthodes sont asynchrones pour rester compatibles avec un futur backend (Supabase).
 */
export class LocalStorageRepository implements Repository {
  constructor() {
    // Plus de données démo : le local démarre vide. Il sert de stockage hors-ligne
    // et de filet de secours quand le cloud n'est pas disponible.
    // Nettoyage unique des anciennes données démo amorcées par les versions ≤ 2.
    if (localStorage.getItem(SEEDED_KEY) !== 'clean') {
      const wasSeeded = localStorage.getItem(SEEDED_KEY)
      if (wasSeeded === '1' || wasSeeded === '2') {
        for (const k of [
          PRODUCTS_KEY, SHOPPING_KEY, RECIPES_KEY, FAMILY_KEY,
          MEALPLAN_KEY, HISTORY_KEY, EXPENSES_KEY, BUDGET_KEY, SETTINGS_KEY,
        ]) {
          localStorage.removeItem(k)
        }
      }
      localStorage.setItem(SEEDED_KEY, 'clean')
    }
  }

  private seedAll() {
    write(PRODUCTS_KEY, seedProducts())
    write(SHOPPING_KEY, seedShopping())
    write(RECIPES_KEY, seedRecipes())
    write(FAMILY_KEY, seedFamily())
    write(MEALPLAN_KEY, seedMealPlan())
    write(HISTORY_KEY, seedHistory())
    write(EXPENSES_KEY, seedExpenses())
    write(BUDGET_KEY, seedBudget())
    write(SETTINGS_KEY, seedSettings())
  }

  async resetDemo(): Promise<void> {
    this.seedAll()
  }

  async listProducts(): Promise<Product[]> {
    return read<Product[]>(PRODUCTS_KEY, [])
  }

  async addProduct(input: ProductInput): Promise<Product> {
    const products = await this.listProducts()
    const ts = new Date().toISOString()
    const product: Product = { ...input, id: newId(), createdAt: ts, updatedAt: ts }
    write(PRODUCTS_KEY, [product, ...products])
    return product
  }

  async updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
    const products = await this.listProducts()
    let updated: Product | undefined
    const next = products.map((p) => {
      if (p.id !== id) return p
      updated = { ...p, ...patch, updatedAt: new Date().toISOString() }
      return updated
    })
    if (!updated) throw new Error(`Produit introuvable : ${id}`)
    write(PRODUCTS_KEY, next)
    return updated
  }

  async adjustQuantity(id: string, delta: number): Promise<Product | null> {
    const products = await this.listProducts()
    const target = products.find((p) => p.id === id)
    if (!target) return null
    const newQty = target.quantity + delta
    if (newQty <= 0) {
      write(PRODUCTS_KEY, products.filter((p) => p.id !== id))
      return null
    }
    return this.updateProduct(id, { quantity: newQty })
  }

  async removeProduct(id: string): Promise<void> {
    const products = await this.listProducts()
    write(PRODUCTS_KEY, products.filter((p) => p.id !== id))
  }

  async listShopping(): Promise<ShoppingItem[]> {
    return read<ShoppingItem[]>(SHOPPING_KEY, [])
  }

  async addShoppingItem(input: ShoppingItemInput): Promise<ShoppingItem> {
    const items = await this.listShopping()
    const item: ShoppingItem = {
      ...input,
      id: newId(),
      checked: false,
      createdAt: new Date().toISOString(),
    }
    write(SHOPPING_KEY, [item, ...items])
    return item
  }

  async updateShoppingItem(id: string, patch: Partial<ShoppingItemInput>): Promise<void> {
    const items = await this.listShopping()
    write(SHOPPING_KEY, items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  async toggleShoppingItem(id: string): Promise<ShoppingItem | null> {
    const items = await this.listShopping()
    let toggled: ShoppingItem | null = null
    const next = items.map((it) => {
      if (it.id !== id) return it
      toggled = { ...it, checked: !it.checked }
      return toggled
    })
    write(SHOPPING_KEY, next)
    return toggled
  }

  async removeShoppingItem(id: string): Promise<void> {
    const items = await this.listShopping()
    write(SHOPPING_KEY, items.filter((it) => it.id !== id))
  }

  async clearCheckedShopping(): Promise<void> {
    const items = await this.listShopping()
    write(SHOPPING_KEY, items.filter((it) => !it.checked))
  }

  async getRecipes(): Promise<Recipe[]> {
    return read<Recipe[]>(RECIPES_KEY, [])
  }
  async saveRecipes(recipes: Recipe[]): Promise<void> {
    write(RECIPES_KEY, recipes)
  }

  async getFamily(): Promise<FamilyMember[]> {
    return read<FamilyMember[]>(FAMILY_KEY, [])
  }
  async saveFamily(members: FamilyMember[]): Promise<void> {
    write(FAMILY_KEY, members)
  }

  async getMealPlan(): Promise<MealPlan> {
    return read<MealPlan>(MEALPLAN_KEY, {})
  }
  async saveMealPlan(plan: MealPlan): Promise<void> {
    write(MEALPLAN_KEY, plan)
  }

  async getHistory(): Promise<HistoryEntry[]> {
    return read<HistoryEntry[]>(HISTORY_KEY, [])
  }
  async saveHistory(entries: HistoryEntry[]): Promise<void> {
    write(HISTORY_KEY, entries)
  }
  async removeHistory(id: string): Promise<void> {
    write(HISTORY_KEY, read<HistoryEntry[]>(HISTORY_KEY, []).filter((h) => h.id !== id))
  }

  async getExpenses(): Promise<Expense[]> {
    return read<Expense[]>(EXPENSES_KEY, [])
  }
  async saveExpenses(expenses: Expense[]): Promise<void> {
    write(EXPENSES_KEY, expenses)
  }

  async getBudget(): Promise<BudgetConfig> {
    return read<BudgetConfig>(BUDGET_KEY, { monthlyLimit: 400 })
  }
  async saveBudget(config: BudgetConfig): Promise<void> {
    write(BUDGET_KEY, config)
  }

  async getSettings(): Promise<Settings> {
    return read<Settings>(SETTINGS_KEY, { notifExpiry: true, notifLowStock: true, lowStockThreshold: 1 })
  }
  async saveSettings(settings: Settings): Promise<void> {
    write(SETTINGS_KEY, settings)
  }

  async getShopCatalog(): Promise<ShopCatalogEntry[]> {
    return read<ShopCatalogEntry[]>(SHOPCAT_KEY, [])
  }
  async saveShopCatalog(entries: ShopCatalogEntry[]): Promise<void> {
    write(SHOPCAT_KEY, entries)
  }
}
