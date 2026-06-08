import type { Category } from '../types'

/** Mots-clés (FR, sans accent) → catégorie, pour deviner depuis un nom libre. */
const RULES: { cat: Category; words: string[] }[] = [
  { cat: 'laitiers', words: ['lait', 'yaourt', 'yogourt', 'fromage', 'beurre', 'creme', 'oeuf', 'mozzarella', 'comte', 'emmental', 'chevre'] },
  { cat: 'fruits', words: ['pomme', 'banane', 'orange', 'fraise', 'raisin', 'poire', 'peche', 'abricot', 'kiwi', 'citron', 'fruit', 'cerise', 'melon', 'ananas', 'mangue'] },
  { cat: 'legumes', words: ['tomate', 'carotte', 'salade', 'courgette', 'oignon', 'ail', 'poireau', 'pomme de terre', 'patate', 'legume', 'brocoli', 'epinard', 'haricot', 'poivron', 'champignon', 'concombre', 'avocat'] },
  { cat: 'viandes', words: ['poulet', 'boeuf', 'porc', 'jambon', 'steak', 'viande', 'saucisse', 'lardon', 'dinde', 'agneau', 'veau', 'merguez', 'charcuterie'] },
  { cat: 'poissons', words: ['poisson', 'saumon', 'thon', 'cabillaud', 'crevette', 'moule', 'colin', 'sardine', 'truite'] },
  { cat: 'surgeles', words: ['surgele', 'glace', 'congele'] },
  { cat: 'conserves', words: ['conserve', 'boite', 'bocal'] },
  { cat: 'sucreries', words: ['chocolat', 'bonbon', 'biscuit', 'gateau', 'gateaux', 'dessert', 'sucre', 'confiture', 'miel', 'nutella', 'cereales'] },
  { cat: 'apero', words: ['chips', 'apero', 'cacahuete', 'olive', 'cracker', 'biscuit aperitif'] },
  { cat: 'boissons', words: ['eau', 'jus', 'soda', 'cola', 'biere', 'vin', 'limonade', 'sirop', 'the', 'cafe', 'boisson'] },
  { cat: 'epicerie', words: ['pates', 'riz', 'farine', 'huile', 'vinaigre', 'sel', 'poivre', 'epice', 'sauce', 'semoule', 'lentille', 'pois', 'quinoa', 'pain', 'biscotte', 'moutarde'] },
]

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Devine la catégorie d'un article à partir de son nom (libre). */
export function guessCategoryFromName(name: string): Category {
  const n = normalize(name)
  for (const { cat, words } of RULES) {
    if (words.some((w) => n.includes(w))) return cat
  }
  return 'autre'
}

/** Articles couramment vendus au volume. */
const VOLUME_WORDS = ['lait', 'jus', 'eau', 'soda', 'cola', 'biere', 'vin', 'limonade', 'sirop', 'huile', 'creme liquide', 'bouillon', 'soupe']
/** Articles couramment vendus au poids. */
const MASS_WORDS = ['farine', 'sucre', 'sel', 'riz', 'pates', 'semoule', 'lentille', 'cafe', 'fromage', 'viande', 'boeuf', 'poulet', 'poisson', 'saumon', 'jambon', 'lardon', 'pomme de terre', 'patate', 'carotte', 'tomate', 'banane', 'raisin']

/** Devine l'unite naturelle d'un article (roulette adaptative). '' = au nombre. */
export function guessUnitFromName(name: string): string {
  const n = normalize(name)
  if (VOLUME_WORDS.some((w) => n.includes(w))) return 'L'
  if (MASS_WORDS.some((w) => n.includes(w))) return 'g'
  return ''
}
