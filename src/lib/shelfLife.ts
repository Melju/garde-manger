import type { Category } from '../types'
import { addDays, toISODate } from './dates'

/**
 * Estimation de la durée de conservation (en jours) selon le type d'aliment.
 * Valeurs indicatives pour une conservation domestique typique.
 */
interface ShelfEntry {
  kw: string // mot-clé (normalisé, sans accent)
  days: number
  group: string // libellé du groupe d'aliments
}

const TABLE: ShelfEntry[] = [
  // Fruits
  ['banane', 5], ['pomme', 20], ['poire', 7], ['fraise', 3], ['framboise', 2],
  ['myrtille', 5], ['raisin', 7], ['orange', 14], ['clementine', 12], ['mandarine', 12],
  ['citron', 21], ['kiwi', 14], ['peche', 5], ['nectarine', 5], ['abricot', 5],
  ['prune', 5], ['cerise', 5], ['melon', 5], ['pasteque', 7], ['mangue', 5],
  ['ananas', 5], ['avocat', 4], ['figue', 3],
].map(([kw, days]) => ({ kw: kw as string, days: days as number, group: 'Fruits' }))

const VEG: ShelfEntry[] = [
  ['salade', 5], ['laitue', 5], ['epinard', 4], ['mache', 4], ['roquette', 4],
  ['tomate', 7], ['concombre', 7], ['courgette', 7], ['aubergine', 7], ['poivron', 10],
  ['carotte', 21], ['pomme de terre', 30], ['patate', 30], ['oignon', 30], ['echalote', 30],
  ['ail', 60], ['brocoli', 5], ['chou-fleur', 6], ['chou', 14], ['champignon', 4],
  ['haricot', 5], ['courge', 30], ['potiron', 30], ['celeri', 10], ['radis', 7],
  ['poireau', 10], ['betterave', 21], ['navet', 21], ['fenouil', 10], ['asperge', 4],
  ['petit pois', 4], ['mais', 5], ['endive', 7],
].map(([kw, days]) => ({ kw: kw as string, days: days as number, group: 'Légumes' }))

const MEAT: ShelfEntry[] = [
  ['poulet', 3], ['dinde', 3], ['boeuf', 3], ['porc', 3], ['veau', 3], ['agneau', 3],
  ['viande', 3], ['steak', 3], ['hache', 2], ['saucisse', 3], ['merguez', 3],
  ['lardon', 7], ['jambon', 5], ['charcuterie', 5], ['bacon', 7],
].map(([kw, days]) => ({ kw: kw as string, days: days as number, group: 'Viandes' }))

const FISH: ShelfEntry[] = [
  ['poisson', 2], ['saumon', 2], ['thon', 2], ['cabillaud', 2], ['crevette', 2],
  ['moule', 2], ['fruits de mer', 2], ['truite', 2], ['colin', 2],
].map(([kw, days]) => ({ kw: kw as string, days: days as number, group: 'Poissons' }))

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
].map(([kw, days]) => ({ kw: kw as string, days: days as number, group: 'Épicerie' }))

const ALL: ShelfEntry[] = [...MEAT, ...FISH, ...DAIRY, ...BAKERY, ...VEG, ...PANTRY, ...TABLE]

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export interface ShelfEstimate {
  days: number
  group: string
}

/**
 * Estime la durée de conservation d'un produit d'après son nom (et, en secours,
 * sa catégorie de rangement). Renvoie null si rien ne correspond.
 */
export function estimateShelfLife(name: string, category?: Category): ShelfEstimate | null {
  const n = norm(name)
  if (n.trim().length < 2) return null

  // Cherche le mot-clé le plus long contenu dans le nom (plus spécifique).
  let best: ShelfEntry | null = null
  for (const e of ALL) {
    if (n.includes(e.kw) && (!best || e.kw.length > best.kw.length)) best = e
  }

  if (best) {
    let days = best.days
    // Le congélateur prolonge fortement la conservation.
    if (category === 'surgeles') days = Math.max(days, 180)
    return { days, group: best.group }
  }

  // Pas de correspondance : estimation par catégorie de rangement.
  if (category === 'conserves') return { days: 720, group: 'Conserves' }
  if (category === 'surgeles') return { days: 300, group: 'Surgelés' }
  if (category === 'epicerie') return { days: 365, group: 'Épicerie' }
  return null
}

/** Date ISO estimée de péremption (aujourd'hui + durée estimée). */
export function estimatedExpiryISO(name: string, category?: Category): string | null {
  const est = estimateShelfLife(name, category)
  if (!est) return null
  return toISODate(addDays(new Date(), est.days))
}

/** Libellé court d'une durée (« ~5 jours », « ~3 semaines », « ~18 mois »). */
export function durationLabel(days: number): string {
  if (days < 14) return `~${days} jours`
  if (days < 60) return `~${Math.round(days / 7)} semaines`
  return `~${Math.round(days / 30)} mois`
}
