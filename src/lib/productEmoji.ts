/**
 * Emoji d'un produit, deviné depuis son nom (FR). Retourne null si rien ne correspond :
 * l'appelant retombe alors sur l'icône de la catégorie.
 *
 * L'ordre compte : la première règle qui correspond gagne. Les plats et produits
 * transformés passent avant les ingrédients (« gâteau au chocolat » → 🍰, pas 🍫 ;
 * « jus d'orange » → 🧃, pas 🍊 ; « pomme de terre » → 🥔, pas 🍎).
 */
const RULES: [string[], string][] = [
  // Plats, transformés
  [['pizza'], '🍕'],
  [['burger', 'hamburger'], '🍔'],
  [['sandwich', 'croque monsieur'], '🥪'],
  [['wrap'], '🌯'],
  [['tacos', 'taco'], '🌮'],
  [['kebab'], '🥙'],
  [['sushi', 'maki'], '🍣'],
  [['quiche', 'tarte', 'tourte'], '🥧'],
  [['nuggets', 'nugget'], '🍗'],
  [['frite', 'frites'], '🍟'],
  [['soupe', 'bouillon', 'potage', 'veloute'], '🍲'],
  [['creme glacee', 'glace', 'sorbet'], '🍨'],
  [['gateau', 'gateaux', 'cake', 'fondant', 'brownie'], '🍰'],
  [['muffin', 'cupcake'], '🧁'],
  [['donut', 'beignet'], '🍩'],
  [['crepe', 'crepes'], '🥞'],
  [['gaufre', 'gaufres'], '🧇'],
  [['biscuit', 'biscuits', 'cookie', 'cookies', 'sable', 'speculoos'], '🍪'],
  [['pate a tartiner', 'nutella', 'chocolat', 'chocolats'], '🍫'],
  [['bonbon', 'bonbons', 'sucette', 'guimauve', 'haribo'], '🍬'],
  [['confiture', 'miel', 'compote'], '🍯'],
  [['pop corn', 'popcorn'], '🍿'],

  // Boissons
  [['jus', 'smoothie', 'sirop'], '🧃'],
  [['soda', 'cola', 'limonade', 'orangina', 'fanta', 'sprite', 'perrier'], '🥤'],
  [['biere', 'bieres'], '🍺'],
  [['champagne', 'cremant', 'prosecco'], '🍾'],
  [['vin', 'vins'], '🍷'],
  [['whisky', 'rhum', 'vodka', 'gin', 'cognac', 'pastis'], '🥃'],
  [['cafe', 'espresso', 'capsule', 'capsules'], '☕'],
  [['the', 'infusion', 'tisane'], '🍵'],
  [['eau', 'evian', 'volvic', 'vittel'], '💧'],

  // Produits laitiers et oeufs
  [['yaourt', 'yaourts', 'yogourt', 'skyr', 'fromage blanc', 'danette'], '🥛'],
  [['lait'], '🥛'],
  [['creme', 'creme fraiche'], '🥛'],
  [['beurre', 'margarine'], '🧈'],
  [['oeuf', 'oeufs'], '🥚'],
  [['fromage', 'mozzarella', 'comte', 'emmental', 'chevre', 'camembert', 'brie', 'parmesan', 'gruyere', 'raclette', 'feta', 'cheddar', 'roquefort', 'boursin'], '🧀'],

  // Viandes et poissons
  [['poulet', 'dinde', 'volaille', 'canard', 'cuisse', 'cuisses', 'pilon', 'pilons'], '🍗'],
  [['steak', 'boeuf', 'viande', 'hache', 'porc', 'veau', 'cote', 'escalope', 'rosbif'], '🥩'],
  [['jambon', 'agneau', 'rotie', 'roti', 'charcuterie', 'saucisson', 'rillettes'], '🍖'],
  [['lardon', 'lardons', 'bacon'], '🥓'],
  [['saucisse', 'saucisses', 'merguez', 'chipolata', 'knacki'], '🌭'],
  [['crevette', 'crevettes', 'gambas'], '🦐'],
  [['homard', 'langoustine', 'crabe'], '🦞'],
  [['moule', 'moules', 'huitre', 'huitres', 'coquillage', 'coquillages'], '🦪'],
  [['surimi'], '🍥'],
  [['poisson', 'saumon', 'thon', 'cabillaud', 'colin', 'sardine', 'sardines', 'truite', 'maquereau', 'dorade', 'merlu', 'filet de poisson'], '🐟'],

  // Féculents et épicerie
  [['pates', 'spaghetti', 'spaghettis', 'tagliatelle', 'tagliatelles', 'penne', 'macaroni', 'macaronis', 'fusilli', 'coquillette', 'coquillettes', 'lasagne', 'lasagnes', 'nouille', 'nouilles', 'ravioli', 'raviolis', 'tortellini'], '🍝'],
  [['riz', 'basmati', 'risotto'], '🍚'],
  [['semoule', 'couscous', 'boulgour', 'quinoa', 'ble'], '🥣'],
  [['cereales', 'muesli', 'granola', 'flocons', 'avoine'], '🥣'],
  [['farine', 'maizena', 'levure'], '🌾'],
  [['pain de mie', 'brioche', 'biscotte', 'biscottes', 'toast', 'toasts'], '🍞'],
  [['baguette', 'pain'], '🥖'],
  [['croissant', 'croissants', 'pain au chocolat', 'viennoiserie'], '🥐'],
  [['pomme de terre', 'pommes de terre', 'patate', 'patates', 'puree'], '🥔'],
  [['chips'], '🍟'],
  [['cacahuete', 'cacahuetes', 'noix', 'amande', 'amandes', 'noisette', 'noisettes', 'pistache', 'pistaches', 'cajou'], '🥜'],
  [['cracker', 'crackers', 'bretzel', 'bretzels'], '🥨'],
  [['olive', 'olives', 'huile'], '🫒'],
  [['sel', 'poivre'], '🧂'],
  [['piment', 'epice', 'epices', 'curry', 'paprika', 'harissa'], '🌶️'],
  [['sauce tomate', 'ketchup', 'coulis'], '🍅'],
  [['mayonnaise', 'moutarde', 'vinaigre', 'sauce', 'sauces', 'pesto', 'cornichon', 'cornichons'], '🫙'],
  [['lentille', 'lentilles', 'pois chiche', 'pois chiches', 'haricot rouge', 'haricots rouges', 'feves'], '🫘'],
  [['sucre', 'sucres', 'sirop d agave'], '🍬'],
  [['conserve', 'conserves', 'boite'], '🥫'],

  // Légumes
  [['tomate', 'tomates'], '🍅'],
  [['carotte', 'carottes'], '🥕'],
  [['brocoli', 'brocolis', 'chou fleur'], '🥦'],
  [['salade', 'laitue', 'mache', 'roquette', 'epinard', 'epinards', 'chou', 'poireau', 'poireaux', 'blette', 'blettes'], '🥬'],
  [['courgette', 'courgettes', 'concombre', 'concombres', 'cornichon'], '🥒'],
  [['oignon', 'oignons', 'echalote', 'echalotes'], '🧅'],
  [['ail'], '🧄'],
  [['poivron', 'poivrons'], '🫑'],
  [['champignon', 'champignons', 'cepe', 'cepes'], '🍄'],
  [['mais'], '🌽'],
  [['aubergine', 'aubergines'], '🍆'],
  [['avocat', 'avocats'], '🥑'],
  [['potiron', 'courge', 'citrouille', 'butternut'], '🎃'],
  [['haricot', 'haricots', 'petit pois', 'petits pois', 'radis', 'asperge', 'asperges', 'celeri', 'fenouil', 'betterave', 'navet'], '🌱'],

  // Fruits
  [['pomme', 'pommes'], '🍎'],
  [['poire', 'poires'], '🍐'],
  [['banane', 'bananes'], '🍌'],
  [['orange', 'oranges', 'clementine', 'clementines', 'mandarine', 'mandarines', 'pamplemousse'], '🍊'],
  [['citron', 'citrons', 'citron vert', 'lime'], '🍋'],
  [['fraise', 'fraises', 'framboise', 'framboises'], '🍓'],
  [['myrtille', 'myrtilles', 'mure', 'mures', 'cassis'], '🫐'],
  [['raisin', 'raisins'], '🍇'],
  [['peche', 'peches', 'abricot', 'abricots', 'nectarine', 'nectarines', 'prune', 'prunes'], '🍑'],
  [['cerise', 'cerises'], '🍒'],
  [['ananas'], '🍍'],
  [['mangue', 'mangues'], '🥭'],
  [['kiwi', 'kiwis'], '🥝'],
  [['melon', 'melons'], '🍈'],
  [['pasteque', 'pasteques'], '🍉'],
  [['noix de coco', 'coco'], '🥥'],
  [['fruit', 'fruits'], '🍎'],
  [['legume', 'legumes'], '🥦'],
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

/** Emoji deviné depuis le nom du produit, ou null. */
export function productEmoji(name: string): string | null {
  const padded = ` ${normalize(name)} `
  if (padded.trim() === '') return null
  for (const [words, emoji] of RULES) {
    for (const w of words) {
      // Mot entier (ou pluriel en s / x), pour éviter « the » dans « fromage » ou « ail » dans « bail ».
      if (padded.includes(` ${w} `) || padded.includes(` ${w}s `) || padded.includes(` ${w}x `)) return emoji
    }
  }
  return null
}
