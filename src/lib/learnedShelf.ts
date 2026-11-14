import type { Category, Conservation, DateType, Product } from '../types'
import { fromISODate } from './dates'
import { normalize } from './productIcon'

/**
 * Apprentissage des durées de conservation et du type de date (DLC / DDM)
 * à partir de ce que l'utilisateur renseigne.
 * Stockage local (localStorage), alimenté aussi par le stock synchronisé.
 */
interface Learned {
  /** Nom normalisé. */
  key: string
  category: Category
  conservation: Conservation
  /** Durées observées (jours entre ajout et date de péremption), les 5 dernières. */
  days: number[]
  /** Dernier type de date choisi explicitement. */
  dateType?: DateType
}

const LS_KEY = 'miamm.learnedShelf.v1'

function load(): Learned[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Learned[]) : []
  } catch {
    return []
  }
}

function save(list: Learned[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(-400)))
  } catch {
    /* stockage indisponible : on ignore */
  }
}

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'au', 'aux', 'en', 'et', 'a', 'd', 'l', 'bio'])

/** Mots significatifs d'un nom (sans accent, sans pluriel, sans mots vides). */
export function tokens(name: string): string[] {
  return normalize(name)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t))
    .map((t) => (t.length > 3 && /[sx]$/.test(t) ? t.slice(0, -1) : t))
}

function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const sb = new Set(b)
  const shared = a.filter((t) => sb.has(t)).length
  return shared / Math.min(a.length, b.length)
}

function median(n: number[]): number {
  const s = [...n].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** Enregistre ce que l'utilisateur vient de renseigner. */
export function learn(p: {
  name: string
  category: Category
  conservation?: Conservation
  expiryDate?: string
  dateType?: DateType
  /** Date de départ (ISO) pour calculer la durée ; sinon aujourd'hui. */
  from?: string
  /** true si le type de date vient d'un choix explicite de l'utilisateur. */
  explicitDateType?: boolean
}) {
  const key = normalize(p.name).trim()
  if (key.length < 2) return
  const conservation = p.conservation ?? 'frais'
  const list = load()
  let e = list.find((x) => x.key === key && x.conservation === conservation)
  if (!e) {
    e = { key, category: p.category, conservation, days: [] }
    list.push(e)
  }
  e.category = p.category
  if (p.expiryDate) {
    const start = p.from ? fromISODate(p.from.slice(0, 10)) : new Date(new Date().setHours(0, 0, 0, 0))
    const days = Math.round((fromISODate(p.expiryDate).getTime() - start.getTime()) / 86400000)
    if (days > 0 && days <= 3650) e.days = [...e.days, days].slice(-5)
  }
  if (p.explicitDateType && p.dateType) e.dateType = p.dateType
  save(list)
}

/** Alimente l'apprentissage avec le stock déjà synchronisé (durées uniquement). */
export function seedFromProducts(products: Product[]) {
  const list = load()
  let changed = false
  for (const p of products) {
    if (!p.expiryDate) continue
    const key = normalize(p.name).trim()
    const conservation = p.conservation ?? 'frais'
    if (list.some((x) => x.key === key && x.conservation === conservation)) continue
    const days = Math.round(
      (fromISODate(p.expiryDate).getTime() - fromISODate(p.createdAt.slice(0, 10)).getTime()) / 86400000,
    )
    if (days > 0 && days <= 3650) {
      list.push({ key, category: p.category, conservation, days: [days] })
      changed = true
    }
  }
  if (changed) save(list)
}

export interface LearnedMatch {
  days?: number
  dateType?: DateType
  /** Nombre de produits similaires utilisés. */
  count: number
  /** true si c'est le même produit exactement. */
  exact: boolean
}

/** Cherche ce qu'on a appris sur ce produit ou sur des produits similaires. */
export function learnedFor(name: string, conservation: Conservation, category?: Category): LearnedMatch | null {
  const key = normalize(name).trim()
  if (key.length < 2) return null
  const list = load()
  const exact = list.find((x) => x.key === key && x.conservation === conservation)
  if (exact && (exact.days.length || exact.dateType)) {
    return {
      days: exact.days.length ? median(exact.days) : undefined,
      dateType: exact.dateType,
      count: 1,
      exact: true,
    }
  }
  const tk = tokens(name)
  const similar = list.filter(
    (x) => x.conservation === conservation && x.key !== key && similarity(tk, tokens(x.key)) >= 0.5,
  )
  // Repli : même catégorie, seulement si on a au moins 3 exemples.
  const pool = similar.length
    ? similar
    : category
      ? list.filter((x) => x.conservation === conservation && x.category === category && x.days.length)
      : []
  if (!similar.length && pool.length < 3) return null
  if (!pool.length) return null
  const allDays = pool.flatMap((x) => x.days)
  const types = pool.map((x) => x.dateType).filter(Boolean) as DateType[]
  const dlc = types.filter((t) => t === 'dlc').length
  const ddm = types.length - dlc
  return {
    days: allDays.length ? median(allDays) : undefined,
    dateType: types.length ? (ddm > dlc ? 'ddm' : 'dlc') : undefined,
    count: pool.length,
    exact: false,
  }
}
