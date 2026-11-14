/**
 * Outils pour les produits vendus au poids / volume (riz, pâtes, farine, lait…).
 * Permet de consommer une fraction ou une quantité précise de la contenance,
 * plutôt que de retirer des unités entières.
 */

/** Unités « continues » (au poids ou au volume) qui autorisent une conso partielle. */
export const WEIGHT_UNITS = ['g', 'kg', 'mL', 'ml', 'cl', 'L', 'l', 'sachet', 'sachets']

interface Parsed {
  value: number
  unit: string
}

/**
 * La contenance peut mémoriser la quantité d'origine : « 700 g/1 kg » = il reste 700 g sur 1 kg.
 * Sans « / », il n'y a que la quantité actuelle (« 1 kg »).
 */
export function splitSize(size?: string): { current: string; full?: string } {
  if (!size) return { current: '' }
  const i = size.indexOf('/')
  if (i < 0) return { current: size.trim() }
  return { current: size.slice(0, i).trim(), full: size.slice(i + 1).trim() || undefined }
}

/** Sépare une contenance « 1 kg » / « 400 g » en { value, unit } (partie actuelle uniquement). */
export function parseContenance(size?: string): Parsed | null {
  if (!size) return null
  const m = splitSize(size).current.match(/^([\d.,]+)\s*(.+)$/)
  if (!m) return null
  const value = Number(m[1].replace(',', '.'))
  if (!isFinite(value) || value <= 0) return null
  return { value, unit: m[2].trim() }
}

/** Vrai si l'unité est au poids ou au volume (g, kg, mL, cl, L). */
export function isWeightUnit(unit?: string): boolean {
  return !!unit && WEIGHT_UNITS.includes(unit)
}

/** Vrai si la contenance est exprimée dans une unité au poids/volume. */
export function isWeightProduct(size?: string): boolean {
  const p = parseContenance(size)
  return !!p && WEIGHT_UNITS.includes(p.unit)
}

/** Infos en unité de base (g ou mL) pour la molette de portions. */
export function weightInfo(size?: string): { baseUnit: 'g' | 'mL' | 'sachet'; total: number } | null {
  const p = parseContenance(size)
  if (!p) return null
  const fam = family(p.unit)
  if (!fam) return null
  return { baseUnit: fam === 'mass' ? 'g' : fam === 'count' ? 'sachet' : 'mL', total: toBase(p.value, p.unit) }
}

/** Graduation fine (précision) + intervalle d'étiquetage (valeurs rondes). */
function scaleSteps(total: number, count = false): { fine: number; major: number } {
  if (count) return { fine: 1, major: total > 12 ? 2 : 1 } // sachets : un par un
  if (total <= 200) return { fine: 5, major: 25 }
  if (total <= 600) return { fine: 5, major: 50 }
  if (total <= 2000) return { fine: 10, major: 100 }
  if (total <= 5000) return { fine: 25, major: 250 }
  return { fine: 50, major: 500 }
}

/**
 * Réglette graduée pour la portion : valeurs fines de 0 au total,
 * + le pas « majeur » pour savoir lesquelles étiqueter.
 */
export function portionScale(
  size?: string,
): { values: number[]; baseUnit: 'g' | 'mL' | 'sachet'; major: number } | null {
  const wi = weightInfo(size)
  if (!wi) return null
  const { fine, major } = scaleSteps(wi.total, wi.baseUnit === 'sachet')
  const values: number[] = []
  for (let v = 0; v < wi.total - 0.001; v += fine) values.push(Math.round(v))
  values.push(Math.round(wi.total)) // toujours finir pile au total
  return { values, baseUnit: wi.baseUnit, major }
}

/**
 * Échelle d'achat adaptée à l'unité d'un article (roulette des courses).
 * Renvoie les paliers, l'unité de base de stockage, le formatage et la valeur
 * par défaut. Les nombres (pièces) vont de 1 à 30.
 */
export function buyScale(rawUnit?: string): {
  values: number[]
  baseUnit: string
  format: (v: number) => string
  defaultValue: number
} {
  const fam = rawUnit ? family(rawUnit) : null
  if (fam === 'mass') {
    return {
      values: [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1250, 1500, 2000, 3000],
      baseUnit: 'g',
      format: (v) => formatContenance(v, 'g'),
      defaultValue: 500,
    }
  }
  if (fam === 'volume') {
    return {
      values: [100, 200, 250, 330, 500, 750, 1000, 1500, 2000, 3000],
      baseUnit: 'mL',
      format: (v) => formatContenance(v, 'mL'),
      defaultValue: 1000,
    }
  }
  const values: number[] = []
  for (let v = 1; v <= 30; v++) values.push(v)
  return { values, baseUnit: '', format: (v) => `×${v}`, defaultValue: 1 }
}

/** Famille d'unité pour la conversion (mass / volume / null). */
function family(unit: string): 'mass' | 'volume' | 'count' | null {
  const u = unit.toLowerCase()
  if (u === 'sachet' || u === 'sachets') return 'count'
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
  if (u === 'sachet' || u === 'sachets') return `${round(value)} sachet${value > 1 ? 's' : ''}`
  if (u === 'g' && value >= 1000) return `${round(value / 1000)} kg`
  if (u === 'ml' && value >= 1000) return `${round(value / 1000)} L`
  if (u === 'kg' && value < 1) return `${Math.round(value * 1000)} g`
  if (u === 'l' && value < 1) return `${Math.round(value * 1000)} mL`
  return `${round(value)} ${unit}`
}

/**
 * Libellé de quantité d'un produit au poids / volume :
 * « 1 kg » (plein), « 700 g / 1 kg » (entamé), « 3 × 1 kg » (plusieurs paquets).
 * Renvoie null pour les produits comptés à l'unité.
 */
export function stockLabel(p: { quantity: number; size?: string }): string | null {
  if (!isWeightProduct(p.size)) return null
  const { current, full } = splitSize(p.size)
  const cur = parseContenance(current)!
  const curLabel = formatContenance(cur.value, cur.unit)
  if (p.quantity > 1) return `${p.quantity} × ${curLabel}`
  const fu = parseContenance(full)
  if (fu && family(fu.unit) === family(cur.unit) && toBase(cur.value, cur.unit) < toBase(fu.value, fu.unit) - 0.001) {
    return `${curLabel} / ${formatContenance(fu.value, fu.unit)}`
  }
  return curLabel
}

/** Contenance restante seule (sans la quantité d'origine), pour les messages. */
export function remainingLabel(size: string): string {
  return splitSize(size).current
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
  return withFull(formatContenance(remaining, p.unit), size, p)
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
  return withFull(formatContenance(remainingBase / factor, p.unit), size, p)
}

/** Ajoute la quantité d'origine (« /1 kg ») à une contenance restante. */
function withFull(remaining: string, oldSize: string, p: Parsed): string {
  const full = splitSize(oldSize).full ?? formatContenance(p.value, p.unit)
  return `${remaining}/${full}`
}

/**
 * Anciennes données : contenance réduite à une unité seule (« kg ») avec la quantité à part (×1).
 * On lit ça comme « 1 kg ».
 */
export function isBareWeightUnit(size?: string): boolean {
  return !!size && WEIGHT_UNITS.includes(size.trim())
}

/** Produit corrigé pour l'affichage : « kg » × 2 devient « 2 kg » × 1. */
export function normalizeBareUnit<T extends { quantity: number; size?: string }>(p: T): T {
  if (!isBareWeightUnit(p.size)) return p
  return { ...p, size: formatContenance(p.quantity, p.size!.trim()), quantity: 1 }
}

/** Nombre de sachets par boîte (« 10 sachet »), ou null si le produit n'est pas compté en sachets. */
export function sachetsPerBox(size?: string): number | null {
  const p = parseContenance(size)
  if (!p || family(p.unit) !== 'count') return null
  return Math.round(p.value)
}
