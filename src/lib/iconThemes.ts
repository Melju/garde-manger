import { iconsForKeyword } from './productImage'
import { ICON_SLUGS } from './iconList'
import { normalize } from './productIcon'

/**
 * Thèmes de recherche des icônes : « fruit », « boisson », « ménage »… renvoient toutes les icônes du thème.
 * `words` : mots-clés acceptés (sans accent) ; `keys` : fragments de slug ; `slugs` : slugs exacts.
 */
interface Theme {
  words: string[]
  keys?: string[]
  slugs?: string[]
}

const THEMES: Theme[] = [
  { words: ['fruit', 'fruits'], slugs: ['abricot', 'ananas', 'avocat', 'banane', 'cerise', 'citron', 'citron-vert', 'clementine', 'coco', 'datte', 'figue', 'fraise', 'framboise', 'grenade', 'kiwi', 'mangue', 'melon', 'myrtille', 'orange', 'pamplemousse', 'pasteque', 'peche', 'poire', 'pomme', 'prune', 'raisin', 'compote'] },
  { words: ['legume', 'legumes', 'potager'], slugs: ['ail', 'artichaut', 'asperge', 'aubergine', 'betterave', 'brocoli', 'carotte', 'celeri', 'champignon', 'chou', 'chou-de-bruxelles', 'chou-fleur', 'chou-rouge', 'concombre', 'courgette', 'edamame', 'endive', 'epinards', 'fenouil', 'haricots-verts', 'mais', 'navet', 'oignon', 'patate-douce', 'petits-pois', 'poireau', 'poivron', 'pomme-de-terre', 'potiron', 'radis', 'salade', 'tomate', 'legumes-surgeles'] },
  { words: ['herbe', 'herbes', 'epice', 'epices', 'aromate', 'aromates', 'condiment'], slugs: ['basilic', 'ciboulette', 'coriandre', 'persil', 'epices', 'herbes-provence', 'curry', 'piment', 'gingembre', 'harissa', 'sel', 'sriracha'] },
  { words: ['viande', 'viandes', 'charcuterie'], keys: ['poulet', 'saucisse', 'steak', 'boeuf', 'porc', 'agneau', 'dinde'], slugs: ['blanc-poulet', 'chipolata', 'chorizo', 'cordon-bleu', 'cuisse-poulet', 'emince-poulet', 'escalope-panee', 'filet-mignon', 'gigot-agneau', 'jambon', 'lardons', 'magret-canard', 'merguez', 'nuggets', 'paupiette', 'saucisson', 'viande-cubes', 'viande-hachee', 'boulettes', 'boudin-blanc', 'pate-en-croute', 'terrine', 'roulade-ardennaise', 'kebab', 'hot-dog'] },
  { words: ['vegetarien', 'vegetal', 'vegetale', 'vegan', 'veggie', 'vg'], keys: ['vegetal', 'vegetaux'], slugs: ['burger-vegetarien', 'falafel', 'proteines-soja', 'seitan', 'tempeh', 'tofu', 'edamame', 'levure-nutritionnelle', 'lait-soja', 'lait-avoine', 'lait-amande'] },
  { words: ['poisson', 'poissons', 'mer', 'fruits de mer'], slugs: ['anchois', 'crevettes', 'moules', 'moules-frites', 'poisson', 'poisson-pane', 'saumon', 'thon', 'sushi', 'brandade', 'pates-saumon', 'poke-bowl'] },
  { words: ['laitier', 'laitiers', 'laitage', 'laitages', 'creme', 'cremerie', 'frais'], keys: ['lait', 'beurre', 'yaourt', 'fromage'], slugs: ['creme', 'chantilly', 'mozzarella', 'raclette', 'flan', 'dessert-lacte', 'oeuf', 'tzatziki'] },
  { words: ['boisson', 'boissons', 'liquide', 'a boire'], keys: ['jus', 'eau', 'soda', 'the', 'cola'], slugs: ['biere', 'bombonne-eau', 'cafe-froid', 'champagne', 'cidre', 'energisante', 'limonade', 'milkshake', 'pack-eau', 'smoothie', 'tisane', 'tonic', 'vin', 'whisky', 'sirop', 'cola-bouteille', 'chocolat-chaud', 'cafe'] },
  { words: ['alcool', 'alcools', 'biere', 'vin'], slugs: ['biere', 'champagne', 'cidre', 'vin', 'whisky'] },
  { words: ['pates', 'pasta', 'feculent', 'feculents', 'riz', 'cereale'], slugs: ['capellini', 'conchiglie', 'coquillettes', 'couscous', 'farfalle', 'fusilli', 'gnocchi', 'linguine', 'macaroni', 'nouilles', 'nouilles-riz', 'orecchiette', 'penne', 'polenta', 'quinoa', 'rigatoni', 'riz', 'semoule', 'spaghetti', 'tagliatelles', 'udon', 'vermicelles', 'soba', 'ramen', 'pates', 'pates-etoiles', 'pates-pesto', 'cereales', 'lentilles', 'pois-chiches'] },
  { words: ['biscuit', 'biscuits', 'gateau', 'gateaux', 'sucre', 'sucrerie', 'dessert', 'desserts', 'gouter', 'patisserie'], keys: ['biscuit', 'gaufre', 'sable'], slugs: ['assortiment-biscuits', 'biscottes', 'brownie', 'caneles', 'cookie', 'cracottes-chocolat', 'donut', 'financier', 'gateau', 'gaufrette', 'macaron', 'madeleine', 'muffin', 'palet-breton', 'petit-beurre', 'speculoos', 'pancakes', 'crepes', 'tarte', 'pain-epices', 'galette-bretonne', 'cigarettes-russes', 'chocolat', 'bonbons', 'glace', 'glace-bac', 'miel', 'confiture', 'pate-a-tartiner', 'sucre', 'barre-cereales', 'flan', 'dessert-lacte', 'compote'] },
  { words: ['pain', 'boulangerie', 'viennoiserie', 'sandwich'], keys: ['pain'], slugs: ['baguette', 'croissant', 'sandwich', 'wrap', 'wrap-falafel', 'tortillas', 'biscottes', 'chapelure'] },
  { words: ['surgele', 'surgeles', 'congele', 'congeles', 'glace'], slugs: ['glace-bac', 'glace', 'legumes-surgeles', 'sac-surgele', 'frites', 'nuggets', 'nuggets-vegetaux'] },
  { words: ['plat', 'plats', 'cuisine', 'cuisines', 'prepare', 'traiteur', 'repas'], keys: ['lasagne', 'gratin', 'soupe', 'croque'], slugs: ['bibimbap', 'blanquette', 'bo-bun', 'bolognaise', 'buddha-bowl', 'carbonara', 'cassoulet', 'chili-con-carne', 'crepe-jambon-fromage', 'curry-legumes', 'enchiladas', 'hachis-parmentier', 'kebab', 'nems', 'omelette', 'pad-thai', 'paella', 'pho', 'pizza', 'poke-bowl', 'pot-au-feu', 'quiche', 'ratatouille', 'risotto', 'shakshuka', 'tacos', 'tajine', 'tartiflette', 'welsh', 'ravioli', 'tortellini', 'fondue', 'burger', 'steak-frites', 'poule-au-pot', 'poulet-basquaise', 'flammekueche', 'gyoza', 'quesadilla', 'jurassienne'] },
  { words: ['sauce', 'sauces', 'condiment', 'condiments', 'assaisonnement'], keys: ['sauce', 'moutarde', 'mayonnaise'], slugs: ['harissa', 'ketchup', 'sriracha', 'tahini', 'tapenade', 'vinaigre', 'vinaigrette', 'worcestershire', 'huile', 'pesto', 'concentre-tomate', 'cornichons', 'capres', 'guacamole', 'houmous', 'tzatziki', 'olive'] },
  { words: ['conserve', 'conserves', 'bocal', 'epicerie'], slugs: ['conserve', 'cassoulet-conserve', 'haricots-blancs', 'haricots-rouges', 'haricots-verts', 'lentilles', 'pois-chiches', 'petits-pois', 'mais', 'thon', 'bocal', 'concentre-tomate', 'cornichons', 'olive', 'farine', 'levure-nutritionnelle', 'bouillon-cube', 'graines', 'cacahuetes', 'noix-cajou', 'pop-corn', 'chips', 'nachos', 'crackers'] },
  { words: ['menage', 'entretien', 'maison', 'nettoyage', 'hygiene', 'salle de bain', 'toilette', 'non alimentaire'], slugs: ['ampoule', 'coton', 'couches', 'dentifrice', 'deodorant', 'eponge', 'essuie-tout', 'film-alimentaire', 'gel-douche', 'javel', 'lessive', 'liquide-vaisselle', 'litiere', 'mouchoirs', 'nettoyant-multi-usage', 'papier-alu', 'papier-cuisson', 'papier-toilette', 'piles', 'sacs-poubelle', 'savon', 'shampoing', 'croquettes-chat', 'croquettes-chien'] },
  { words: ['animal', 'animaux', 'chat', 'chien'], slugs: ['croquettes-chat', 'croquettes-chien', 'litiere'] },
  { words: ['petit dejeuner', 'petit-dejeuner', 'matin', 'brunch'], slugs: ['cereales', 'cafe', 'cafe-moulu', 'cafe-grains', 'capsules-cafe', 'confiture', 'miel', 'pain', 'pain-de-mie', 'baguette', 'croissant', 'biscottes', 'cracottes-chocolat', 'pate-a-tartiner', 'the', 'jus-orange', 'oeuf', 'yaourt', 'lait', 'beurre'] },
]

const valid = new Set(ICON_SLUGS)

/** Slugs des icônes dont le nom ou le thème correspond à la recherche (noms exacts d'abord). */
export function searchIcons(query: string): string[] {
  const q = normalize(query).trim().replace(/-/g, ' ')
  if (!q) return ICON_SLUGS
  const byName = ICON_SLUGS.filter((s) => s.replace(/-/g, ' ').includes(q))
  const out = new Set(byName)
  for (const s of iconsForKeyword(query)) if (valid.has(s)) out.add(s)
  if (q.length >= 3) {
    for (const t of THEMES) {
      const hit = t.words.some((w) => w === q || (q.length >= 4 && (w.startsWith(q) || q.startsWith(w))))
      if (!hit) continue
      for (const s of t.slugs ?? []) if (valid.has(s)) out.add(s)
      for (const k of t.keys ?? []) for (const s of ICON_SLUGS) if (s.includes(k)) out.add(s)
    }
  }
  return [...out]
}
