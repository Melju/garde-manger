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

/** Devine la catégorie d'un article à partir de son nom (libre). */
export function guessCategoryFromName(name: string): Category {
  const n = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents
  for (const { cat, words } of RULES) {
    if (words.some((w) => n.includes(w))) return cat
  }
  return 'autre'
}
