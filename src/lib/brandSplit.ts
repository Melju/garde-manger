import { getStores } from './stores'
import { normalize } from './productIcon'

const NOT_BRAND = new Set(['BIO', 'AOP', 'IGP', 'UHT', 'AB', 'LABEL', 'ROUGE', 'MAXI', 'MINI', 'XL', 'XXL', 'LIGHT', 'ZERO', 'PUR'])
const isUpper = (t: string) => /\p{L}/u.test(t) && t === t.toLocaleUpperCase('fr') && !/\d/.test(t)
const pretty = (t: string) => (t.length <= 2 ? t : t.charAt(0) + t.slice(1).toLocaleLowerCase('fr'))

/** Sépare la marque (préfixe en majuscules ou magasin cité) du nom d'un produit. */
export function splitBrand(name: string): { name: string; brand: string } | null {
  const tokens = name.trim().split(/\s+/)
  if (tokens.length < 2) return null
  // 1. Magasin en début ou en fin de nom (marque de distributeur).
  for (const st of getStores()) {
    const parts = st.split(/\s+/)
    const n = parts.length
    const norm = (a: string[]) => normalize(a.join(' ')).trim()
    if (tokens.length > n && norm(tokens.slice(-n)) === norm(parts)) {
      return { name: tokens.slice(0, -n).join(' '), brand: st }
    }
    if (tokens.length > n && norm(tokens.slice(0, n)) === norm(parts)) {
      return { name: tokens.slice(n).join(' '), brand: st }
    }
  }
  // 2. Préfixe en majuscules suivi d'au moins un mot normal.
  let i = 0
  while (i < tokens.length && isUpper(tokens[i]) && !NOT_BRAND.has(tokens[i])) i++
  if (i === 0 || i >= tokens.length || tokens[0].length < 2) return null
  return { name: tokens.slice(i).join(' '), brand: tokens.slice(0, i).map(pretty).join(' ') }
}
