import type { Category, Conservation } from '../types'
import { isDryStaple } from './dryStaple'
import { addDays, toISODate } from './dates'
import { learnedFor } from './learnedShelf'
import type { DateType } from '../types'

/**
 * Estimation de la durée de conservation (en jours) selon le type d'aliment.
 * Valeurs indicatives pour une conservation domestique typique.
 */
interface ShelfEntry {
  kw: string // mot-clé (normalisé, sans accent)
  days: number // durée « frais » (ou au réfrigérateur pour viandes/poissons/laitiers)
  group: string // libellé du groupe d'aliments
  fridge?: number // durée au réfrigérateur quand elle est documentée
  freezer?: number // durée au congélateur (qualité) quand elle est documentée
}

const TABLE: ShelfEntry[] = [
  // Fruits
  ['banane', 5], ['pomme', 20], ['poire', 7], ['fraise', 3], ['framboise', 2],
  ['myrtille', 5], ['raisin', 7], ['orange', 14], ['clementine', 12], ['mandarine', 12],
  ['citron', 21], ['kiwi', 14], ['peche', 5], ['nectarine', 5], ['abricot', 5],
  ['prune', 5], ['cerise', 5], ['melon', 5], ['pasteque', 7], ['mangue', 5],
  ['ananas', 5], ['avocat', 4], ['figue', 3],
].map(([kw, days]) => ({ kw: kw as string, days: days as number, group: 'Fruits' }))

/**
 * Sources : USDA FoodKeeper (FSIS/Cornell/FMI) et tableau « Cold Food Storage » de FoodSafety.gov (USDA/FDA).
 * Légumes : [mot-clé, jours « frais », jours au frigo, jours au congélateur]. Congélateur = qualité, pas sécurité.
 * Sans valeur documentée, on garde l'ancienne estimation (frigo = frais x 2,2, congélateur = 240 jours).
 */
const VEG_ROWS: [string, number, number?, number?][] = [
  ['salade', 5, 4, 60], ['laitue', 5, 4, 60], ['epinard', 4, 4, 330], ['mache', 4], ['roquette', 4],
  ['tomate', 5, 5, 60], ['concombre', 4, 5, 60], ['courgette', 4, 4, 330], ['aubergine', 7], ['poivron', 10],
  ['carotte', 14, 14, 330], ['pomme de terre', 30, 30, 330], ['patate', 30], ['oignon', 30, 60, 330], ['echalote', 30],
  ['ail', 60], ['brocoli', 3, 3, 330], ['chou-fleur', 3, 3, 330], ['chou de bruxelles', 4, 4, 330], ['chou', 7, 7, 330],
  ['champignon', 3, 3], ['haricot', 5], ['courge', 30, 7, 330], ['potiron', 30, 7, 330], ['celeri', 7, 7, 330],
  ['radis', 7], ['poireau', 10], ['betterave', 14, 14, 270], ['navet', 21], ['fenouil', 10], ['asperge', 3, 3, 150],
  ['petit pois', 4], ['mais', 5], ['endive', 7],
]
const VEG: ShelfEntry[] = VEG_ROWS.map(([kw, days, fridge, freezer]) => ({ kw, days, group: 'Légumes', fridge, freezer }))

/** Viandes : [mot-clé, jours au frigo, jours au congélateur] (valeurs prudentes des fourchettes USDA). */
const MEAT_ROWS: [string, number, number][] = [
  ['poulet', 2, 270], ['dinde', 2, 270], ['boeuf', 3, 240], ['porc', 3, 240], ['veau', 3, 240], ['agneau', 3, 240],
  ['viande', 3, 240], ['steak', 3, 240], ['hache', 2, 90], ['steak hache', 2, 90], ['entrecote', 3, 240], ['rumsteck', 3, 240], ['bavette', 3, 240], ['cotelette', 3, 240], ['escalope', 2, 270], ['gigot', 3, 240], ['magret', 2, 270], ['canard', 2, 270], ['lapin', 3, 240], ['blanc de poulet', 2, 270], ['saucisse', 2, 60], ['merguez', 2, 60],
  ['lardon', 7, 30], ['jambon', 5, 45], ['charcuterie', 5, 45], ['bacon', 7, 30],
]
const MEAT: ShelfEntry[] = MEAT_ROWS.map(([kw, days, freezer]) => ({ kw, days, group: 'Viandes', freezer }))

const FISH: ShelfEntry[] = [
  ['poisson', 2, 90], ['saumon', 2, 60], ['thon', 2, 60], ['cabillaud', 2, 180], ['crevette', 2, 90],
  ['moule', 2, 90], ['fruits de mer', 2, 90], ['truite', 2, 60], ['colin', 2, 180],
].map(([kw, days, freezer]) => ({ kw: kw as string, days: days as number, group: 'Poissons', freezer: freezer as number }))

const DAIRY: ShelfEntry[] = [
  ['lait', 7], ['yaourt', 14], ['fromage', 14], ['comte', 25], ['parmesan', 40],
  ['mozzarella', 7], ['beurre', 30], ['creme', 7], ['oeuf', 21], ['oeufs', 21],
].map(([kw, days]) => ({ kw: kw as string, days: days as number, group: 'Produits laitiers' }))

const BAKERY: ShelfEntry[] = [
  ['pain', 4], ['baguette', 2], ['brioche', 5], ['croissant', 2], ['viennoiserie', 2],
].map(([kw, days]) => ({ kw: kw as string, days: days as number, group: 'Boulangerie' }))

const PANTRY: ShelfEntry[] = [
  ['pate', 540], ['spaghetti', 540], ['riz', 540], ['farine', 365], ['sucre', 999],
  ['conserve', 720], ['cafe', 365], ['the', 365], ['biscuit', 180], ['cereale', 240],
  ['huile', 365], ['lentille', 540], ['pois chiche', 540], ['haricot sec', 540],
  ['chocolat', 365], ['miel', 999], ['confiture', 365], ['semoule', 365],
  ['farfalle', 540], ['fusilli', 540], ['penne', 540], ['tagliatelle', 540], ['macaroni', 540],
  ['coquillette', 540], ['rigatoni', 540], ['linguine', 540], ['nouille', 540], ['vermicelle', 540],
  ['quinoa', 540], ['boulgour', 540], ['polenta', 540],
].map(([kw, days]) => ({ kw: kw as string, days: days as number, group: 'Épicerie' }))

const ALL: ShelfEntry[] = [...MEAT, ...FISH, ...DAIRY, ...BAKERY, ...VEG, ...PANTRY, ...TABLE]

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export interface ShelfEstimate {
  days: number
  group: string
  /** Estimation issue de ce que l'utilisateur a déjà renseigné (nombre de produits similaires). */
  learned?: { count: number; exact: boolean }
}

// Durée au congélateur (jours) selon le groupe d'aliments.
const FREEZER_DAYS: Record<string, number> = {
  Fruits: 180,
  Légumes: 240,
  Viandes: 180,
  Poissons: 120,
  'Produits laitiers': 90,
  Boulangerie: 90,
  Épicerie: 540,
}

const PRODUCE = new Set(['Fruits', 'Légumes'])
const PERISHABLE = new Set(['Viandes', 'Viandes VG', 'Poissons', 'Produits laitiers'])

// Base par catégorie d'aliment (repli quand le nom n'est pas reconnu).
const CAT_BASE: Partial<Record<Category, ShelfEstimate>> = {
  fruits: { days: 7, group: 'Fruits' },
  legumes: { days: 7, group: 'Légumes' },
  viandes: { days: 3, group: 'Viandes' },
  'viandes-vg': { days: 7, group: 'Viandes VG' },
  poissons: { days: 2, group: 'Poissons' },
  laitiers: { days: 10, group: 'Produits laitiers' },
  epicerie: { days: 365, group: 'Épicerie' },
  huiles: { days: 540, group: 'Épicerie' },
  conserves: { days: 720, group: 'Épicerie' },
  sucreries: { days: 365, group: 'Épicerie' },
  patisserie: { days: 365, group: 'Épicerie' },
  apero: { days: 180, group: 'Épicerie' },
  boissons: { days: 180, group: 'Épicerie' },
  surgeles: { days: 300, group: 'Surgelés' },
}

/**
 * Estime la durée de conservation d'après le nom de l'aliment ET le mode de
 * conservation (frais / réfrigéré / congelé). Repli sur la catégorie si le nom
 * n'est pas reconnu. Renvoie null si rien d'exploitable.
 */
const FROZEN_NAME = /surgel|congel|frozen/

/** Vrai si le nom indique un produit surgelé / congelé. */
export function isFrozenName(name: string): boolean {
  return FROZEN_NAME.test(norm(name))
}

export function estimateShelfLife(
  name: string,
  conservation: Conservation = 'frais',
  category?: Category,
): ShelfEstimate | null {
  const n = norm(name)
  // « poisson surgelé », « filet congelé » : le nom dit déjà que c'est au congélateur.
  if (FROZEN_NAME.test(n)) conservation = 'congele'

  // 0) Ce que l'utilisateur a déjà renseigné pour ce produit ou des produits similaires.
  const l = learnedFor(name, conservation, category)
  if (l?.days) {
    return {
      days: l.days,
      group: CAT_BASE[category ?? 'autre']?.group ?? 'Produits similaires',
      learned: { count: l.count, exact: l.exact },
    }
  }

  // 1) Match par mot-clé (le plus spécifique).
  let base: ShelfEstimate | null = null
  let hit: ShelfEntry | null = null
  if (n.trim().length >= 2) {
    let best: ShelfEntry | null = null
    for (const e of ALL) {
      if (n.includes(e.kw) && (!best || e.kw.length > best.kw.length)) best = e
    }
    if (best) {
      base = { days: best.days, group: best.group }
      hit = best
    }
  }
  // 2) Repli par catégorie.
  if (!base && category) base = CAT_BASE[category] ?? null
  if (!base) return null

  let days = base.days
  const group = base.group

  if (conservation === 'congele') {
    days = hit?.freezer ?? Math.max(days, FREEZER_DAYS[group] ?? 180)
  } else if (conservation === 'refrigere') {
    if (hit?.fridge) days = hit.fridge
    else if (PRODUCE.has(group)) days = Math.round(days * 2.2)
  } else {
    // Frais / température ambiante : risqué pour les denrées qui exigent le froid.
    if (PERISHABLE.has(group)) days = Math.max(1, Math.round(days / 3))
  }

  return { days, group }
}

/** Date ISO estimée de péremption (aujourd'hui + durée estimée). */
export function estimatedExpiryISO(
  name: string,
  conservation: Conservation = 'frais',
  category?: Category,
): string | null {
  // Épicerie sèche / conserves : pas de date estimée (on ne suit pas leur DDM).
  if (conservation !== 'congele' && isDryStaple(name, category)) return null
  const est = estimateShelfLife(name, conservation, category)
  if (!est) return null
  return toISODate(addDays(new Date(), est.days))
}

/** Libellé court d'une durée (« ~5 jours », « ~3 semaines », « ~18 mois »). */
export function durationLabel(days: number): string {
  if (days < 14) return `~${days} jour${days > 1 ? 's' : ''}`
  if (days < 60) return `~${Math.round(days / 7)} semaines`
  return `~${Math.round(days / 30)} mois`
}

// Mots-clés dont la date est une DDM (« à consommer de préférence avant ») même dans un rayon frais.
const DDM_KW = ['oeuf', 'beurre', 'parmesan', 'comte', 'emmental', 'gruyere', 'miel', 'pain', 'baguette', 'brioche']
const DLC_KW = ['jambon', 'saucisse', 'poulet', 'dinde', 'lardon', 'bacon', 'hache', 'poisson', 'saumon', 'crevette', 'yaourt', 'creme', 'lait frais', 'mozzarella', 'plat cuisine', 'traiteur']
const DDM_CATS = new Set<Category>(['epicerie', 'huiles', 'conserves', 'sucreries', 'patisserie', 'apero', 'boissons', 'surgeles', 'fruits', 'legumes'])
const DLC_CATS = new Set<Category>(['viandes', 'viandes-vg', 'poissons', 'laitiers'])

/**
 * DLC (dangereux après la date) ou DDM (juste moins bon) : ce que l'utilisateur
 * a choisi pour des produits similaires, sinon une règle par type d'aliment.
 */
export function guessDateType(
  name: string,
  conservation: Conservation = 'frais',
  category?: Category,
): { type: DateType; learned: boolean } {
  const l = learnedFor(name, conservation, category)
  if (l?.dateType) return { type: l.dateType, learned: true }
  const n = norm(name)
  if (DLC_KW.some((k) => n.includes(k))) return { type: 'dlc', learned: false }
  if (DDM_KW.some((k) => n.includes(k))) return { type: 'ddm', learned: false }
  if (conservation === 'congele') return { type: 'ddm', learned: false }
  if (category && DLC_CATS.has(category)) return { type: 'dlc', learned: false }
  if (category && DDM_CATS.has(category)) return { type: 'ddm', learned: false }
  // Mot-clé épicerie reconnu (pâtes, riz, farine...) : DDM.
  const est = estimateShelfLife(name, conservation, category)
  if (est && est.group === 'Épicerie') return { type: 'ddm', learned: false }
  return { type: 'dlc', learned: false }
}
