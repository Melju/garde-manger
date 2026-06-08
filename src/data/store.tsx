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
  Product,
  ProductInput,
  ShoppingItem,
  ShoppingItemInput,
} from '../types'
import { LocalStorageRepository } from './localStorageRepository'
import type { Repository } from './repository'

interface StoreValue {
  products: Product[]
  shopping: ShoppingItem[]
  loading: boolean
  // Produits
  addProduct(input: ProductInput): Promise<void>
  updateProduct(id: string, patch: Partial<ProductInput>): Promise<void>
  adjustQuantity(id: string, delta: number): Promise<void>
  removeProduct(id: string): Promise<void>
  // Courses
  addShoppingItem(input: ShoppingItemInput): Promise<void>
  toggleShoppingItem(id: string): Promise<void>
  removeShoppingItem(id: string): Promise<void>
  clearCheckedShopping(): Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

// Repository unique pour toute l'app. Pour passer à Supabase plus tard,
// il suffira de remplacer cette ligne par une SupabaseRepository.
const repo: Repository = new LocalStorageRepository()

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [shopping, setShopping] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [p, s] = await Promise.all([repo.listProducts(), repo.listShopping()])
    setProducts(p)
    setShopping(s)
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const value = useMemo<StoreValue>(
    () => ({
      products,
      shopping,
      loading,
      async addProduct(input) {
        await repo.addProduct(input)
        setProducts(await repo.listProducts())
      },
      async updateProduct(id, patch) {
        await repo.updateProduct(id, patch)
        setProducts(await repo.listProducts())
      },
      async adjustQuantity(id, delta) {
        await repo.adjustQuantity(id, delta)
        setProducts(await repo.listProducts())
      },
      async removeProduct(id) {
        await repo.removeProduct(id)
        setProducts(await repo.listProducts())
      },
      async addShoppingItem(input) {
        await repo.addShoppingItem(input)
        setShopping(await repo.listShopping())
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
    }),
    [products, shopping, loading],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore doit être utilisé dans un <StoreProvider>')
  return ctx
}
