import { recordPrices } from '../lib/prices'
import { getCurrentStore } from '../lib/stores'
import { notifyShoppingAdded } from '../lib/shoppingNotify'
import { seedFromProducts } from '../lib/learnedShelf'
import { seedProductMemory } from '../lib/productMemory'
import { seedPlaces } from '../lib/learnedPlace'
import { useRef,
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
  Conservation,
  Expense,
  FamilyMember,
  FamilyMemberInput,
  HistoryEntry,
  HistoryKind,
  DateType,
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
import { invokeFn } from '../lib/aiKey'
import { useAuth } from './auth'
import { newId, type Repository } from './repository'
import { toISODate } from '../lib/dates'
import { linkedProduct } from '../lib/recipesLib'
import { priorityProducts } from '../lib/expiry'
import { buildNotifications, type Notification } from '../lib/analytics'
import { DIET_LABELS, isPharmacy } from '../types'
import { lookupBarcode } from '../lib/openfoodfacts'

/** Brouillon de recette issu d'une photo. */
export interface ScannedRecipe {
  title: string
  course: string
  timeMin: number
  servings: number | null
  ingredients: { name: string; qty: string }[]
  steps: string[]
  notes?: string
}

interface StoreValue {
  /** Stock alimentaire et maison (sans la pharmacie). */
  products: Product[]
  /** Pharmacie : médicaments et soins, suivis à part (péremption stricte). */
  pharmacy: Product[]
  shopping: ShoppingItem[]
  recipes: Recipe[]
  family: FamilyMember[]
  mealPlan: MealPlan
  history: HistoryEntry[]
  /** Annule/corrige une entrée d'historique (restaure le stock si possible). */
  undoHistory(entry: HistoryEntry): Promise<void>
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
  /** Masque des notifications (elles reviennent si leur gravité ou la quantité change). */
  dismissNotifications(ids: string[]): void
  /** Copie les produits/courses du stockage local de cet appareil vers le cloud. */
  importLocalData(): Promise<number>
  /** Complète les infos manquantes (photo, Nutri-Score, allergènes…) des produits ayant un code-barres, via Open Food Facts. */
  refreshFromOFF(): Promise<{ updated: number; scanned: number }>

  // Produits
  addProduct(input: ProductInput): Promise<Product>
  /** Annule l'ajout de produits (retire les produits et leurs lignes « ajouté » de l'historique). */
  undoAddedProducts(ids: string[]): Promise<void>
  /** Remet des articles de courses supprimés par erreur (sans renvoyer de notification). */
  restoreShoppingItems(items: ShoppingItem[]): Promise<void>
  /** Lit la date de péremption sur la photo d'un emballage (IA). */
  /** Lit le prix sur une étiquette de rayon (Claude Vision). */
  scanPrice(image: string, mediaType: string): Promise<{ price: number | null; unitPrice: number | null; unitLabel: string | null; name: string | null; confident: boolean }>
  scanExpiry(image: string, mediaType: string): Promise<{ date: string | null; type: DateType | null; raw: string; confident: boolean }>
  /** Lit une boîte de médicament en photo (nom, laboratoire, forme, contenu, date si visible). */
  scanMedicine(image: string, mediaType: string): Promise<{ name: string | null; lab: string | null; form: string | null; count: number | null; unit: string | null; expiry: string | null }>
  updateProduct(id: string, patch: Partial<ProductInput>): Promise<void>
  adjustQuantity(id: string, delta: number): Promise<void>
  removeProduct(id: string): Promise<void>
  /** Marque périmé : tout le stock, ou seulement `qty` exemplaires si le produit en compte plusieurs. */
  wasteProduct(id: string, qty?: number): Promise<void>

  // Courses
  addShoppingItem(input: ShoppingItemInput): Promise<void>
  updateShoppingItem(id: string, patch: Partial<ShoppingItemInput>): Promise<void>
  addManyShopping(inputs: ShoppingItemInput[]): Promise<number>
  /** Ajoute plusieurs articles et renvoie leurs ids (pour pouvoir annuler). */
  addShoppingBatch(inputs: ShoppingItemInput[]): Promise<string[]>
  removeShoppingItems(ids: string[]): Promise<void>
  toggleShoppingItem(id: string): Promise<void>
  removeShoppingItem(id: string): Promise<void>
  clearCheckedShopping(): Promise<void>

  // Catalogue d'apprentissage des courses
  shopCatalog: ShopCatalogEntry[]
  recordShopItem(name: string, category: Category, unit: string, qty: number): Promise<void>

  // Recettes
  addRecipe(input: RecipeInput): Promise<Recipe>
  updateRecipe(id: string, patch: Partial<RecipeInput>): Promise<void>
  removeRecipe(id: string): Promise<void>
  /** Génère une recette via Claude (edge function) à partir du stock. */
  generateRecipe(opts?: { constraints?: string; course?: string }): Promise<Recipe>
  /** Analyse la photo d'un ticket de caisse (Claude Vision) → articles détectés. */
  scanReceipt(image: string, mediaType: string): Promise<ReceiptItem[]>
  /** Lit la photo d'une recette (Claude Vision) → brouillon de recette. */
  scanRecipe(images: { data: string; mediaType: string }[]): Promise<ScannedRecipe>
  /** Marque 1 exemplaire comme ouvert : péremption raccourcie (frigo), reste du stock inchangé. */
  openProduct(product: Product, days: number): Promise<void>
  /** Médicament : on note seulement la date d'ouverture (la péremption de la boîte ne change pas). Renvoie l'id de l'exemplaire ouvert. */
  openMedicine(product: Product): Promise<string>
  /** Crée un lien de partage (instantané) d'une recette ; renvoie le jeton. */
  shareRecipe(recipe: Recipe): Promise<string>
  /** Lit une recette partagée par jeton (compte connecté requis). */
  getSharedRecipe(token: string): Promise<RecipeInput>
  /** Devine catégorie/conservation/unité + durée par mode pour un nom de produit. */
  enrichProduct(name: string): Promise<{
    category: Category
    conservation: Conservation
    unit: string
    shelfLife: { frais: number; refrigere: number; congele: number }
  }>
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

/** Tables suivies pour la synchronisation temps réel (doivent figurer dans la publication supabase_realtime). */
const SYNC_TABLES = [
  'products',
  'shopping_items',
  'recipes',
  'family_members',
  'meals',
  'history',
  'expenses',
  'budget',
  'settings',
  'shop_catalog',
]

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
  const [allProducts, setProducts] = useState<Product[]>([])
  const products = useMemo(() => allProducts.filter((p) => !isPharmacy(p.category)), [allProducts])
  const pharmacy = useMemo(() => allProducts.filter((p) => isPharmacy(p.category)), [allProducts])
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
  const [dismissedNotif, setDismissedNotif] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('gm.notif.dismissed') || '[]')
    } catch {
      return []
    }
  })
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

  const knownIds = useRef<Set<string> | null>(null)
  const meRef = useRef<string | undefined>(undefined)
  meRef.current = auth.user?.id
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
      try {
        seedFromProducts(p)
        seedProductMemory(p)
        seedPlaces(p)
      } catch {
        /* l'apprentissage local ne doit jamais bloquer le chargement */
      }
      // Produits apparus depuis le dernier chargement et ajoutés par un AUTRE membre :
      // on prévient l'écran (popup d'arrivée). Rien au premier chargement.
      const me = meRef.current
      if (knownIds.current && me) {
        const known = knownIds.current
        const fresh = p.filter((x) => !known.has(x.id) && x.createdBy && x.createdBy !== me)
        if (fresh.length)
          window.dispatchEvent(
            new CustomEvent('miamm-arrivals', {
              detail: fresh.map((x) => ({ name: x.name, category: x.category, by: x.createdBy, imageUrl: x.imageUrl })),
            }),
          )
      }
      knownIds.current = new Set(p.map((x) => x.id))
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
    const safety = window.setTimeout(() => setLoading(false), 10000)
    loadAll()
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(safety)
        setLoading(false)
      })
    return () => window.clearTimeout(safety)
  }, [loadAll])

  // Synchronisation entre appareils : Supabase Realtime prévient dès qu'une ligne du foyer change
  // (ajout, modification, suppression ailleurs) et on recharge discrètement, sans écran de chargement.
  // Les changements sont regroupés (un ajout en lot déclenche des dizaines d'événements).
  useEffect(() => {
    if (!supabase || !cloud || !auth.householdId) return
    const sb = supabase
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        loadAll().catch(() => {})
      }, 500)
    }
    const channel = sb.channel(`foyer-${auth.householdId}`)
    for (const table of SYNC_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
    }
    channel.subscribe()
    // Filet de sécurité : mobile en veille ou réseau coupé = WebSocket perdu, on rattrape au retour.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    // Filet supplémentaire : si le temps réel décroche sans prévenir (tablette allumée en continu),
    // on relit le foyer toutes les 45 s tant que l'écran est visible.
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 45000)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
      sb.removeChannel(channel)
    }
  }, [cloud, auth.householdId, loadAll])

  const allNotifications = useMemo(
    () =>
      buildNotifications(
        products,
        settings,
        shopping.map((it) => it.name),
        new Set(
          shopCatalog
            .filter((c) => (c.count ?? 0) >= 2)
            .map((c) => c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()),
        ),
      ),
    [products, settings, shopping, shopCatalog],
  )
  const notifications = useMemo(
    () => allNotifications.filter((n) => !dismissedNotif.includes(notifKey(n))),
    [allNotifications, dismissedNotif],
  )

  const value = useMemo<StoreValue>(() => {
    // Ajoute une entrée d'historique et met à jour l'état + le stockage.
    // Rafraîchissement en arrière-plan (regroupé) : l'interface change tout de suite,
    // la base est relue ensuite pour récupérer les éventuelles modifications d'un autre appareil.
    const refreshTimers: Record<string, number> = {}
    function bgRefresh(which: 'products' | 'shopping') {
      window.clearTimeout(refreshTimers[which])
      refreshTimers[which] = window.setTimeout(() => {
        if (which === 'products') repo.listProducts().then(setProducts).catch(() => {})
        else repo.listShopping().then(setShopping).catch(() => {})
      }, 600)
    }
    /** Exécute des écritures par petits paquets en parallèle (au lieu d'une par une). */
    async function inChunks<T, R>(items: T[], fn: (t: T) => Promise<R>, size = 8): Promise<R[]> {
      const out: R[] = []
      for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
      return out
    }

    async function logHistory(
      kind: HistoryKind,
      label: string,
      amount?: number,
      meta?: HistoryEntry['meta'],
    ) {
      const now = new Date()
      const entry: HistoryEntry = {
        id: newId(),
        date: toISODate(now),
        at: now.toISOString(),
        kind,
        label,
        amount,
        meta,
      }
      const next = [entry, ...(await repo.getHistory())]
      await repo.saveHistory(next)
      setHistory(next)
    }

    return {
      products,
      pharmacy,
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
      dismissNotifications(ids: string[]) {
        const keys = allNotifications.filter((n) => ids.includes(n.id)).map(notifKey)
        // On ne garde que les clés encore pertinentes pour que la liste ne grossisse pas indéfiniment.
        const live = new Set(allNotifications.map(notifKey))
        const next = [...new Set([...dismissedNotif.filter((k) => live.has(k)), ...keys])]
        setDismissedNotif(next)
        try {
          localStorage.setItem('gm.notif.dismissed', JSON.stringify(next))
        } catch {
          /* ignore */
        }
      },
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
        const withBarcode = allProducts.filter((p) => p.barcode && !isPharmacy(p.category))
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
        const created = await repo.addProduct(input)
        setProducts(await repo.listProducts())
        await logHistory('ajoute', `${input.name} ajouté (×${input.quantity})`, undefined, {
          productId: created?.id,
          name: input.name,
          qty: input.quantity,
          category: input.category,
          conservation: input.conservation,
        })
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
        return created
      },
      async undoAddedProducts(ids) {
        if (!ids.length) return
        for (const id of ids) await repo.removeProduct(id).catch(() => {})
        const next = (await repo.getHistory()).filter((h) => !(h.kind === 'ajoute' && h.meta?.productId && ids.includes(h.meta.productId)))
        await repo.saveHistory(next)
        setHistory(next)
        setProducts(await repo.listProducts())
      },
      async restoreShoppingItems(items) {
        for (const it of items) {
          const created = await repo.addShoppingItem({ name: it.name, category: it.category, quantity: it.quantity, unit: it.unit, source: it.source })
          if (it.checked) await repo.toggleShoppingItem(created.id)
        }
        setShopping(await repo.listShopping())
      },
      async updateProduct(id, patch) {
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
        try {
          await repo.updateProduct(id, patch)
        } finally {
          bgRefresh('products')
        }
      },
      async adjustQuantity(id, delta) {
        const before = allProducts.find((p) => p.id === id)
        setProducts((prev) =>
          prev.flatMap((p) => (p.id !== id ? [p] : p.quantity + delta <= 0 ? [] : [{ ...p, quantity: p.quantity + delta }])),
        )
        try {
          await repo.adjustQuantity(id, delta)
        } finally {
          bgRefresh('products')
        }
        if (delta < 0 && before) {
          const qty = Math.min(-delta, before.quantity)
          void logHistory(
            'consomme',
            `${before.name} consommé (×${qty})`,
            before.price ? before.price * qty : undefined,
            { name: before.name, qty, category: before.category, conservation: before.conservation },
          )
        }
      },
      async removeProduct(id) {
        setProducts((prev) => prev.filter((p) => p.id !== id))
        try {
          await repo.removeProduct(id)
        } finally {
          bgRefresh('products')
        }
      },
      async undoHistory(entry) {
        const m = entry.meta
        if (entry.kind === 'ajoute') {
          // Annule un ajout : on retire le produit créé.
          if (m?.productId) {
            await repo.removeProduct(m.productId)
            setProducts(await repo.listProducts())
          }
        } else if (entry.kind === 'consomme' || entry.kind === 'jete') {
          // Restaure le stock : +qty si le produit existe encore, sinon on le recrée.
          if (m?.name) {
            const existing =
              entry.kind === 'consomme'
                ? allProducts.find((p) => p.name.trim().toLowerCase() === m.name!.trim().toLowerCase())
                : undefined
            if (existing) {
              await repo.adjustQuantity(existing.id, m.qty ?? 1)
            } else {
              await repo.addProduct({
                name: m.name,
                category: m.category ?? 'autre',
                conservation: m.conservation,
                quantity: m.qty ?? 1,
                dateType: 'dlc',
              })
            }
            setProducts(await repo.listProducts())
          }
        }
        // Retire l'entrée de l'historique.
        await repo.removeHistory(entry.id)
        setHistory(history.filter((h) => h.id !== entry.id))
      },
      async wasteProduct(id, qty) {
        const before = allProducts.find((p) => p.id === id)
        const partial = !!before && qty !== undefined && qty > 0 && qty < before.quantity
        setProducts((prev) =>
          partial && before
            ? prev.map((p) => (p.id === id ? { ...p, quantity: before.quantity - qty! } : p))
            : prev.filter((p) => p.id !== id),
        )
        try {
          if (partial && before) await repo.updateProduct(id, { quantity: before.quantity - qty! })
          else await repo.removeProduct(id)
        } finally {
          bgRefresh('products')
        }
        if (before)
          void logHistory('jete', `${before.name} jeté (périmé)`, undefined, {
            name: before.name,
            qty: partial ? qty! : before.quantity,
            category: before.category,
            conservation: before.conservation,
          })
      },

      async addShoppingItem(input) {
        const item = await repo.addShoppingItem(input)
        setShopping((prev) => [...prev, item])
        notifyShoppingAdded([input.name])
        bgRefresh('shopping')
      },
      async updateShoppingItem(id, patch) {
        setShopping((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
        try {
          await repo.updateShoppingItem(id, patch)
        } finally {
          bgRefresh('shopping')
        }
      },
      async addManyShopping(inputs) {
        const items = await inChunks(inputs, (input) => repo.addShoppingItem(input))
        setShopping((prev) => [...prev, ...items])
        notifyShoppingAdded(inputs.map((i) => i.name))
        bgRefresh('shopping')
        return inputs.length
      },
      async toggleShoppingItem(id) {
        setShopping((prev) => prev.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it)))
        try {
          await repo.toggleShoppingItem(id)
        } finally {
          bgRefresh('shopping')
        }
      },
      async addShoppingBatch(inputs) {
        const items = await inChunks(inputs, (input) => repo.addShoppingItem(input))
        setShopping((prev) => [...prev, ...items])
        notifyShoppingAdded(inputs.map((i) => i.name))
        bgRefresh('shopping')
        return items.map((i) => i.id)
      },
      async removeShoppingItems(ids) {
        const set = new Set(ids)
        setShopping((prev) => prev.filter((it) => !set.has(it.id)))
        try {
          await inChunks(ids, (id) => repo.removeShoppingItem(id))
        } finally {
          bgRefresh('shopping')
        }
      },
      async removeShoppingItem(id) {
        setShopping((prev) => prev.filter((it) => it.id !== id))
        try {
          await repo.removeShoppingItem(id)
        } finally {
          bgRefresh('shopping')
        }
      },
      async clearCheckedShopping() {
        setShopping((prev) => prev.filter((it) => !it.checked))
        try {
          await repo.clearCheckedShopping()
        } finally {
          bgRefresh('shopping')
        }
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
      async updateRecipe(id, patch) {
        const next = recipes.map((r) => (r.id === id ? { ...r, ...patch } : r))
        setRecipes(next)
        await repo.saveRecipes(next)
      },
      async removeRecipe(id) {
        const next = recipes.filter((r) => r.id !== id)
        setRecipes(next)
        await repo.saveRecipes(next)
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
        // Régimes / allergies / aversions de la famille (contraintes strictes).
        const diets = family.map(
          (m) =>
            `${m.name} : ${DIET_LABELS[m.diet]}` +
            (m.restrictions?.length ? ` (${m.restrictions.join(', ')})` : '') +
            (m.aversions?.trim() ? ` — n'aime pas : ${m.aversions.trim()}` : ''),
        )
        const { data, error } = await invokeFn('recipe', { ingredients, expiring, constraints, preferences, diets })
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
        const { data, error } = await invokeFn('receipt', { image, mediaType })
        if (error) throw new Error(error.message || 'Analyse impossible')
        const items = (data as any)?.items
        if (!Array.isArray(items)) throw new Error((data as any)?.error || 'Réponse invalide')
        // Les prix du ticket alimentent le comparatif par magasin (enseigne lue sur le ticket, sinon magasin choisi).
        const shop = ((data as any)?.store as string | null) || getCurrentStore()
        if (shop)
          void recordPrices(
            (items as ReceiptItem[]).map((it) => ({ name: it.name, store: shop, price: it.price, source: 'ticket' })),
          )
        return items as ReceiptItem[]
      },
      async scanRecipe(images) {
        if (!supabase) throw new Error('Connecte-toi pour scanner une recette')
        const { data, error } = await invokeFn('recipescan', { images })
        if (error) throw new Error(error.message || 'Analyse impossible')
        const d = data as any
        if (!d || !Array.isArray(d.ingredients)) throw new Error(d?.error || 'Réponse invalide')
        return d as ScannedRecipe
      },
      async openMedicine(product) {
        const openedAt = toISODate(new Date())
        let id = product.id
        if (product.quantity > 1) {
          // Une seule boîte est ouverte : on la sépare des boîtes fermées.
          await repo.updateProduct(product.id, { quantity: product.quantity - 1 })
          const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = product
          id = (await repo.addProduct({ ...rest, openedAt, quantity: 1 })).id
        } else {
          await repo.updateProduct(product.id, { openedAt })
        }
        setProducts(await repo.listProducts())
        return id
      },
      async openProduct(product, days) {
        const today = new Date()
        const target = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days))
        const expiry = product.expiryDate && product.expiryDate < target ? product.expiryDate : target
        const patch = {
          openedAt: toISODate(today),
          expiryDate: expiry,
          dateType: 'dlc' as const,
          conservation: 'refrigere' as const,
          location: product.conservation === 'refrigere' ? product.location : 'Réfrigérateur',
        }
        if (product.quantity > 1) {
          // Un seul exemplaire est ouvert : on le sépare du lot fermé (ou on le range avec un lot déjà ouvert pareil).
          const twin = allProducts.find(
            (p) =>
              p.id !== product.id && p.name === product.name && p.brand === product.brand && p.size === product.size &&
              p.openedAt === patch.openedAt && p.expiryDate === patch.expiryDate,
          )
          await repo.updateProduct(product.id, { quantity: product.quantity - 1 })
          if (twin) await repo.updateProduct(twin.id, { quantity: twin.quantity + 1 })
          else {
            const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = product
            await repo.addProduct({ ...rest, ...patch, quantity: 1 })
          }
        } else {
          await repo.updateProduct(product.id, patch)
        }
        setProducts(await repo.listProducts())
      },
      async shareRecipe(recipe) {
        if (!supabase) throw new Error('Connecte-toi pour partager une recette')
        const payload = {
          title: recipe.title,
          timeMin: recipe.timeMin,
          cuisine: recipe.cuisine ?? null,
          tags: recipe.tags.filter((t) => t !== 'perso'),
          ingredients: recipe.ingredients.map((i) => ({ name: i.name, qty: i.qty ?? '' })),
          steps: recipe.steps ?? [],
          servings: recipe.servings ?? null,
          servingsUnit: recipe.servingsUnit ?? null,
          icon: recipe.icon ?? null,
          notes: recipe.notes ?? null,
        }
        const { data, error } = await supabase.rpc('share_recipe', { p_recipe: payload })
        if (error || typeof data !== 'string') throw new Error(error?.message || 'Partage impossible')
        return data
      },
      async getSharedRecipe(token) {
        if (!supabase) throw new Error('Connecte-toi pour ouvrir cette recette')
        const { data, error } = await supabase.rpc('get_shared_recipe', { p_token: token })
        if (error) throw new Error(error.message || 'Lien invalide')
        const d = data as any
        if (!d || typeof d.title !== 'string' || !Array.isArray(d.ingredients)) {
          throw new Error('Ce lien a expiré ou n’existe pas')
        }
        return {
          title: d.title,
          timeMin: Number(d.timeMin) || 0,
          cuisine: d.cuisine ?? undefined,
          tags: Array.isArray(d.tags) ? d.tags : [],
          favorite: false,
          ingredients: d.ingredients.map((i: any) => ({ name: String(i.name ?? ''), qty: i.qty || undefined })),
          steps: Array.isArray(d.steps) ? d.steps : [],
          servings: d.servings ?? undefined,
          servingsUnit: d.servingsUnit ?? undefined,
          icon: d.icon ?? undefined,
          notes: d.notes ?? undefined,
        }
      },
      async scanPrice(image, mediaType) {
        if (!supabase) throw new Error('Connecte-toi pour scanner un prix')
        const { data, error } = await invokeFn('pricescan', { image, mediaType })
        if (error) throw new Error(error.message || 'Analyse impossible')
        const d = data as any
        if (!d || (d.error && !('price' in d))) throw new Error(d?.error || 'Réponse invalide')
        return {
          price: typeof d.price === 'number' ? d.price : null,
          unitPrice: typeof d.unitPrice === 'number' ? d.unitPrice : null,
          unitLabel: typeof d.unitLabel === 'string' ? d.unitLabel : null,
          name: typeof d.name === 'string' ? d.name : null,
          confident: d.confident !== false,
        }
      },
      async scanMedicine(image, mediaType) {
        if (!supabase) throw new Error('Connecte-toi pour lire une boîte')
        const { data, error } = await invokeFn('medscan', { image, mediaType })
        if (error) throw new Error(error.message || 'Analyse impossible')
        const d = data as any
        if (!d || d.error) throw new Error(d?.error || 'Réponse invalide')
        return d
      },
      async scanExpiry(image, mediaType) {
        if (!supabase) throw new Error('Connecte-toi pour scanner une date')
        const { data, error } = await invokeFn('expiry', { image, mediaType })
        if (error) throw new Error(error.message || 'Analyse impossible')
        const d = data as any
        if (!d || (d.error && !('date' in d))) throw new Error(d?.error || 'Réponse invalide')
        return {
          date: typeof d.date === 'string' ? d.date : null,
          type: d.type === 'dlc' || d.type === 'ddm' ? d.type : null,
          raw: typeof d.raw === 'string' ? d.raw : '',
          confident: d.confident !== false,
        }
      },
      async enrichProduct(name) {
        if (!supabase) throw new Error('Connecte-toi pour l’assistance IA')
        const { data, error } = await invokeFn('enrich', { name })
        if (error) throw new Error(error.message || 'Analyse impossible')
        const d = data as any
        if (!d?.category) throw new Error(d?.error || 'Réponse invalide')
        const sl = d.shelfLife ?? {}
        return {
          category: d.category as Category,
          conservation: d.conservation as Conservation,
          unit: typeof d.unit === 'string' ? d.unit : '',
          shelfLife: {
            frais: Number(sl.frais) || 0,
            refrigere: Number(sl.refrigere) || 0,
            congele: Number(sl.congele) || 0,
          },
        }
      },
      async parseBulk(text) {
        if (!supabase) throw new Error('Connecte-toi pour la saisie en lot')
        const { data, error } = await invokeFn('bulk', { text })
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
            `${m.name} : ${DIET_LABELS[m.diet]}` +
            (m.restrictions?.length ? ' (' + m.restrictions.join(', ') + ')' : '') +
            (m.aversions?.trim() ? " — n'aime pas : " + m.aversions.trim() : ''),
        )
        const { data, error } = await invokeFn('weekplan', { stock, expiring, preferences, diets })
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
          const match = linkedProduct(ing, products)
          if (match && match.quantity > 0) {
            await repo.adjustQuantity(match.id, -1)
            await logHistory('consomme', `${match.name} consommé (×1)`, match.price ?? undefined, {
              name: match.name,
              qty: 1,
              category: match.category,
              conservation: match.conservation,
            })
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
  }, [repo, products, allProducts, pharmacy, shopping, recipes, family, mealPlan, history, expenses, shopCatalog, budget, settings, loading, offline, notifications, allNotifications, dismissedNotif, seenNotif, loadAll])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore doit être utilisé dans un <StoreProvider>')
  return ctx
}

export { AVATAR_COLORS }

/** Clé de masquage : une notification masquée réapparaît si sa gravité ou son texte de quantité change. */
function notifKey(n: Notification): string {
  return `${n.id}|${n.severity}|${n.kind === 'stock' ? n.desc : ''}`
}
