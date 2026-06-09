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
  ReceiptItem,
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
import { priorityProducts } from '../lib/expiry'
import { buildNotifications, type Notification } from '../lib/analytics'
import { DIET_LABELS } from '../types'
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
  /** true si le cloud est injoignable et qu'on affiche le dernier instantané (lecture seule). */
  offline: boolean
  /** Notifications actuelles (péremption, stock bas). */
  notifications: Notification[]
  /** Nombre de notifications non vues (pour le badge). */
  unreadNotifCount: number
  /** Marque toutes les notifications actuelles comme vues (efface le badge). */
  markNotificationsRead(): void
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
  generateRecipe(opts?: { constraints?: string; course?: string }): Promise<Recipe>
  /** Analyse la photo d'un ticket de caisse (Claude Vision) → articles détectés. */
  scanReceipt(image: string, mediaType: string): Promise<ReceiptItem[]>
  /** Transforme une liste tapée en vrac en articles structurés (Claude). */
  parseBulk(text: string): Promise<ReceiptItem[]>
  /** Génère un menu de la semaine (IA) pour les 7 dates fournies. Renvoie le nombre de repas planifiés. */
  generateWeekPlan(days: string[]): Promise<number>
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
  const [offline, setOffline] = useState(false)
  const [seenNotif, setSeenNotif] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('gm.notif.seen') || '[]')
    } catch {
      return []
    }
  })

  const auth = useAuth()
  const cloud = Boolean(supabase && auth.householdId)
  // Cloud (Supabase) si connecté avec un foyer, sinon stockage local.
  const repo = useMemo<Repository>(
    () => (supabase && auth.householdId ? new SupabaseRepository(supabase, auth.householdId) : localRepo),
    [auth.householdId],
  )

  const loadAll = useCallback(async () => {
    try {
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
      setOffline(false)
      if (cloud) {
        try {
          localStorage.setItem(
            'gm.cloudcache',
            JSON.stringify({ p, s, r, f, m, h, e, b, st, sc }),
          )
        } catch { /* quota : on ignore */ }
      }
    } catch (err) {
      // Cloud injoignable : on retombe sur le dernier instantané connu (lecture seule).
      if (cloud) {
        try {
          const raw = localStorage.getItem('gm.cloudcache')
          if (raw) {
            const c = JSON.parse(raw)
            setProducts(c.p ?? [])
            setShopping(c.s ?? [])
            setRecipes(c.r ?? [])
            setFamily(c.f ?? [])
            setMealPlan(c.m ?? {})
            setHistory(c.h ?? [])
            setExpenses(c.e ?? [])
            setBudget(c.b ?? { monthlyLimit: 400 })
            setSettings(c.st ?? { notifExpiry: true, notifLowStock: true, lowStockThreshold: 1 })
            setShopCatalog(c.sc ?? [])
            setOffline(true)
            return
          }
        } catch { /* pas de cache : on relaie l'erreur */ }
      }
      throw err
    }
  }, [repo, cloud])

  useEffect(() => {
    setLoading(true)
    loadAll().finally(() => setLoading(false))
  }, [loadAll])

  const notifications = useMemo(() => buildNotifications(products, settings), [products, settings])

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
      offline,
      notifications,
      unreadNotifCount: notifications.filter((n) => !seenNotif.includes(n.id)).length,
      markNotificationsRead() {
        const ids = notifications.map((n) => n.id)
        setSeenNotif(ids)
        try {
          localStorage.setItem('gm.notif.seen', JSON.stringify(ids))
        } catch {
          /* ignore */
        }
      },

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
      async generateRecipe(opts) {
        if (!supabase) throw new Error('Connecte-toi pour utiliser la génération IA')
        const course = opts?.course?.trim()
        const constraints = [course ? `Type de plat : ${course}` : '', opts?.constraints ?? '']
          .filter(Boolean)
          .join('. ')
        // Coût maîtrisé : on priorise les produits qui périment bientôt (anti-gaspi)
        // puis le reste, en limitant la liste envoyée.
        const prio = priorityProducts(products).map((p) => p.name)
        const rest = products.map((p) => p.name).filter((n) => !prio.includes(n))
        const ingredients = [...new Set([...prio, ...rest])].slice(0, 40)
        const expiring = prio.slice(0, 12)
        // Apprentissage des goûts : plats fréquents (planning + préparés) + favoris.
        const freq = new Map<string, number>()
        for (const label of Object.values(mealPlan)) {
          const t = label.trim()
          if (t) freq.set(t, (freq.get(t) ?? 0) + 1)
        }
        for (const h of history) {
          if (h.kind !== 'prepare') continue
          const t = h.label.replace(/\s+préparée?$/i, '').trim()
          if (t) freq.set(t, (freq.get(t) ?? 0) + 1)
        }
        const frequent = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
        const favorites = recipes.filter((r) => r.favorite).map((r) => r.title)
        const preferences = [...new Set([...frequent, ...favorites])].slice(0, 12)
        const { data, error } = await supabase.functions.invoke('recipe', {
          body: { ingredients, expiring, constraints, preferences },
        })
        if (error) throw new Error(error.message || 'Génération impossible')
        const r = (data as any)?.recipe
        if (!r?.title) throw new Error((data as any)?.error || 'Réponse invalide')
        const input: RecipeInput = {
          title: r.title,
          timeMin: Number(r.timeMin) || 0,
          cuisine: r.cuisine || undefined,
          tags: [...new Set([...(Array.isArray(r.tags) ? r.tags : []), ...(course ? [course] : []), 'ia'])],
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
      async scanReceipt(image, mediaType) {
        if (!supabase) throw new Error('Connecte-toi pour scanner un ticket')
        const { data, error } = await supabase.functions.invoke('receipt', {
          body: { image, mediaType },
        })
        if (error) throw new Error(error.message || 'Analyse impossible')
        const items = (data as any)?.items
        if (!Array.isArray(items)) throw new Error((data as any)?.error || 'Réponse invalide')
        return items as ReceiptItem[]
      },
      async parseBulk(text) {
        if (!supabase) throw new Error('Connecte-toi pour la saisie en lot')
        const { data, error } = await supabase.functions.invoke('bulk', { body: { text } })
        if (error) throw new Error(error.message || 'Analyse impossible')
        const items = (data as any)?.items
        if (!Array.isArray(items)) throw new Error((data as any)?.error || 'Réponse invalide')
        return items as ReceiptItem[]
      },
      async generateWeekPlan(days) {
        if (!supabase) throw new Error('Connecte-toi pour planifier la semaine')
        const prio = priorityProducts(products).map((p) => p.name)
        const rest = products.map((p) => p.name).filter((n) => !prio.includes(n))
        const stock = [...new Set([...prio, ...rest])].slice(0, 50)
        const expiring = prio.slice(0, 12)
        const freq = new Map<string, number>()
        for (const label of Object.values(mealPlan)) {
          const t = label.trim()
          if (t) freq.set(t, (freq.get(t) ?? 0) + 1)
        }
        const preferences = [
          ...new Set([
            ...[...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
            ...recipes.filter((r) => r.favorite).map((r) => r.title),
          ]),
        ].slice(0, 12)
        const diets = family.map(
          (m) =>
            `${m.name} : ${DIET_LABELS[m.diet]}${m.restrictions?.length ? ' (' + m.restrictions.join(', ') + ')' : ''}`,
        )
        const { data, error } = await supabase.functions.invoke('weekplan', {
          body: { stock, expiring, preferences, diets },
        })
        if (error) throw new Error(error.message || 'Génération impossible')
        const meals = (data as any)?.meals
        if (!Array.isArray(meals)) throw new Error((data as any)?.error || 'Réponse invalide')
        const next = { ...mealPlan }
        let count = 0
        for (const m of meals) {
          const date = days[m.day]
          if (!date || (m.slot !== 'midi' && m.slot !== 'soir')) continue
          next[`${date}_${m.slot}`] = m.title
          count++
        }
        setMealPlan(next)
        await repo.saveMealPlan(next)
        return count
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
  }, [repo, products, shopping, recipes, family, mealPlan, history, expenses, shopCatalog, budget, settings, loading, offline, notifications, seenNotif, loadAll])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore doit être utilisé dans un <StoreProvider>')
  return ctx
}

export { AVATAR_COLORS }
