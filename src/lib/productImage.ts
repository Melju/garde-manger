import { normalize } from './productIcon'

/**
 * Illustration d'un produit (fichier public/icons/<slug>.webp), devinée depuis son nom (FR).
 * L'ordre compte : la première règle qui correspond gagne. Les plats et les formulations
 * précises passent avant les ingrédients ("poulet rôti" avant "poulet", "pomme de terre"
 * avant "pomme", "huile d'olive" avant "olive").
 * Retourne null si rien ne correspond : l'appelant retombe sur le pictogramme de secours.
 */
const RULES: [string[], string][] = [
  // Plats
  [['carbonara'], 'carbonara'],
  [['bolognaise', 'bolo'], 'bolognaise'],
  [['lasagne', 'lasagnes'], 'lasagnes'],
  [['pizza'], 'pizza'],
  [['burger', 'hamburger', 'cheeseburger'], 'burger'],
  [['croque monsieur', 'croque madame'], 'croque-monsieur'],
  [['hot dog', 'hotdog'], 'hot-dog'],
  [['sandwich', 'panini'], 'sandwich'],
  [['wrap'], 'wrap'],
  [['tacos', 'taco', 'fajita'], 'tacos'],
  [['kebab', 'doner', 'gyros'], 'kebab'],
  [['sushi', 'maki'], 'sushi'],
  [['quiche'], 'quiche'],
  [['tarte', 'tourte'], 'tarte'],
  [['soupe', 'potage', 'veloute', 'bouillon'], 'soupe'],
  [['salade composee', 'salade mixte', 'salade repas'], 'salade-composee'],
  [['gratin'], 'gratin'],
  [['omelette'], 'omelette'],
  [['risotto'], 'risotto'],
  [['curry'], 'curry'],
  [['poulet roti', 'poulet rotie'], 'poulet-roti'],
  [['frite', 'frites'], 'frites'],
  [['nuggets', 'nugget'], 'nuggets'],
  [['raclette'], 'raclette'],
  [['fondue'], 'fondue'],
  [['ratatouille'], 'ratatouille'],
  [['couscous'], 'couscous'],
  [['boulette', 'boulettes', 'kefta'], 'boulettes'],
  [['pancake', 'pancakes'], 'pancakes'],
  [['crepe', 'crepes'], 'crepes'],

  // Surgelés
  [['poisson pane', 'poissons panes', 'fish sticks'], 'poisson-pane'],
  [['legumes surgeles', 'legume surgele', 'poelee'], 'legumes-surgeles'],
  [['glace en bac', 'glace bac', 'creme glacee bac'], 'glace-bac'],

  // Boissons
  [['lait vegetal', 'lait d avoine', 'lait d amande', 'lait de soja', 'lait de coco', 'boisson avoine', 'boisson soja', 'boisson amande'], 'lait-vegetal'],
  [['eau gazeuse', 'perrier', 'badoit', 'san pellegrino', 'saint yorre'], 'eau-gazeuse'],
  [['eau', 'evian', 'volvic', 'vittel', 'cristaline'], 'eau'],
  [['jus', 'smoothie'], 'jus'],
  [['sirop', 'grenadine'], 'sirop'],
  [['soda', 'cola', 'limonade', 'orangina', 'fanta', 'sprite', 'ice tea'], 'soda'],
  [['biere', 'bieres'], 'biere'],
  [['champagne', 'cremant', 'prosecco'], 'champagne'],
  [['vin', 'vins', 'rose', 'rosé'], 'vin'],
  [['whisky', 'rhum', 'vodka', 'gin', 'cognac', 'pastis', 'tequila', 'digestif'], 'whisky'],
  [['cafe', 'espresso', 'capsule', 'capsules'], 'cafe'],
  [['the', 'infusion', 'tisane'], 'the'],

  // Laitiers et oeufs
  [['yaourt', 'yaourts', 'yogourt', 'skyr', 'fromage blanc', 'danette'], 'yaourt'],
  [['lait'], 'lait'],
  [['creme', 'creme fraiche'], 'creme'],
  [['beurre', 'margarine'], 'beurre'],
  [['oeuf', 'oeufs'], 'oeuf'],
  [['mozzarella', 'burrata'], 'mozzarella'],
  [['fromage', 'comte', 'emmental', 'chevre', 'camembert', 'brie', 'parmesan', 'gruyere', 'feta', 'cheddar', 'roquefort', 'boursin', 'maroilles'], 'fromage'],

  // Viandes et poissons
  [['saucisson'], 'saucisson'],
  [['poulet', 'dinde', 'volaille', 'canard', 'cuisse', 'cuisses', 'pilon', 'pilons'], 'poulet'],
  [['steak', 'boeuf', 'viande', 'hache', 'porc', 'veau', 'cote', 'escalope', 'rosbif'], 'steak'],
  [['jambon', 'agneau', 'roti', 'charcuterie', 'rillettes'], 'jambon'],
  [['lardon', 'lardons', 'bacon'], 'lardons'],
  [['saucisse', 'saucisses', 'merguez', 'chipolata', 'knacki'], 'saucisse'],
  [['crevette', 'crevettes', 'gambas', 'homard', 'langoustine', 'crabe'], 'crevettes'],
  [['moule', 'moules', 'huitre', 'huitres', 'coquillage', 'coquillages'], 'moules'],
  [['saumon'], 'saumon'],
  [['thon'], 'thon'],
  [['poisson', 'cabillaud', 'colin', 'sardine', 'sardines', 'truite', 'maquereau', 'dorade', 'merlu', 'surimi'], 'poisson'],

  // Féculents et épicerie
  [['pates', 'pate', 'spaghetti', 'spaghettis', 'tagliatelle', 'tagliatelles', 'penne', 'macaroni', 'macaronis', 'fusilli', 'coquillette', 'coquillettes', 'nouille', 'nouilles', 'ravioli', 'raviolis', 'tortellini', 'farfalle', 'farfalles', 'capellini', 'vermicelle', 'vermicelles', 'linguine', 'rigatoni', 'torsade', 'torsades'], 'pates'],
  [['riz', 'basmati', 'semoule', 'boulgour', 'quinoa', 'ble'], 'riz'],
  [['cereales', 'muesli', 'granola', 'flocons', 'avoine'], 'cereales'],
  [['farine', 'maizena', 'levure'], 'farine'],
  [['pain de mie', 'brioche', 'biscotte', 'biscottes', 'toast', 'toasts'], 'pain-de-mie'],
  [['baguette'], 'baguette'],
  [['croissant', 'croissants', 'pain au chocolat', 'viennoiserie'], 'croissant'],
  [['pain'], 'pain'],
  [['pomme de terre', 'pommes de terre', 'patate', 'patates', 'puree'], 'pomme-de-terre'],
  [['chips'], 'chips'],
  [['cacahuete', 'cacahuetes', 'noix', 'amande', 'amandes', 'noisette', 'noisettes', 'pistache', 'pistaches', 'cajou'], 'cacahuetes'],
  [['cracker', 'crackers', 'bretzel', 'bretzels'], 'crackers'],
  [['pop corn', 'popcorn'], 'pop-corn'],
  [['compote'], 'compote'],
  [['gateau', 'gateaux', 'cake', 'fondant', 'brownie', 'muffin'], 'gateau'],
  [['donut', 'beignet'], 'donut'],
  [['biscuit', 'biscuits', 'cookie', 'cookies', 'sable', 'speculoos'], 'biscuits'],
  [['pate a tartiner', 'nutella'], 'pate-a-tartiner'],
  [['chocolat', 'chocolats'], 'chocolat'],
  [['bonbon', 'bonbons', 'sucette', 'guimauve', 'haribo'], 'bonbons'],
  [['creme glacee', 'glace', 'sorbet'], 'glace'],
  [['confiture'], 'confiture'],
  [['miel'], 'miel'],
  [['sucre', 'sucres'], 'sucre'],
  [['sel', 'poivre'], 'sel'],
  [['huile', 'huile d olive'], 'huile'],
  [['vinaigre'], 'vinaigre'],
  [['ketchup', 'sauce tomate', 'coulis'], 'ketchup'],
  [['moutarde'], 'moutarde'],
  [['mayonnaise'], 'mayonnaise'],
  [['piment', 'epice', 'epices', 'paprika', 'harissa', 'cumin', 'cannelle'], 'epices'],
  [['lentille', 'lentilles'], 'lentilles'],
  [['pois chiche', 'pois chiches'], 'pois-chiches'],
  [['bocal', 'bocaux', 'cornichon', 'cornichons', 'pesto'], 'bocal'],
  [['conserve', 'conserves', 'boite'], 'conserve'],
  [['surgele', 'surgeles', 'congele', 'congeles'], 'sac-surgele'],

  // Légumes
  [['tomate', 'tomates'], 'tomate'],
  [['carotte', 'carottes'], 'carotte'],
  [['chou fleur'], 'chou-fleur'],
  [['brocoli', 'brocolis'], 'brocoli'],
  [['salade', 'laitue', 'mache', 'roquette', 'batavia'], 'salade'],
  [['epinard', 'epinards'], 'epinards'],
  [['poireau', 'poireaux'], 'poireau'],
  [['courgette', 'courgettes'], 'courgette'],
  [['concombre', 'concombres'], 'concombre'],
  [['oignon', 'oignons', 'echalote', 'echalotes'], 'oignon'],
  [['ail'], 'ail'],
  [['poivron', 'poivrons'], 'poivron'],
  [['champignon', 'champignons', 'cepe', 'cepes'], 'champignon'],
  [['mais'], 'mais'],
  [['aubergine', 'aubergines'], 'aubergine'],
  [['avocat', 'avocats'], 'avocat'],
  [['potiron', 'courge', 'citrouille', 'butternut'], 'potiron'],
  [['haricot vert', 'haricots verts'], 'haricots-verts'],
  [['petit pois', 'petits pois'], 'petits-pois'],
  [['olive', 'olives'], 'olive'],

  // Fruits
  [['pomme', 'pommes'], 'pomme'],
  [['poire', 'poires'], 'poire'],
  [['banane', 'bananes'], 'banane'],
  [['orange', 'oranges', 'clementine', 'clementines', 'mandarine', 'mandarines', 'pamplemousse'], 'orange'],
  [['citron', 'citrons', 'citron vert', 'lime'], 'citron'],
  [['fraise', 'fraises'], 'fraise'],
  [['framboise', 'framboises'], 'framboise'],
  [['myrtille', 'myrtilles', 'mure', 'mures', 'cassis'], 'myrtille'],
  [['raisin', 'raisins'], 'raisin'],
  [['peche', 'peches', 'abricot', 'abricots', 'nectarine', 'nectarines', 'prune', 'prunes'], 'peche'],
  [['cerise', 'cerises'], 'cerise'],
  [['ananas'], 'ananas'],
  [['mangue', 'mangues'], 'mangue'],
  [['kiwi', 'kiwis'], 'kiwi'],
  [['melon', 'melons'], 'melon'],
  [['pasteque', 'pasteques'], 'pasteque'],
  [['noix de coco', 'coco'], 'coco'],
]

/** Slug de l'illustration (public/icons/<slug>.webp), ou null si aucun mot connu. */
export function productImageSlug(name: string): string | null {
  const padded = ` ${normalize(name)} `
  if (padded.trim() === '') return null
  for (const [words, slug] of RULES) {
    for (const w of words) {
      if (padded.includes(` ${w} `) || padded.includes(` ${w}s `) || padded.includes(` ${w}x `)) return slug
    }
  }
  return null
}

export function productImageUrl(slug: string): string {
  return `${import.meta.env.BASE_URL}icons/${slug}.webp`
}
