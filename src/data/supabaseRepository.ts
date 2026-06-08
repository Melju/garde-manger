import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BudgetConfig,
  Category,
  Expense,
  FamilyMember,
  HistoryEntry,
  MealPlan,
  Product,
  ProductInput,
  Recipe,
  Settings,
  ShoppingItem,
  ShoppingItemInput,
} from '../types'
import { newId, type Repository } from './repository'

/* ---------- Mappage lignes SQL <-> modèles ---------- */

function toProduct(r: any): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    quantity: Number(r.quantity),
    unit: r.unit ?? undefined,
    size: r.size ?? undefined,
    expiryDate: r.expiry_date ?? undefined,
    price: r.price != null ? Number(r.price) : undefined,
    barcode: r.barcode ?? undefined,
    storage: r.storage ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function toShopping(r: any): ShoppingItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    quantity: Number(r.quantity),
    unit: r.unit ?? undefined,
    checked: r.checked,
    source: r.source,
    createdAt: r.created_at,
  }
}

function toRecipe(r: any): Recipe {
  return {
    id: r.id,
    title: r.title,
    timeMin: r.time_min,
    cuisine: r.cuisine ?? undefined,
    tags: r.tags ?? [],
    favorite: r.favorite,
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
  }
}

function toMember(r: any): FamilyMember {
  return {
    id: r.id,
    name: r.name,
    diet: r.diet,
    restrictions: r.restrictions ?? [],
    aversions: r.aversions ?? undefined,
    color: r.color,
  }
}

/**
 * Repository basé sur Supabase (PostgREST). Toutes les lignes sont rattachées
 * au foyer (household_id) ; la RLS garantit l'isolation côté serveur.
 */
export class SupabaseRepository implements Repository {
  constructor(
    private sb: SupabaseClient,
    private householdId: string,
  ) {}

  private get hid() {
    return this.householdId
  }

  // ---------- Produits ----------
  async listProducts(): Promise<Product[]> {
    const { data, error } = await this.sb
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(toProduct)
  }

  async addProduct(input: ProductInput): Promise<Product> {
    const { data, error } = await this.sb
      .from('products')
      .insert({
        household_id: this.hid,
        name: input.name,
        category: input.category,
        quantity: input.quantity,
        unit: input.unit ?? null,
        size: input.size ?? null,
        expiry_date: input.expiryDate ?? null,
        price: input.price ?? null,
        barcode: input.barcode ?? null,
        storage: input.storage ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return toProduct(data)
  }

  async updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.name !== undefined) row.name = patch.name
    if (patch.category !== undefined) row.category = patch.category
    if (patch.quantity !== undefined) row.quantity = patch.quantity
    if (patch.unit !== undefined) row.unit = patch.unit ?? null
    if (patch.size !== undefined) row.size = patch.size ?? null
    if (patch.expiryDate !== undefined) row.expiry_date = patch.expiryDate ?? null
    if (patch.price !== undefined) row.price = patch.price ?? null
    if (patch.barcode !== undefined) row.barcode = patch.barcode ?? null
    if (patch.storage !== undefined) row.storage = patch.storage ?? null
    const { data, error } = await this.sb.from('products').update(row).eq('id', id).select().single()
    if (error) throw error
    return toProduct(data)
  }

  async adjustQuantity(id: string, delta: number): Promise<Product | null> {
    const { data: cur } = await this.sb.from('products').select('quantity').eq('id', id).maybeSingle()
    if (!cur) return null
    const next = Number(cur.quantity) + delta
    if (next <= 0) {
      await this.removeProduct(id)
      return null
    }
    return this.updateProduct(id, { quantity: next })
  }

  async removeProduct(id: string): Promise<void> {
    const { error } = await this.sb.from('products').delete().eq('id', id)
    if (error) throw error
  }

  // ---------- Courses ----------
  async listShopping(): Promise<ShoppingItem[]> {
    const { data, error } = await this.sb
      .from('shopping_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(toShopping)
  }

  async addShoppingItem(input: ShoppingItemInput): Promise<ShoppingItem> {
    const { data, error } = await this.sb
      .from('shopping_items')
      .insert({
        household_id: this.hid,
        name: input.name,
        category: input.category,
        quantity: input.quantity,
        unit: input.unit ?? null,
        source: input.source,
        checked: false,
      })
      .select()
      .single()
    if (error) throw error
    return toShopping(data)
  }

  async toggleShoppingItem(id: string): Promise<ShoppingItem | null> {
    const { data: cur } = await this.sb
      .from('shopping_items')
      .select('checked')
      .eq('id', id)
      .maybeSingle()
    if (!cur) return null
    const { data, error } = await this.sb
      .from('shopping_items')
      .update({ checked: !cur.checked })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return toShopping(data)
  }

  async removeShoppingItem(id: string): Promise<void> {
    const { error } = await this.sb.from('shopping_items').delete().eq('id', id)
    if (error) throw error
  }

  async clearCheckedShopping(): Promise<void> {
    const { error } = await this.sb.from('shopping_items').delete().eq('checked', true)
    if (error) throw error
  }

  // ---------- Recettes ----------
  async getRecipes(): Promise<Recipe[]> {
    const { data, error } = await this.sb.from('recipes').select('*').order('title')
    if (error) throw error
    return (data ?? []).map(toRecipe)
  }

  async saveRecipes(recipes: Recipe[]): Promise<void> {
    await this.syncCollection(
      'recipes',
      recipes.map((r) => ({
        id: r.id,
        household_id: this.hid,
        title: r.title,
        time_min: r.timeMin,
        cuisine: r.cuisine ?? null,
        tags: r.tags,
        favorite: r.favorite,
        ingredients: r.ingredients,
        steps: r.steps ?? [],
      })),
    )
  }

  // ---------- Famille ----------
  async getFamily(): Promise<FamilyMember[]> {
    const { data, error } = await this.sb.from('family_members').select('*')
    if (error) throw error
    return (data ?? []).map(toMember)
  }

  async saveFamily(members: FamilyMember[]): Promise<void> {
    await this.syncCollection(
      'family_members',
      members.map((m) => ({
        id: m.id,
        household_id: this.hid,
        name: m.name,
        diet: m.diet,
        restrictions: m.restrictions,
        aversions: m.aversions ?? null,
        color: m.color,
      })),
    )
  }

  // ---------- Planning ----------
  async getMealPlan(): Promise<MealPlan> {
    const { data, error } = await this.sb.from('meals').select('*')
    if (error) throw error
    const plan: MealPlan = {}
    for (const r of data ?? []) plan[`${r.meal_date}_${r.slot}`] = r.label
    return plan
  }

  async saveMealPlan(plan: MealPlan): Promise<void> {
    // Remplace l'ensemble des repas du foyer (volume faible).
    await this.sb.from('meals').delete().eq('household_id', this.hid)
    const rows = Object.entries(plan).map(([key, label]) => {
      const i = key.lastIndexOf('_')
      return { household_id: this.hid, meal_date: key.slice(0, i), slot: key.slice(i + 1), label }
    })
    if (rows.length) {
      const { error } = await this.sb.from('meals').insert(rows)
      if (error) throw error
    }
  }

  // ---------- Historique ----------
  async getHistory(): Promise<HistoryEntry[]> {
    const { data, error } = await this.sb
      .from('history')
      .select('*')
      .order('at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r: any) => ({
      id: r.id,
      date: r.entry_date,
      at: r.at,
      kind: r.kind,
      label: r.label,
      amount: r.amount != null ? Number(r.amount) : undefined,
    }))
  }

  async saveHistory(entries: HistoryEntry[]): Promise<void> {
    await this.syncCollection(
      'history',
      entries.map((h) => ({
        id: h.id && h.id.length > 20 ? h.id : newId(),
        household_id: this.hid,
        entry_date: h.date,
        at: h.at,
        kind: h.kind,
        label: h.label,
        amount: h.amount ?? null,
      })),
      false, // historique : on n'efface pas (append-only)
    )
  }

  // ---------- Dépenses ----------
  async getExpenses(): Promise<Expense[]> {
    const { data, error } = await this.sb
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r: any) => ({
      id: r.id,
      date: r.expense_date,
      category: r.category as Category,
      label: r.label,
      amount: Number(r.amount),
    }))
  }

  async saveExpenses(expenses: Expense[]): Promise<void> {
    await this.syncCollection(
      'expenses',
      expenses.map((e) => ({
        id: e.id,
        household_id: this.hid,
        expense_date: e.date,
        category: e.category,
        label: e.label,
        amount: e.amount,
      })),
      false,
    )
  }

  // ---------- Budget ----------
  async getBudget(): Promise<BudgetConfig> {
    const { data } = await this.sb
      .from('budget')
      .select('monthly_limit')
      .eq('household_id', this.hid)
      .maybeSingle()
    return { monthlyLimit: data ? Number(data.monthly_limit) : 400 }
  }

  async saveBudget(config: BudgetConfig): Promise<void> {
    const { error } = await this.sb
      .from('budget')
      .upsert({ household_id: this.hid, monthly_limit: config.monthlyLimit })
    if (error) throw error
  }

  // ---------- Paramètres ----------
  async getSettings(): Promise<Settings> {
    const { data } = await this.sb
      .from('settings')
      .select('*')
      .eq('household_id', this.hid)
      .maybeSingle()
    return {
      notifExpiry: data?.notif_expiry ?? true,
      notifLowStock: data?.notif_low_stock ?? true,
      lowStockThreshold: data?.low_stock_threshold ?? 1,
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    const { error } = await this.sb.from('settings').upsert({
      household_id: this.hid,
      notif_expiry: settings.notifExpiry,
      notif_low_stock: settings.notifLowStock,
      low_stock_threshold: settings.lowStockThreshold,
    })
    if (error) throw error
  }

  // En cloud, la réinitialisation démo n'a pas de sens (no-op).
  async resetDemo(): Promise<void> {}

  /**
   * Synchronise une collection : upsert de toutes les lignes fournies, et
   * (si removeMissing) suppression des lignes du foyer absentes de la liste.
   */
  private async syncCollection(
    table: string,
    rows: { id: string }[],
    removeMissing = true,
  ): Promise<void> {
    if (rows.length) {
      const { error } = await this.sb.from(table).upsert(rows)
      if (error) throw error
    }
    if (removeMissing) {
      const ids = rows.map((r) => r.id)
      let q = this.sb.from(table).delete().eq('household_id', this.hid)
      if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`)
      const { error } = await q
      if (error) throw error
    }
  }
}
