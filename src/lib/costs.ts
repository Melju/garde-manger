/**
 * Coût des recettes et du panier de courses.
 *
 * Les estimations viennent de la fonction « costs » (prix relevés du foyer, Open Prices, sinon IA)
 * et sont gardées en cache sur l'appareil : une recette n'est recalculée que si ses ingrédients
 * changent ou si l'estimation a plus de 30 jours. Les appels sont regroupés (10 recettes ou
 * 50 articles par appel) pour ménager le quota IA du foyer.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Recipe, ShoppingItem, Product } from '../types'
import { invokeFn } from './aiKey'
import { priceKey, type PriceObs } from './prices'

export type CostLine = { name: string; cost: number; src: 'ticket' | 'estimation' }
export type RecipeCost = { total: number; lines: CostLine[]; hash: string; at: number }
export type ItemCost = { price: number; src: 'ticket' | 'estimation' | 'openprices'; at: number }

const R_KEY = 'miamm.costs.recipes.v1'
const I_KEY = 'miamm.costs.items.v1'
const MAX_AGE = 30 * 86400_000

function read<T>(k: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(k) ?? '{}')
  } catch {
    return {}
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* stockage plein : tant pis */
  }
}

const recipeHash = (r: Recipe) =>
  JSON.stringify([r.servings ?? 4, r.ingredients.map((g) => [priceKey(g.name), (g.qty ?? '').trim()])])

const itemKey = (it: { name: string; quantity: number; unit?: string }) => `${priceKey(it.name)}|${it.quantity}|${it.unit ?? ''}`

/** Prix relevés qui ressemblent à un nom (mêmes mots significatifs), pour donner du contexte à l'IA. */
function relatedKnown(obs: PriceObs[], names: string[], max = 250) {
  const words = new Set(
    names.flatMap((n) =>
      priceKey(n)
        .split(' ')
        .filter((w) => w.length > 3),
    ),
  )
  const seen = new Set<string>()
  const out: { name: string; store: string; price: number; unitPrice: number | null; unitLabel: string | null }[] = []
  for (const o of obs) {
    const k = `${o.key}|${priceKey(o.store)}`
    if (seen.has(k)) continue
    if (!o.key.split(' ').some((w) => words.has(w))) continue
    seen.add(k)
    out.push({ name: o.name, store: o.store, price: o.price, unitPrice: o.unitPrice, unitLabel: o.unitLabel })
    if (out.length >= max) break
  }
  return out
}

// ----- état partagé entre écrans -----
let recipeCache = read<RecipeCost>(R_KEY)
let itemCache = read<ItemCost>(I_KEY)
let busy = false
let failedUntil = 0
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())

function useTick() {
  const [n, set] = useState(0)
  useEffect(() => {
    const f = () => set((n) => n + 1)
    subs.add(f)
    return () => void subs.delete(f)
  }, [])
  return n
}

async function fillRecipes(todo: Recipe[], obs: PriceObs[]) {
  for (let i = 0; i < todo.length; i += 10) {
    const batch = todo.slice(i, i + 10)
    const { data, error } = await invokeFn('costs', {
      recipes: batch.map((r) => ({ id: r.id, title: r.title, servings: r.servings ?? 4, ingredients: r.ingredients })),
      known: relatedKnown(
        obs,
        batch.flatMap((r) => r.ingredients.map((g) => g.name)),
      ),
    })
    if (error) throw error
    const now = Date.now()
    for (const r of ((data as any)?.recipes ?? []) as { id: string; total: number; lines: CostLine[] }[]) {
      const rec = batch.find((b) => b.id === r.id)
      if (rec) recipeCache[r.id] = { total: r.total, lines: r.lines, hash: recipeHash(rec), at: now }
    }
    write(R_KEY, recipeCache)
    notify()
  }
}

async function fillItems(todo: { key: string; name: string; qty: string; barcode?: string }[], obs: PriceObs[]) {
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50)
    const { data, error } = await invokeFn('costs', {
      items: batch,
      known: relatedKnown(
        obs,
        batch.map((b) => b.name),
      ),
    })
    if (error) throw error
    const now = Date.now()
    for (const it of ((data as any)?.items ?? []) as { key: string; price: number; src: ItemCost['src'] }[])
      itemCache[it.key] = { price: it.price, src: it.src, at: now }
    write(I_KEY, itemCache)
    notify()
  }
}

/** Lance les calculs manquants (un seul à la fois ; pause d'une heure après une erreur, ex. quota). */
function schedule(job: () => Promise<void>) {
  if (busy || Date.now() < failedUntil) return
  busy = true
  job()
    .catch(() => {
      failedUntil = Date.now() + 3600_000
    })
    .finally(() => {
      busy = false
      notify()
    })
}

/** Coût estimé des recettes données (calcule en arrière-plan celles qui manquent). */
export function useRecipeCosts(recipes: Recipe[], obs: PriceObs[], enabled = true): Record<string, RecipeCost> {
  useTick()
  const todo = useMemo(() => {
    const now = Date.now()
    return recipes.filter((r) => {
      if (!r.ingredients?.length) return false
      const c = recipeCache[r.id]
      return !c || c.hash !== recipeHash(r) || now - c.at > MAX_AGE
    })
  }, [recipes])
  useEffect(() => {
    if (!enabled || !todo.length) return
    const t = setTimeout(() => schedule(() => fillRecipes(todo, obs)), 1200)
    return () => clearTimeout(t)
  }, [todo, obs, enabled])
  const out: Record<string, RecipeCost> = {}
  for (const r of recipes) {
    const c = recipeCache[r.id]
    if (c && c.hash === recipeHash(r)) out[r.id] = c
  }
  return out
}

export function costPending() {
  return busy
}

export type StoreTotal = { store: string; total: number; known: number; count: number }

/**
 * Panier estimé par magasin : prix réel relevé dans ce magasin quand on l'a, sinon l'estimation
 * de l'article (Open Prices ou IA). Les magasins sont classés du moins cher au plus cher ;
 * seuls ceux où au moins un prix réel est connu apparaissent.
 */
export function useBasketEstimate(
  items: ShoppingItem[],
  obs: PriceObs[],
  products: Product[],
  enabled = true,
): { stores: StoreTotal[]; estimate: number | null; count: number } {
  const tick = useTick()
  const open = useMemo(() => items.filter((i) => !i.checked), [items])
  const todo = useMemo(() => {
    const now = Date.now()
    const byName = new Map(products.filter((p) => p.barcode).map((p) => [priceKey(p.name), p.barcode!]))
    return open
      .filter((it) => {
        const c = itemCache[itemKey(it)]
        return !c || now - c.at > MAX_AGE
      })
      .map((it) => ({
        key: itemKey(it),
        name: it.name,
        qty: it.unit ? `${it.quantity} ${it.unit}` : `×${it.quantity}`,
        barcode: byName.get(priceKey(it.name)),
      }))
  }, [open, products])
  useEffect(() => {
    if (!enabled || !todo.length) return
    const t = setTimeout(() => schedule(() => fillItems(todo, obs)), 1500)
    return () => clearTimeout(t)
  }, [todo, obs, enabled])

  return useMemo(() => {
    // Dernier prix par (article, magasin).
    const latest = new Map<string, Map<string, { store: string; price: number }>>()
    for (const o of obs) {
      let m = latest.get(o.key)
      if (!m) latest.set(o.key, (m = new Map()))
      const sk = priceKey(o.store)
      if (!m.has(sk)) m.set(sk, { store: o.store.trim(), price: o.price })
    }
    const est = (it: ShoppingItem) => itemCache[itemKey(it)]?.price ?? null
    const stores = new Map<string, StoreTotal>()
    for (const it of open)
      for (const [sk, v] of latest.get(priceKey(it.name)) ?? []) if (!stores.has(sk)) stores.set(sk, { store: v.store, total: 0, known: 0, count: 0 })
    let estimate = 0
    let estimated = 0
    for (const it of open) {
      const e = est(it)
      if (e != null) {
        estimate += e
        estimated++
      }
      const perStore = latest.get(priceKey(it.name))
      for (const [sk, s] of stores) {
        const real = perStore?.get(sk)
        const p = real?.price ?? e
        if (p == null) continue
        s.total += p
        s.count++
        if (real) s.known++
      }
    }
    return {
      stores: [...stores.values()].filter((s) => s.known > 0).sort((a, b) => a.total - b.total),
      estimate: estimated ? Math.round(estimate * 100) / 100 : null,
      count: open.length,
    }
  }, [open, obs, tick])
}
