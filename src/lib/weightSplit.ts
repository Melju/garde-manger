import { extractPackSize } from './packSize'

const MULTI = /(\d+)\s*[x×]\s*[\d.,]+\s*(?:kg|g|ml|cl|l)\b/gi
const SINGLE = /(?:^|[^\d.,])[\d]+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l)\b/gi

/** Sépare le poids/volume du nom d'un produit : « Filets marinés 180g » → nom « Filets marinés », contenance « 180 g ». */
export function splitWeight(name: string): { name: string; size?: string } | null {
  const size = extractPackSize(name)
  if (!size) return null
  const stripped = name
    .replace(MULTI, ' ')
    .replace(SINGLE, (m) => (/^[\d]/.test(m) ? ' ' : m.charAt(0) + ' '))
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:/\-–]+$/, '')
    .trim()
  if (stripped.length < 3 || stripped === name.trim()) return null
  return { name: stripped, size }
}
