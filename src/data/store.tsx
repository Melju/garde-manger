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
  Category,
  Expense,
  FamilyMember,
  FamilyMemberInput,
  HistoryEntry,
  HistoryKind,
  MealPlan,
  Product,
  ProductInput,
  Recipe,
  RecipeInput,
  Settings,
  ShopCatalogEntry,
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
import { lookupBarcode } from '../lib/openfoodfacts'

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
  /** true si les données sont synchronisées dans le cloud (connecté + foyer). */
  cloudMode: boolean
  /** Copie les produits/courses du stockage local de cet appareil vers le cloud. */
  importLocalData(): Promise<number>
  /** Complète les infos manquantes (photo, Nutri-Score, allergènes…) des produits ayant un code-barres, via Open Food Facts. */
  refreshFromOFF(): Promise<{ updated: number; scanned: number }>

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

  // Catalogue d'apprentissage des courses
  shopCatalog: ShopCatalogEntry[]
  recordShopItem(name: string, category: Category, unit: string, qty: number): Promise<void>

  // Recettes
  addRecipe(input: RecipeInput): Promise<Recipe>
  /** Génère une recette via Claude (edge function) à partir du stock. */
  generateRecipe(constraints?: string): Promise<Recipe>
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
  const [shopCatalog, setShopCatalog] = useState<ShopCatalogEntry[]>([])
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
    const [p, s, r, f, m, h, e, b, st, sc] = await Promise.all([
      repo.listProducts(),
      repo.listShopping(),
      repo.getRecipes(),
      repo.getFamily(),
      repo.getMealPlan(),
      repo.getHistory(),
      repo.getExpenses(),
      repo.getBudget(),
      repo.getSettings(),
      repo.getShopCatalog(),
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
    setShopCatalog(sc)
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
      cloudMode: Boolean(supabase && auth.householdId),

      async importLocalData() {
        if (!(supabase && auth.householdId)) return 0
        const local = new LocalStorageRepository()
        const [lp, ls] = await Promise.all([local.listProducts(), local.listShopping()])
        for (const p of lp) {
          await repo.addProduct({
            name: p.name,
            category: p.category,
            quantity: p.quantity,
            unit: p.unit,
            size: p.size,
            expiryDate: p.expiryDate,
            price: p.price,
            barcode: p.barcode,
          })
        }
        for (const s of ls) {
          await repo.addShoppingItem({
            name: s.name,
            category: s.category,
            quantity: s.quantity,
            unit: s.unit,
            source: s.source,
          })
        }
        setProducts(await repo.listProducts())
        setShopping(await repo.listShopping())
        return lp.length + ls.length
      },

      async refreshFromOFF() {
        const withBarcode = products.filter((p) => p.barcode)
        let updated = 0
        for (const p of withBarcode) {
          // On saute ceux déjà complets.
          if (p.imageUrl && p.nutriscore && p.kcal != null && p.allergens) continue
          const { prefill: pf } = await lookupBarcode(p.barcode as string)
          const patch: Partial<ProductInput> = {}
          if (!p.imageUrl && pf.imageUrl) patch.imageUrl = pf.imageUrl
          if (!p.nutriscore && pf.nutriscore) patch.nutriscore = pf.nutriscore
          if (p.nova == null && pf.nova != null) patch.nova = pf.nova
          if (p.kcal == null && pf.kcal != null) patch.kcal = pf.kcal
          if ((!p.allergens || !p.allergens.length) && pf.allergens) patch.allergens = pf.allergens
          if (!p.size && pf.size) patch.size = pf.size
          if (Object.keys(patch).length) {
            await repo.updateProduct(p.id, patch)
            updated++
          }
        }
        if (updated) setProducts(await repo.listProducts())
        return { updated, scanned: withBarcode.length }
      },

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

      shopCatalog,
      async recordShopItem(name, category, unit, qty) {
        const k = name.trim().toLowerCase()
        if (!k) return
        const prev = shopCatalog.find((e) => e.name.trim().toLowerCase() === k)
        const entry: ShopCatalogEntry = {
          name: name.trim(),
          category,
          unit,
          qty,
          count: (prev?.count ?? 0) + 1,
          at: new Date().toISOString(),
        }
        const next = [entry, ...shopCatalog.filter((e) => e.name.trim().toLowerCase() !== k)]
        setShopCatalog(next)
        await repo.saveShopCatalog(next)
      },
      async addRecipe(input) {
        const recipe: Recipe = { ...input, id: newId() }
        const next = [recipe, ...recipes]
        setRecipes(next)
        await repo.saveRecipes(next)
        return recipe
      },
      async generateRecipe(constraints) {
        if (!supabase) throw new Error('Connecte-toi pour utiliser la génération IA')
        const ingredients = products.map((p) => p.name)
        const { data, error } = await supabase.functions.invoke('recipe', {
          body: { ingredients, constraints },
        })
        if (error) throw new Error(error.message || 'Génération impossible')
        const r = (data as any)?.recipe
        if (!r?.title) throw new Error((data as any)?.error || 'Réponse invalide')
        const input: RecipeInput = {
          title: r.title,
          timeMin: Number(r.timeMin) || 0,
          cuisine: r.cuisine || undefined,
          tags: Array.isArray(r.tags) ? [...new Set([...r.tags, 'ia'])] : ['ia'],
          favorite: false,
          ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
          steps: Array.isArray(r.steps) ? r.steps : undefined,
        }
        const recipe: Recipe = { ...input, id: newId() }
        const next = [recipe, ...recipes]
        setRecipes(next)
        await repo.saveRecipes(next)
        return recipe
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
  }, [repo, products, shopping, recipes, family, mealPlan, history, expenses, shopCatalog, budget, settings, loading, loadAll])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore doit être utilisé dans un <StoreProvider>')
  return ctx
}

export { AVATAR_COLORS }
