import type { Product, ProductInput, ShoppingItem, ShoppingItemInput } from '../types'
import { newId, type Repository } from './repository'
import { seedProducts, seedShopping } from './seed'

const PRODUCTS_KEY = 'gm.products'
const SHOPPING_KEY = 'gm.shopping'
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
    // Chargement du jeu de démonstration au tout premier lancement uniquement.
    if (!localStorage.getItem(SEEDED_KEY)) {
      write(PRODUCTS_KEY, seedProducts())
      write(SHOPPING_KEY, seedShopping())
      localStorage.setItem(SEEDED_KEY, '1')
    }
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
}
