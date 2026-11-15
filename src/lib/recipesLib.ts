import type { FamilyMember, Product, Recipe, RecipeIngredient } from '../types'
import { productImageSlug } from './productImage'

/** Normalise une chaîne pour comparaison : minuscules, sans accents, sans pluriel simple. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/s\b/g, '')
    .trim()
}

function score(ing: string, name: string): number {
  if (!ing || !name) return 0
  if (ing === name) return 4
  if (name.startsWith(ing) || ing.startsWith(name)) return 3
  if (name.includes(ing) || ing.includes(name)) return 2
  return 0
}

/**
 * Produit du stock lié à un ingrédient : d'abord le lien explicite (productId),
 * sinon le meilleur rapprochement par nom (les produits en stock passent avant les vides).
 * Sans correspondance, l'ingrédient reste générique (undefined).
 */
export function linkedProduct(ingredient: RecipeIngredient, products: Product[]): Product | undefined {
  if (ingredient.productId) {
    const direct = products.find((p) => p.id === ingredient.productId)
    if (direct) return direct
  }
  const ing = norm(ingredient.name)
  let best: Product | undefined
  let bestScore = 0
  for (const p of products) {
    const s = score(ing, norm(p.name)) * 10 + (p.quantity > 0 ? 5 : 0)
    if (score(ing, norm(p.name)) > 0 && s > bestScore) {
      best = p
      bestScore = s
    }
  }
  return best
}

/** Un ingrédient est-il disponible dans le stock ? */
export function isIngredientInStock(ingredient: RecipeIngredient, products: Product[]): boolean {
  const p = linkedProduct(ingredient, products)
  return !!p && p.quantity > 0
}

export interface RecipeStock {
  inStock: number
  missing: number
  total: number
  missingIngredients: RecipeIngredient[]
}

/** Bilan des ingrédients d'une recette par rapport au stock. */
export function recipeStock(recipe: Recipe, products: Product[]): RecipeStock {
  const missingIngredients = recipe.ingredients.filter((i) => !isIngredientInStock(i, products))
  const missing = missingIngredients.length
  const total = recipe.ingredients.length
  return { inStock: total - missing, missing, total, missingIngredients }
}

const MEAT = ['poulet', 'boeuf', 'porc', 'jambon', 'lardon', 'viande', 'saucisse', 'dinde', 'agneau', 'bacon']
const FISH = ['poisson', 'saumon', 'thon', 'crevette', 'cabillaud', 'fruits de mer']
const GLUTEN = ['pate', 'spaghetti', 'farine', 'pain', 'ble', 'semoule', 'crouton', 'biscuit']
const LACTOSE = ['lait', 'creme', 'fromage', 'beurre', 'yaourt', 'comte', 'parmesan', 'mozzarella']

function ingredientsText(recipe: Recipe): string {
  return recipe.ingredients.map((i) => i.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')).join(' ')
}

/** Note d'adaptation d'une recette pour un membre (ou null si rien à signaler). */
export function adaptationFor(recipe: Recipe, member: FamilyMember): string | null {
  const text = ingredientsText(recipe)
  const notes: string[] = []

  const hasMeat = MEAT.some((w) => text.includes(w))
  const hasFish = FISH.some((w) => text.includes(w))

  if ((member.diet === 'vegetarien' || member.diet === 'vegetalien') && (hasMeat || hasFish)) {
    notes.push('remplacer la viande/le poisson par une option végétale')
  }
  if (member.diet === 'pescetarien' && hasMeat) {
    notes.push('remplacer la viande par du poisson')
  }
  if (member.diet === 'vegetalien' && LACTOSE.some((w) => text.includes(w))) {
    notes.push('utiliser des alternatives végétales (lait/fromage)')
  }

  for (const r of member.restrictions) {
    const rn = r.toLowerCase()
    if (rn.includes('gluten') && GLUTEN.some((w) => text.includes(w))) notes.push('version sans gluten')
    if (rn.includes('lactose') && LACTOSE.some((w) => text.includes(w))) notes.push('version sans lactose')
    if (rn.includes('porc') && text.includes('porc')) notes.push('sans porc')
    if (rn.includes('fruits de mer') && FISH.some((w) => text.includes(w))) notes.push('sans fruits de mer')
  }

  if (member.aversions) {
    for (const a of member.aversions.split(',').map((x) => x.trim()).filter(Boolean)) {
      if (text.includes(a.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))) {
        notes.push(`sans ${a}`)
      }
    }
  }

  if (notes.length === 0) return null
  return notes.join(', ')
}

const UNI: Record<string, number> = { '⅛': 0.125, '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }
const NUM = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?|[½¼¾⅓⅔⅛])'
const QTY_RE = new RegExp(`^(\\s*)(${NUM})(?:(\\s*(?:-|à)\\s*)(${NUM}))?`)

function parseNum(s: string): number {
  if (UNI[s] !== undefined) return UNI[s]
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[1]) / Number(frac[2])
  return Number(s.replace(',', '.'))
}

function fmtNum(v: number): string {
  if (v >= 100) return String(Math.round(v))
  const whole = Math.floor(v + 1e-9)
  const f = v - whole
  const marks: [number, string][] = [[0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']]
  if (v < 10) {
    if (f < 0.04) return String(whole)
    if (f > 0.96) return String(whole + 1)
    for (const [x, ch] of marks) if (Math.abs(f - x) < 0.04) return whole > 0 ? `${whole}${ch}` : ch
  }
  const r = v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100
  return String(r).replace('.', ',')
}

/** Adapte une quantité libre ("200 g", "1/2 c. à café", "2-3") à un autre nombre de personnes. */
export function scaleQty(qty: string | undefined, from: number, to: number): string | undefined {
  if (!qty || !from || from === to) return qty
  const m = qty.match(QTY_RE)
  if (!m) return qty
  const k = to / from
  const a = fmtNum(parseNum(m[2]) * k)
  const b = m[4] ? fmtNum(parseNum(m[4]) * k) : ''
  return `${m[1]}${a}${m[3] ?? ''}${b}${qty.slice(m[0].length)}`
}

/** Icône d'une recette : devinée depuis le titre, sinon depuis son premier ingrédient reconnu. */
export function recipeIconSlug(recipe: Recipe): string | null {
  if (recipe.icon) return recipe.icon
  const fromTitle = productImageSlug(recipe.title)
  if (fromTitle) return fromTitle
  for (const ing of recipe.ingredients) {
    const s = productImageSlug(ing.name)
    if (s) return s
  }
  return null
}
