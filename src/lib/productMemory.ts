import type { Product, ProductInput } from '../types'
import { splitSize } from './contenance'

/**
 * Mémoire des produits par code-barres : au prochain scan, la fiche reprend tout
 * (nom, catégorie, contenance, emplacement, icône…) sauf la péremption, à renseigner de nouveau.
 * Stockage local ; alimentée aussi par le stock synchronisé.
 */
const LS_KEY = 'miamm.productMemory.v1'
type Mem = Record<string, Partial<ProductInput>>

function load(): Mem {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Mem) : {}
  } catch {
    return {}
  }
}
function save(m: Mem) {
  try {
    const keys = Object.keys(m)
    if (keys.length > 1500) for (const k of keys.slice(0, keys.length - 1500)) delete m[k]
    localStorage.setItem(LS_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

function template(p: Partial<ProductInput> & { name: string }): Partial<ProductInput> {
  // Contenance d'origine (« 700 g/1 kg » → « 1 kg »).
  const sz = p.size ? (splitSize(p.size).full ?? splitSize(p.size).current) : undefined
  return {
    name: p.name,
    category: p.category,
    size: sz || undefined,
    unit: p.unit,
    conservation: p.conservation,
    dateType: p.dateType,
    location: p.location,
    price: p.price,
    imageUrl: p.imageUrl,
    nutriscore: p.nutriscore,
    nova: p.nova,
    kcal: p.kcal,
    allergens: p.allergens,
    barcode: p.barcode,
    quantity: 1,
  }
}

export function rememberProduct(p: Partial<ProductInput> & { name: string }) {
  if (!p.barcode) return
  const m = load()
  m[p.barcode] = template(p)
  save(m)
}

export function seedProductMemory(products: Product[]) {
  const m = load()
  let changed = false
  for (const p of products) {
    if (p.barcode && !m[p.barcode]) {
      m[p.barcode] = template(p)
      changed = true
    }
  }
  if (changed) save(m)
}

/** Fiche mémorisée pour ce code-barres (sans péremption), ou null. */
export function recallProduct(barcode: string): Partial<ProductInput> | null {
  return load()[barcode] ?? null
}
