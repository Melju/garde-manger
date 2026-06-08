/**
 * Outils pour les produits vendus au poids / volume (riz, pâtes, farine, lait…).
 * Permet de consommer une fraction ou une quantité précise de la contenance,
 * plutôt que de retirer des unités entières.
 */

/** Unités « continues » (au poids ou au volume) qui autorisent une conso partielle. */
export const WEIGHT_UNITS = ['g', 'kg', 'mL', 'ml', 'cl', 'L', 'l']

interface Parsed {
  value: number
  unit: string
}

/** Sépare une contenance « 1 kg » / « 400 g » en { value, unit }. */
export function parseContenance(size?: string): Parsed | null {
  if (!size) return null
  const m = size.trim().match(/^([\d.,]+)\s*(.+)$/)
  if (!m) return null
  const value = Number(m[1].replace(',', '.'))
  if (!isFinite(value) || value <= 0) return null
  return { value, unit: m[2].trim() }
}

/** Vrai si la contenance est exprimée dans une unité au poids/volume. */
export function isWeightProduct(size?: string): boolean {
  const p = parseContenance(size)
  return !!p && WEIGHT_UNITS.includes(p.unit)
}

/** Infos en unité de base (g ou mL) pour la molette de portions. */
export function weightInfo(size?: string): { baseUnit: 'g' | 'mL'; total: number } | null {
  const p = parseContenance(size)
  if (!p) return null
  const fam = family(p.unit)
  if (!fam) return null
  return { baseUnit: fam === 'mass' ? 'g' : 'mL', total: toBase(p.value, p.unit) }
}

/** Pas d'aimantation adapté à la contenance totale (crans « ronds »). */
function snapStep(total: number): number {
  if (total <= 300) return 10
  if (total <= 600) return 25
  if (total <= 1500) return 50
  if (total <= 4000) return 100
  return 250
}

/** Valeurs proposées par la molette (en unité de base), de 0 au total. */
export function portionValues(size?: string): number[] {
  const wi = weightInfo(size)
  if (!wi) return []
  const step = snapStep(wi.total)
  const values: number[] = []
  for (let v = 0; v < wi.total - 0.001; v += step) values.push(Math.round(v))
  values.push(Math.round(wi.total)) // toujours finir pile au total
  return values
}

/** Famille d'unité pour la conversion (mass / volume / null). */
function family(unit: string): 'mass' | 'volume' | null {
  const u = unit.toLowerCase()
  if (u === 'g' || u === 'kg') return 'mass'
  if (u === 'ml' || u === 'cl' || u === 'l') return 'volume'
  return null
}

/** Convertit une valeur vers l'unité de base de sa famille (g ou mL). */
function toBase(value: number, unit: string): number {
  const u = unit.toLowerCase()
  if (u === 'kg' || u === 'l') return value * 1000
  if (u === 'cl') return value * 10
  return value // g, mL
}

/** Reformate une contenance proprement (passe en kg / L au-delà de 1000). */
export function formatContenance(value: number, unit: string): string {
  const u = unit.toLowerCase()
  const round = (n: number) => Math.round(n * 100) / 100
  if (u === 'g' && value >= 1000) return `${round(value / 1000)} kg`
  if (u === 'ml' && value >= 1000) return `${round(value / 1000)} L`
  if (u === 'kg' && value < 1) return `${Math.round(value * 1000)} g`
  if (u === 'l' && value < 1) return `${Math.round(value * 1000)} mL`
  return `${round(value)} ${unit}`
}

/**
 * Calcule la nouvelle contenance après consommation d'une fraction (0–1).
 * Renvoie la chaîne de contenance, ou null si tout est consommé (≈ 0).
 */
export function consumeFraction(size: string, fraction: number): string | null {
  const p = parseContenance(size)
  if (!p) return null
  const remaining = p.value * (1 - fraction)
  if (remaining <= p.value * 0.02) return null // reste négligeable → terminé
  return formatContenance(remaining, p.unit)
}

/**
 * Calcule la nouvelle contenance après retrait d'une quantité précise
 * (exprimée dans `amountUnit`). Renvoie null si épuisé / unités incompatibles → tout.
 */
export function consumeAmount(size: string, amount: number, amountUnit: string): string | null {
  const p = parseContenance(size)
  if (!p) return null
  if (family(p.unit) !== family(amountUnit)) return null // familles différentes → on vide
  const remainingBase = toBase(p.value, p.unit) - toBase(amount, amountUnit)
  if (remainingBase <= toBase(p.value, p.unit) * 0.02) return null
  // On reste dans l'unité d'origine du produit.
  const factor = toBase(1, p.unit)
  return formatContenance(remainingBase / factor, p.unit)
}
