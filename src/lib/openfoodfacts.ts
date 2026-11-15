import { extractPackSize } from './packSize'
import { splitWeight } from './weightSplit'
import type { Category, ProductInput } from '../types'

/** Résultat d'une recherche de code-barres. */
export interface BarcodeLookup {
  found: boolean
  barcode: string
  /** Pré-remplissage du formulaire produit (partiel). */
  prefill: Partial<ProductInput>
  /** Nom de marque, si disponible (pour information). */
  brand?: string
}

/**
 * Devine la catégorie d'aliment à partir des tags Open Food Facts.
 * Heuristique simple ; l'utilisateur peut corriger dans le formulaire.
 */
function guessCategory(tags: string[]): Category {
  // La catégorie parapluie d'OFF « plant-based-foods-and-beverages » contient
  // le mot « beverages » et fausse la détection (pâtes, riz, farine en font partie).
  const clean = tags.filter((x) => !/plant-based-foods-and-beverages/.test(x))
  const t = clean.join(' ')
  if (/(frozen|surgel|congel)/.test(t)) return 'surgeles'
  if (/(huile|\boils?\b)/.test(t)) return 'huiles'
  if (/(baking|levure|yeast|chocolate-chips|pepites|vanill|cake-decorat|maizena|cornflour|fecule)/.test(t)) return 'patisserie'
  // Épicerie sèche détectée tôt (avant boissons) : pâtes, riz, céréales, légumes secs…
  if (/(pasta|p[aâ]tes|spaghetti|macaroni|rice|riz|cereal|c[eé]r[eé]al|flour|farine|semoule|couscous|quinoa|lentil|lentille|l[eé]gumineuse|pois-chiche|haricot|farines|sucre|sugar|sel|salt|huile|oil|vinaigre|sauce|epice|[eé]pice|condiment)/.test(t)) return 'epicerie'
  if (/(beverage|boisson|drink|juice|jus|soda|water|eau|wine|\bvin\b|biere|bi[eè]re|beer|coffee|caf[eé]|\bthe\b|th[eé]|tea)/.test(t)) return 'boissons'
  if (/(fruit)/.test(t)) return 'fruits'
  if (/(vegetable|legume|l[eé]gume|salad)/.test(t)) return 'legumes'
  if (/(meat-alternative|meat-analogue|meat-substitute|plant-based-meat|vegetarian-burger|vegan-burger|vegetable-burger|substituts-de-viande|analogues-de-viande|simili-carne)/.test(t)) return 'viandes-vg'
  if (/(meat|viande|charcuterie|poultry|volaille|beef|boeuf|porc|chicken|poulet|jambon)/.test(t)) return 'viandes'
  if (/(fish|poisson|seafood|fruits-de-mer|saumon|thon)/.test(t)) return 'poissons'
  if (/(dairy|cheese|yogurt|yaourt|fromage|lait|crème|creme|milk|butter|beurre|egg|œuf|oeuf)/.test(t)) return 'laitiers'
  if (/(canned|conserve|en-conserve)/.test(t)) return 'conserves'
  // Sucré AVANT apéro : « biscuits » porte souvent le tag « snacks » (sweet-snacks).
  if (/(candy|sweet|chocolate|chocolat|biscuit|cookie|gaufre|wafer|cake|gateau|g[aâ]teau|p[aâ]tisserie|confiserie|bonbon|dessert|glace|ice-cream)/.test(t)) return 'sucreries'
  if (/(chips|crisp|cracker|aperitif|ap[eé]ritif|apero|ap[eé]ro|olive|cacahu|peanut|salty-snack|salted)/.test(t)) return 'apero'
  return 'epicerie'
}

/**
 * Recherche un produit par code-barres sur Open Food Facts (API publique, sans clé).
 * Renvoie toujours un résultat ; `found: false` si le produit est inconnu.
 */
/**
 * Boîtes de biscuits, barres, portions : Open Food Facts donne le grammage (« 300 g (10 x 30 g) »).
 * On préfère le nombre de sachets, plus utile à compter. Renvoie null si rien de dénombrable.
 */
export function packCount(quantity: string, category: string): string | null {
  const q = quantity.toLowerCase().replace(/\u00a0/g, ' ')
  // « 10 sachets », « 12 barres », « 8 portions »...
  const direct = q.match(/(\d+)\s*(?:sachets?|portions?|barres?|biscuits?|galettes?|gaufrettes?|madeleines?)\b/)
  if (direct) return `${direct[1]} sachet`
  // « 10 x 30 g » seulement pour les produits secs (pas un pack de 6 x 1 L d'eau)
  const dry = ['sucreries', 'apero', 'epicerie'].includes(category)
  const multi = q.match(/(\d+)\s*[x×]\s*[\d.,]+\s*(?:g|kg)\b/)
  if (dry && multi && Number(multi[1]) > 1) return `${multi[1]} sachet`
  return null
}

export async function lookupBarcode(barcode: string): Promise<BarcodeLookup> {
  const base: BarcodeLookup = { found: false, barcode, prefill: { barcode, category: 'epicerie', quantity: 1 } }
  try {
    const fields = [
      'product_name',
      'product_name_fr',
      'brands',
      'quantity',
      'categories_tags',
      'image_front_url',
      'image_url',
      'nutriscore_grade',
      'nova_group',
      'nutriments',
      'allergens_tags',
    ].join(',')
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`
    const res = await fetch(url)
    if (!res.ok) return base
    const data = await res.json()
    if (data.status !== 1 || !data.product) return base

    const p = data.product
    const name: string = (p.product_name_fr || p.product_name || '').trim()
    const brand: string | undefined = (p.brands || '').split(',')[0]?.trim() || undefined
    const tags: string[] = Array.isArray(p.categories_tags) ? p.categories_tags : []

    // La marque a son propre champ : on la retire du nom si Open Food Facts l'y a mise.
    let displayName = name
    if (brand && name) {
      const esc = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const stripped = name.replace(new RegExp(`(^|\\s)${esc}(?=\\s|$)`, 'i'), ' ').replace(/\s+/g, ' ').trim()
      if (stripped.length >= 3) displayName = stripped
    }
    // Le poids a son propre champ (contenance) : on le retire du nom.
    if (displayName) displayName = splitWeight(displayName)?.name ?? displayName

    const grade: string | undefined =
      typeof p.nutriscore_grade === 'string' && /^[a-e]$/i.test(p.nutriscore_grade)
        ? p.nutriscore_grade.toLowerCase()
        : undefined
    const nova: number | undefined =
      typeof p.nova_group === 'number' ? p.nova_group : Number(p.nova_group) || undefined
    const kcalRaw = p.nutriments?.['energy-kcal_100g']
    const kcal: number | undefined = typeof kcalRaw === 'number' ? Math.round(kcalRaw) : undefined
    const allergens: string[] = Array.isArray(p.allergens_tags)
      ? p.allergens_tags.map((t: string) => t.replace(/^[a-z]{2}:/, '')).filter(Boolean)
      : []

    return {
      found: Boolean(name),
      barcode,
      brand,
      prefill: {
        barcode,
        name: displayName || undefined,
        brand,
        category: guessCategory(tags),
        quantity: 1,
        size: packCount(String(p.quantity || ''), guessCategory(tags)) ?? extractPackSize(String(p.quantity || '')) ?? ((p.quantity || '').trim() || undefined),
        imageUrl: p.image_front_url || p.image_url || undefined,
        nutriscore: grade,
        nova,
        kcal,
        allergens: allergens.length ? allergens : undefined,
      },
    }
  } catch {
    return base
  }
}
