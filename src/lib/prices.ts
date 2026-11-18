import { useEffect, useState } from 'react'
import { supabase } from '../data/supabaseClient'

/** Un prix relevé dans un magasin (ticket de caisse ou étiquette scannée). */
export interface PriceObs {
  name: string
  key: string
  store: string
  price: number
  unitPrice: number | null
  unitLabel: string | null
  at: string
  barcode?: string | null
}

/** Clé de rapprochement des noms (« Fusilli Da Rocca » = « fusilli da rocca »). */
export function priceKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

let cache: PriceObs[] | null = null
let loading: Promise<PriceObs[]> | null = null
const listeners = new Set<(o: PriceObs[]) => void>()

async function load(): Promise<PriceObs[]> {
  if (!supabase) return []
  const since = new Date(Date.now() - 365 * 86400_000).toISOString()
  const { data, error } = await supabase
    .from('price_obs')
    .select('name,name_key,store,price,unit_price,unit_label,observed_at,barcode')
    .gte('observed_at', since)
    .order('observed_at', { ascending: false })
    .limit(5000)
  if (error) return []
  return (data ?? []).map((r: any) => ({
    name: r.name,
    key: r.name_key,
    store: r.store,
    price: Number(r.price),
    unitPrice: r.unit_price != null ? Number(r.unit_price) : null,
    unitLabel: r.unit_label ?? null,
    at: r.observed_at,
    barcode: r.barcode ?? null,
  }))
}

function publish(o: PriceObs[]) {
  cache = o
  for (const l of listeners) l(o)
}

/** Relevés de prix du foyer (chargés une fois, partagés entre les écrans). */
export function usePriceObs(): PriceObs[] {
  const [obs, setObs] = useState<PriceObs[]>(cache ?? [])
  useEffect(() => {
    listeners.add(setObs)
    if (!cache && !loading) loading = load().then((o) => (publish(o), o)).finally(() => (loading = null))
    return () => void listeners.delete(setObs)
  }, [])
  return obs
}

/** Enregistre des prix relevés (sans bloquer l'interface ; erreurs ignorées). */
export async function recordPrices(
  rows: {
    name: string
    store: string
    price: number | null | undefined
    unitPrice?: number | null
    unitLabel?: string | null
    source: string
    barcode?: string | null
  }[],
) {
  if (!supabase) return
  const clean = rows
    .filter((r) => r.name.trim() && r.store.trim() && r.price != null && r.price > 0 && r.price < 1000)
    .map((r) => ({
      name: r.name.trim().slice(0, 80),
      name_key: priceKey(r.name),
      store: r.store.trim().slice(0, 40),
      price: Math.round(r.price! * 100) / 100,
      unit_price: r.unitPrice ?? null,
      unit_label: r.unitLabel ?? null,
      source: r.source,
      barcode: r.barcode && /^\d{8,14}$/.test(r.barcode) ? r.barcode : null,
    }))
  if (!clean.length) return
  const { error } = await supabase.from('price_obs').insert(clean)
  if (error) return
  const now = new Date().toISOString()
  publish([
    ...clean.map((c) => ({
      name: c.name,
      key: c.name_key,
      store: c.store,
      price: c.price,
      unitPrice: c.unit_price,
      unitLabel: c.unit_label,
      at: now,
      barcode: c.barcode,
    })),
    ...(cache ?? []),
  ])
}

export interface StorePrice {
  store: string
  price: number
  unitPrice: number | null
  unitLabel: string | null
  at: string
}

/** Dernier prix connu par magasin pour un produit, du moins cher au plus cher. */
export function pricesByStore(obs: PriceObs[], name: string, barcode?: string | null): StorePrice[] {
  const k = priceKey(name)
  const latest = new Map<string, StorePrice>()
  for (const o of obs) {
    // Même produit : même code-barres, ou à défaut même nom.
    if (!(barcode && o.barcode === barcode) && o.key !== k) continue
    const s = o.store.trim()
    const sk = priceKey(s)
    if (!latest.has(sk)) latest.set(sk, { store: s, price: o.price, unitPrice: o.unitPrice, unitLabel: o.unitLabel, at: o.at })
  }
  const list = [...latest.values()]
  // Prix au kilo/litre quand tous les magasins l'ont (contenances différentes), sinon prix du paquet.
  const byUnit = list.length > 1 && list.every((p) => p.unitPrice != null && p.unitLabel === list[0].unitLabel)
  return list.sort((a, b) => (byUnit ? a.unitPrice! - b.unitPrice! : a.price - b.price))
}

export const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

/** Dernier prix payé pour un produit dans un magasin donné (code-barres d'abord, sinon nom). */
export function lastPriceAt(obs: PriceObs[], name: string, store: string, barcode?: string | null): number | null {
  const k = priceKey(name)
  const sk = priceKey(store)
  for (const o of obs) {
    if (priceKey(o.store) !== sk) continue
    if ((barcode && o.barcode === barcode) || o.key === k) return o.price
  }
  return null
}
