import type { Category } from '../types'

/**
 * Épicerie sèche et conserves : la date de préférence (DDM) n'a pas d'intérêt pratique.
 * Une DDM dépassée y est ignorée, et aucune date n'est estimée automatiquement.
 */
const WORDS = [
  'pates', 'pate seche', 'spaghetti', 'spaghettis', 'fusilli', 'penne', 'macaroni', 'macaronis', 'tagliatelle', 'tagliatelles',
  'farfalle', 'coquillettes', 'linguine', 'capellini', 'torsades', 'coquillages', 'vermicelle', 'vermicelles', 'lasagne seche',
  'nouilles', 'noodles', 'ramen', 'udon', 'soba', 'riz', 'semoule', 'couscous', 'quinoa', 'boulgour', 'ebly', 'polenta',
  'lentilles', 'pois casses', 'haricots secs', 'farine', 'sucre', 'cassonade', 'sel', 'gros sel', 'flocons d avoine', 'avoine',
  'maizena', 'fecule', 'chapelure', 'tapioca',
]
const norm = (s: string) =>
  ' ' + s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '

export function isDryStaple(name: string, category?: Category): boolean {
  if (category === 'conserves') return true
  if (category && category !== 'epicerie') return false
  const n = norm(name)
  // Pâtes fraîches à étaler (feuilletée, brisée, pizza…) : vraie date à suivre.
  if (/ (feuillet|bris|sabl|pizza|a tartiner|fraiche)/.test(n)) return false
  return WORDS.some((w) => n.includes(` ${w} `))
}
