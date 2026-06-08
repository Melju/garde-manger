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
 * Devine la catégorie de rangement à partir des tags Open Food Facts.
 * Heuristique simple ; l'utilisateur peut corriger dans le formulaire.
 */
function guessCategory(tags: string[]): Category {
  const t = tags.join(' ')
  if (/(frozen|surgel|congel)/.test(t)) return 'surgeles'
  if (/(canned|conserve|en-conserve)/.test(t)) return 'conserves'
  if (/(dairy|cheese|yogurt|yaourt|fromage|lait|crème|creme|meat|viande|charcuterie|fresh|frais|œuf|oeuf|egg)/.test(t))
    return 'frais'
  return 'epicerie'
}

/**
 * Recherche un produit par code-barres sur Open Food Facts (API publique, sans clé).
 * Renvoie toujours un résultat ; `found: false` si le produit est inconnu.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeLookup> {
  const base: BarcodeLookup = { found: false, barcode, prefill: { barcode, category: 'epicerie', quantity: 1 } }
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode,
    )}.json?fields=product_name,product_name_fr,brands,quantity,categories_tags`
    const res = await fetch(url)
    if (!res.ok) return base
    const data = await res.json()
    if (data.status !== 1 || !data.product) return base

    const p = data.product
    const name: string = (p.product_name_fr || p.product_name || '').trim()
    const brand: string | undefined = (p.brands || '').split(',')[0]?.trim() || undefined
    const tags: string[] = Array.isArray(p.categories_tags) ? p.categories_tags : []

    // Nom affiché : « Nom Marque » si la marque n'y figure pas déjà.
    let displayName = name
    if (brand && name && !name.toLowerCase().includes(brand.toLowerCase())) {
      displayName = `${name} ${brand}`
    }

    return {
      found: Boolean(name),
      barcode,
      brand,
      prefill: {
        barcode,
        name: displayName || undefined,
        category: guessCategory(tags),
        quantity: 1,
        size: (p.quantity || '').trim() || undefined,
      },
    }
  } catch {
    return base
  }
}
