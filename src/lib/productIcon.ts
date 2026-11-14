/**
 * Pictogramme d'un produit, deviné depuis son nom (FR). Retourne null si rien ne correspond :
 * l'appelant retombe alors sur l'icône de la catégorie.
 *
 * L'ordre compte : la première règle qui correspond gagne. Les plats et produits
 * transformés passent avant les ingrédients (« gâteau au chocolat » → gâteau, pas chocolat ;
 * « jus d'orange » → jus, pas agrume ; « pomme de terre » → pomme de terre, pas pomme).
 */
export type FoodIconKey = string
const RULES: [string[], FoodIconKey][] = [
  // Plats, transformés
  [['pizza'], 'pizza'],
  [['burger', 'hamburger'], 'hamburger'],
  [['sandwich', 'croque monsieur'], 'sandwich'],
  [['wrap'], 'sandwich'],
  [['tacos', 'taco'], ''],
  [['kebab'], 'sandwich'],
  [['sushi', 'maki'], 'fish'],
  [['quiche', 'tarte', 'tourte'], 'cake'],
  [['nuggets', 'nugget'], 'drumstick'],
  [['frite', 'frites'], ''],
  [['soupe', 'bouillon', 'potage', 'veloute'], 'soup'],
  [['creme glacee', 'glace', 'sorbet'], 'iceCream'],
  [['gateau', 'gateaux', 'cake', 'fondant', 'brownie'], 'cake'],
  [['muffin', 'cupcake'], 'cupcake'],
  [['donut', 'beignet'], 'donut'],
  [['crepe', 'crepes'], ''],
  [['gaufre', 'gaufres'], ''],
  [['biscuit', 'biscuits', 'cookie', 'cookies', 'sable', 'speculoos'], 'cookie'],
  [['pate a tartiner', 'nutella', 'chocolat', 'chocolats'], 'chocolate'],
  [['bonbon', 'bonbons', 'sucette', 'guimauve', 'haribo'], 'candy'],
  [['confiture', 'miel', 'compote'], 'jar'],
  [['pop corn', 'popcorn'], 'popcorn'],

  // Boissons
  [['jus', 'smoothie', 'sirop'], 'juice'],
  [['soda', 'cola', 'limonade', 'orangina', 'fanta', 'sprite', 'perrier'], 'soda'],
  [['biere', 'bieres'], 'beer'],
  [['champagne', 'cremant', 'prosecco'], 'bottle'],
  [['vin', 'vins'], 'wine'],
  [['whisky', 'rhum', 'vodka', 'gin', 'cognac', 'pastis'], 'spirit'],
  [['cafe', 'espresso', 'capsule', 'capsules'], 'coffee'],
  [['the', 'infusion', 'tisane'], 'coffee'],
  [['eau', 'evian', 'volvic', 'vittel'], 'water'],

  // Produits laitiers et oeufs
  [['yaourt', 'yaourts', 'yogourt', 'skyr', 'fromage blanc', 'danette'], 'milk'],
  [['lait'], 'milk'],
  [['creme', 'creme fraiche'], 'milk'],
  [['beurre', 'margarine'], 'butter'],
  [['oeuf', 'oeufs'], 'egg'],
  [['fromage', 'mozzarella', 'comte', 'emmental', 'chevre', 'camembert', 'brie', 'parmesan', 'gruyere', 'raclette', 'feta', 'cheddar', 'roquefort', 'boursin'], 'cheese'],

  // Viandes et poissons
  [['poulet', 'dinde', 'volaille', 'canard', 'cuisse', 'cuisses', 'pilon', 'pilons'], 'drumstick'],
  [['steak', 'boeuf', 'viande', 'hache', 'porc', 'veau', 'cote', 'escalope', 'rosbif'], 'beef'],
  [['jambon', 'agneau', 'rotie', 'roti', 'charcuterie', 'saucisson', 'rillettes'], 'ham'],
  [['lardon', 'lardons', 'bacon'], 'bacon'],
  [['saucisse', 'saucisses', 'merguez', 'chipolata', 'knacki'], 'sausage'],
  [['crevette', 'crevettes', 'gambas'], 'shrimp'],
  [['homard', 'langoustine', 'crabe'], 'shrimp'],
  [['moule', 'moules', 'huitre', 'huitres', 'coquillage', 'coquillages'], 'shell'],
  [['surimi'], 'fish'],
  [['poisson', 'saumon', 'thon', 'cabillaud', 'colin', 'sardine', 'sardines', 'truite', 'maquereau', 'dorade', 'merlu', 'filet de poisson'], 'fish'],

  // Féculents et épicerie
  [['pates', 'spaghetti', 'spaghettis', 'tagliatelle', 'tagliatelles', 'penne', 'macaroni', 'macaronis', 'fusilli', 'coquillette', 'coquillettes', 'lasagne', 'lasagnes', 'nouille', 'nouilles', 'ravioli', 'raviolis', 'tortellini'], 'pasta'],
  [['riz', 'basmati', 'risotto'], 'rice'],
  [['semoule', 'couscous', 'boulgour', 'quinoa', 'ble'], 'rice'],
  [['cereales', 'muesli', 'granola', 'flocons', 'avoine'], 'rice'],
  [['farine', 'maizena', 'levure'], 'wheat'],
  [['pain de mie', 'brioche', 'biscotte', 'biscottes', 'toast', 'toasts'], 'slice'],
  [['baguette', 'pain'], 'baguette'],
  [['croissant', 'croissants', 'pain au chocolat', 'viennoiserie'], 'croissant'],
  [['pomme de terre', 'pommes de terre', 'patate', 'patates', 'puree'], 'potato'],
  [['chips'], ''],
  [['cacahuete', 'cacahuetes', 'noix', 'amande', 'amandes', 'noisette', 'noisettes', 'pistache', 'pistaches', 'cajou'], 'nut'],
  [['cracker', 'crackers', 'bretzel', 'bretzels'], ''],
  [['olive', 'olives', 'huile'], 'oil'],
  [['sel', 'poivre'], 'salt'],
  [['piment', 'epice', 'epices', 'curry', 'paprika', 'harissa'], 'spice'],
  [['sauce tomate', 'ketchup', 'coulis'], 'tomato'],
  [['mayonnaise', 'moutarde', 'vinaigre', 'sauce', 'sauces', 'pesto', 'cornichon', 'cornichons'], 'jar'],
  [['lentille', 'lentilles', 'pois chiche', 'pois chiches', 'haricot rouge', 'haricots rouges', 'feves'], 'bean'],
  [['sucre', 'sucres', 'sirop d agave'], 'candy'],
  [['conserve', 'conserves', 'boite'], 'can'],

  // Légumes
  [['tomate', 'tomates'], 'tomato'],
  [['carotte', 'carottes'], 'carrot'],
  [['brocoli', 'brocolis', 'chou fleur'], 'broccoli'],
  [['salade', 'laitue', 'mache', 'roquette', 'epinard', 'epinards', 'chou', 'poireau', 'poireaux', 'blette', 'blettes'], 'leafy'],
  [['courgette', 'courgettes', 'concombre', 'concombres', 'cornichon'], ''],
  [['oignon', 'oignons', 'echalote', 'echalotes'], 'bulb'],
  [['ail'], 'bulb'],
  [['poivron', 'poivrons'], 'pepper'],
  [['champignon', 'champignons', 'cepe', 'cepes'], 'mushroom'],
  [['mais'], 'corn'],
  [['aubergine', 'aubergines'], ''],
  [['avocat', 'avocats'], 'avocado'],
  [['potiron', 'courge', 'citrouille', 'butternut'], ''],
  [['haricot', 'haricots', 'petit pois', 'petits pois', 'radis', 'asperge', 'asperges', 'celeri', 'fenouil', 'betterave', 'navet'], 'sprout'],

  // Fruits
  [['pomme', 'pommes'], 'apple'],
  [['poire', 'poires'], 'apple'],
  [['banane', 'bananes'], 'banana'],
  [['orange', 'oranges', 'clementine', 'clementines', 'mandarine', 'mandarines', 'pamplemousse'], 'citrus'],
  [['citron', 'citrons', 'citron vert', 'lime'], 'citrus'],
  [['fraise', 'fraises', 'framboise', 'framboises'], 'cherry'],
  [['myrtille', 'myrtilles', 'mure', 'mures', 'cassis'], 'grape'],
  [['raisin', 'raisins'], 'grape'],
  [['peche', 'peches', 'abricot', 'abricots', 'nectarine', 'nectarines', 'prune', 'prunes'], 'apple'],
  [['cerise', 'cerises'], 'cherry'],
  [['ananas'], ''],
  [['mangue', 'mangues'], ''],
  [['kiwi', 'kiwis'], ''],
  [['melon', 'melons'], ''],
  [['pasteque', 'pasteques'], ''],
  [['noix de coco', 'coco'], ''],
  [['fruit', 'fruits'], 'apple'],
  [['legume', 'legumes'], 'broccoli'],
]

/** Minuscules, sans accent, ponctuation remplacée par des espaces (« jus d'orange » → « jus d orange »). */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Clé de pictogramme deviné depuis le nom du produit, ou null (→ icône de catégorie). */
export function productIconKey(name: string): FoodIconKey | null {
  const padded = ` ${normalize(name)} `
  if (padded.trim() === '') return null
  for (const [words, key] of RULES) {
    for (const w of words) {
      // Mot entier (ou pluriel en s / x), pour éviter « the » dans « fromage » ou « ail » dans « bail ».
      if (padded.includes(` ${w} `) || padded.includes(` ${w}s `) || padded.includes(` ${w}x `)) return key || null
    }
  }
  return null
}
