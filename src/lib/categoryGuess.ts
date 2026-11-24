import type { Category } from '../types'

/** Mots-clés (FR, sans accent) → catégorie, pour deviner depuis un nom libre. */
const RULES: { cat: Category; words: string[] }[] = [
  { cat: 'pharmacie', words: ['doliprane', 'paracetamol', 'dafalgan', 'efferalgan', 'ibuprofene', 'advil', 'nurofen', 'aspirine', 'spasfon', 'smecta', 'gaviscon', 'imodium', 'biafine', 'betadine', 'dacryoserum', 'collyre', 'spray nasal', 'serum physiologique', 'pansement', 'compresse', 'strepsils', 'humex', 'fervex', 'antihistaminique', 'homeopathie', 'arnica', 'antiseptique', 'mercurochrome', 'medicament', 'comprimes', 'gelules', 'pommade', 'sirop contre la toux', 'sirop pour la toux', 'vitamine d', 'magnesium', 'probiotique', 'thermometre', 'bandage', 'sparadrap', 'cicatrisant', 'calmant', 'anti inflammatoire', 'antidouleur'] },
  { cat: 'maison', words: ['papier toilette', 'essuie tout', 'sopalin', 'essuie-tout', 'essuie tout', 'liquide vaisselle', 'lave vaisselle', 'lessive', 'adoucissant', 'javel', 'nettoyant', 'eponge', 'sac poubelle', 'sacs poubelle', 'film alimentaire', 'papier alu', 'papier aluminium', 'papier cuisson', 'mouchoir', 'savon', 'gel douche', 'shampoing', 'dentifrice', 'brosse a dents', 'deodorant', 'coton', 'couche', 'croquettes chien', 'croquettes chat', 'litiere', 'piles', 'ampoule', 'rasoir', 'serviette hygienique', 'papier wc', 'papier hygienique', 'multi usage', 'lingette', 'demaquillant', 'bain de bouche', 'pile aa', 'sopalin', 'detartrant', 'desodorisant'] },
  { cat: 'epicerie', words: ['vinaigre', 'vinaigrette', 'mayonnaise'] },
  // Biscuits et douceurs « aux fruits » : avant les fruits, sinon « Pims framboise » ou « confiture de fraise » partent en Fruits.
  { cat: 'sucreries', words: ['pims', 'pim s', "pim's", 'pim’s', 'prince', 'oreo', 'petit beurre', 'speculoos', 'madeleine', 'cookie', 'brownie', 'gaufre', 'kinder', 'haribo', 'twix', 'snickers', 'pate a tartiner', 'confiture', 'compote', 'biscuit', 'gateau', 'tartelette', 'barre chocolatee', 'barres chocolatees', 'bonbon', 'chocolat'] },
  { cat: 'laitiers', words: ['lait', 'yaourt', 'yogourt', 'fromage', 'beurre', 'creme', 'oeuf', 'mozzarella', 'comte', 'emmental', 'chevre'] },
  { cat: 'fruits', words: ['pomme', 'framboise', 'myrtille', 'mangue', 'clementine', 'mandarine', 'prune', 'figue', 'grenade', 'pamplemousse', 'banane', 'orange', 'fraise', 'raisin', 'poire', 'peche', 'abricot', 'kiwi', 'citron', 'fruit', 'cerise', 'melon', 'ananas', 'mangue'] },
  { cat: 'legumes', words: ['tomate', 'carotte', 'salade', 'courgette', 'oignon', 'ail', 'poireau', 'pomme de terre', 'patate', 'legume', 'brocoli', 'epinard', 'haricot', 'poivron', 'champignon', 'concombre', 'avocat'] },
  { cat: 'viandes-vg', words: ['vegetal', 'vegan', 'veggie', 'vegetarien', 'tofu', 'seitan', 'tempeh', 'falafel', 'viande vg', 'viandes vg', 'steak vg', 'boulettes vg', 'quorn'] },
  { cat: 'viandes', words: ['poulet', 'boeuf', 'porc', 'jambon', 'steak', 'viande', 'saucisse', 'lardon', 'dinde', 'agneau', 'veau', 'merguez', 'charcuterie'] },
  { cat: 'poissons', words: ['poisson', 'saumon', 'thon', 'cabillaud', 'crevette', 'moule', 'colin', 'sardine', 'truite'] },
  { cat: 'patisserie', words: ['sucre glace', 'sucre vanille'] },
  { cat: 'surgeles', words: ['surgele', 'glace', 'congele'] },
  { cat: 'conserves', words: ['conserve', 'boite', 'bocal'] },
  { cat: 'patisserie', words: ['pepites', 'pepite', 'levure', 'sucre glace', 'sucre vanille', 'sucre vanillin', 'vanille', 'vanilline', 'maizena', 'fecule', 'cacao', 'poudre d amande', 'amande en poudre', 'amandes en poudre', 'colorant alimentaire', 'gelatine', 'agar', 'nappage', 'pate d amande', 'massepain', 'vermicelles', 'perles de sucre', 'decoration gateau', 'bicarbonate', 'fondant', 'a patisser', 'patisserie', 'extrait de vanille', 'sucre perle'] },
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
  // « Huile d'olive », « huile de tournesol »… (pas « thon à l'huile », qui reste un poisson en conserve)
  if (/^(huile|huiles)\b/.test(n.trim())) return 'huiles'
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
