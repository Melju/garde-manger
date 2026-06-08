import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  BudgetConfig,
  Expense,
  FamilyMember,
  FamilyMemberInput,
  HistoryEntry,
  HistoryKind,
  MealPlan,
  Product,
  ProductInput,
  Recipe,
  Settings,
  ShoppingItem,
  ShoppingItemInput,
} from '../types'
import { LocalStorageRepository } from './localStorageRepository'
import { SupabaseRepository } from './supabaseRepository'
import { supabase } from './supabaseClient'
import { useAuth } from './auth'
import { newId, type Repository } from './repository'
import { toISODate } from '../lib/dates'
import { isIngredientInStock } from '../lib/recipesLib'

interface StoreValue {
  products: Product[]
  shopping: ShoppingItem[]
  recipes: Recipe[]
  family: FamilyMember[]
  mealPlan: MealPlan
  history: HistoryEntry[]
  expenses: Expense[]
  budget: BudgetConfig
  settings: Settings
  loading: boolean

  // Produits
  addProduct(input: ProductInput): Promise<void>
  updateProduct(id: string, patch: Partial<ProductInput>): Promise<void>
  adjustQuantity(id: string, delta: number): Promise<void>
  removeProduct(id: string): Promise<void>
  wasteProduct(id: string): Promise<void>

  // Courses
  addShoppingItem(input: ShoppingItemInput): Promise<void>
  addManyShopping(inputs: ShoppingItemInput[]): Promise<number>
  toggleShoppingItem(id: string): Promise<void>
  removeShoppingItem(id: string): Promise<void>
  clearCheckedShopping(): Promise<void>

  // Recettes
  toggleFavorite(id: string): Promise<void>
  prepareRecipe(recipe: Recipe): Promise<void>

  // Famille
  addMember(input: FamilyMemberInput): Promise<void>
  updateMember(id: string, patch: Partial<FamilyMemberInput>): Promise<void>
  removeMember(id: string): Promise<void>

  // Planning
  setMeal(date: string, slot: string, value: string | null): Promise<void>

  // Budget / paramètres
  setBudgetLimit(limit: number): Promise<void>
  updateSettings(patch: Partial<Settings>): Promise<void>

  resetDemo(): Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

// Repository local (hors-ligne), utilisé tant qu'on n'est pas connecté à un foyer.
const localRepo: Repository = new LocalStorageRepository()

const AVATAR_COLORS = [
  'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'linear-gradient(135deg, #ec4899, #be185d)',
  'linear-gradient(135deg, #22c55e, #15803d)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'linear-gradient(135deg, #06b6d4, #0e7490)',
]

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [shopping, setShopping] = useState<ShoppingItem[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [family, setFamily] = useState<FamilyMember[]>([])
  const [mealPlan, setMealPlan] = useState<MealPlan>({})
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [budget, setBudget] = useState<BudgetConfig>({ monthlyLimit: 400 })
  const [settings, setSettings] = useState<Settings>({
    notifExpiry: true,
    notifLowStock: true,
    lowStockThreshold: 1,
  })
  const [loading, setLoading] = useState(true)

  const auth = useAuth()
  // Cloud (Supabase) si connecté avec un foyer, sinon stockage local.
  const repo = useMemo<Repository>(
    () => (supabase && auth.householdId ? new SupabaseRepository(supabase, auth.householdId) : localRepo),
    [auth.householdId],
  )

  const loadAll = useCallback(async () => {
    const [p, s, r, f, m, h, e, b, st] = await Promise.all([
      repo.listProducts(),
      repo.listShopping(),
      repo.getRecipes(),
      repo.getFamily(),
      repo.getMealPlan(),
      repo.getHistory(),
      repo.getExpenses(),
      repo.getBudget(),
      repo.getSettings(),
    ])
    setProducts(p)
    setShopping(s)
    setRecipes(r)
    setFamily(f)
    setMealPlan(m)
    setHistory(h)
    setExpenses(e)
    setBudget(b)
    setSettings(st)
  }, [repo])

  useEffect(() => {
    setLoading(true)
    loadAll().finally(() => setLoading(false))
  }, [loadAll])

  const value = useMemo<StoreValue>(() => {
    // Ajoute une entrée d'historique et met à jour l'état + le stockage.
    async function logHistory(kind: HistoryKind, label: string, amount?: number) {
      const now = new Date()
      const entry: HistoryEntry = {
        id: newId(),
        date: toISODate(now),
        at: now.toISOString(),
        kind,
        label,
        amount,
      }
      const next = [entry, ...(await repo.getHistory())]
      await repo.saveHistory(next)
      setHistory(next)
    }

    return {
      products,
      shopping,
      recipes,
      family,
      mealPlan,
      history,
      expenses,
      budget,
      settings,
      loading,

      async addProduct(input) {
        await repo.addProduct(input)
        setProducts(await repo.listProducts())
        await logHistory('ajoute', `${input.name} ajouté (×${input.quantity})`)
        // Si un prix est renseigné, on enregistre une dépense.
        if (input.price && input.price > 0) {
          const expense: Expense = {
            id: newId(),
            date: toISODate(new Date()),
            category: input.category,
            label: input.name,
            amount: input.price * input.quantity,
          }
          const next = [expense, ...(await repo.getExpenses())]
          await repo.saveExpenses(next)
          setExpenses(next)
        }
      },
      async updateProduct(id, patch) {
        await repo.updateProduct(id, patch)
        setProducts(await repo.listProducts())
      },
      async adjustQuantity(id, delta) {
        const before = products.find((p) => p.id === id)
        await repo.adjustQuantity(id, delta)
        setProducts(await repo.listProducts())
        if (delta < 0 && before) {
          await logHistory(
            'consomme',
            `${before.name} consommé (×${Math.min(-delta, before.quantity)})`,
            before.price ? before.price * Math.min(-delta, before.quantity) : undefined,
          )
        }
      },
      async removeProduct(id) {
        await repo.removeProduct(id)
        setProducts(await repo.listProducts())
      },
      async wasteProduct(id) {
        const before = products.find((p) => p.id === id)
        await repo.removeProduct(id)
        setProducts(await repo.listProducts())
        if (before) await logHistory('jete', `${before.name} jeté (périmé)`)
      },

      async addShoppingItem(input) {
        await repo.addShoppingItem(input)
        setShopping(await repo.listShopping())
      },
      async addManyShopping(inputs) {
        for (const input of inputs) await repo.addShoppingItem(input)
        setShopping(await repo.listShopping())
        return inputs.length
      },
      async toggleShoppingItem(id) {
        await repo.toggleShoppingItem(id)
        setShopping(await repo.listShopping())
      },
      async removeShoppingItem(id) {
        await repo.removeShoppingItem(id)
        setShopping(await repo.listShopping())
      },
      async clearCheckedShopping() {
        await repo.clearCheckedShopping()
        setShopping(await repo.listShopping())
      },

      async toggleFavorite(id) {
        const next = recipes.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r))
        setRecipes(next)
        await repo.saveRecipes(next)
      },
      async prepareRecipe(recipe) {
        // Décrémente d'1 chaque ingrédient présent en stock (sans log unitaire).
        for (const ing of recipe.ingredients) {
          if (isIngredientInStock(ing, products)) {
            const match = products.find((p) =>
              p.name.toLowerCase().includes(ing.name.toLowerCase().split(' ')[0]),
            )
            if (match) await repo.adjustQuantity(match.id, -1)
          }
        }
        setProducts(await repo.listProducts())
        await logHistory('prepare', `${recipe.title} préparée`)
      },

      async addMember(input) {
        const member: FamilyMember = { ...input, id: newId() }
        const next = [...family, member]
        setFamily(next)
        await repo.saveFamily(next)
      },
      async updateMember(id, patch) {
        const next = family.map((m) => (m.id === id ? { ...m, ...patch } : m))
        setFamily(next)
        await repo.saveFamily(next)
      },
      async removeMember(id) {
        const next = family.filter((m) => m.id !== id)
        setFamily(next)
        await repo.saveFamily(next)
      },

      async setMeal(date, slot, val) {
        const key = `${date}_${slot}`
        const next = { ...mealPlan }
        if (val && val.trim()) next[key] = val.trim()
        else delete next[key]
        setMealPlan(next)
        await repo.saveMealPlan(next)
      },

      async setBudgetLimit(limit) {
        const next = { monthlyLimit: limit }
        setBudget(next)
        await repo.saveBudget(next)
      },
      async updateSettings(patch) {
        const next = { ...settings, ...patch }
        setSettings(next)
        await repo.saveSettings(next)
      },

      async resetDemo() {
        await repo.resetDemo()
        await loadAll()
      },
    }
  }, [repo, products, shopping, recipes, family, mealPlan, history, expenses, budget, settings, loading, loadAll])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore doit être utilisé dans un <StoreProvider>')
  return ctx
}

export { AVATAR_COLORS }
