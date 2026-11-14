import { countUnit, formatContenance, parseContenance } from './contenance'

/**
 * Contenance d'UN paquet, déduite d'un libellé de ticket (« LAIT 1L », « BISC FOURRE 12 SACH 300G »…)
 * ou d'une valeur renvoyée par l'IA (« 500 g », « 24 sachets »).
 * Renvoie une contenance propre (« 300 g », « 12 sachets ») ou undefined si rien de fiable.
 */
/** Unités écrites en toutes lettres (« 113 gram », « 1 litre ») → abréviations. */
function cleanUnits(s: string): string {
  return s
    .replace(/\b(kilogrammes?|kilograms?|kilos?)\b/gi, 'kg')
    .replace(/\b(grammes?|grams?)\b/gi, 'g')
    .replace(/\b(millilitres?|milliliters?)\b/gi, 'ml')
    .replace(/\b(centilitres?|centiliters?)\b/gi, 'cl')
    .replace(/\b(litres?|liters?)\b/gi, 'l')
}

export function normalizeSize(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const m = cleanUnits(String(raw)).trim().toLowerCase().match(/^([\d.,]+)\s*(kg|g|ml|cl|l|sachets?|sach\.?|sct|pots?|tranches?|bo[iî]tes?|pi[eè]ces?|pcs?)$/)
  if (!m) return undefined
  const value = Number(m[1].replace(',', '.'))
  if (!isFinite(value) || value <= 0) return undefined
  let unit = m[2]
  const cu = countUnit(unit.replace(/\.$/, ''))
  if (cu) unit = cu
  if (unit === 'l') unit = 'L'
  if (unit === 'ml') unit = 'mL'
  if (parseContenance(`${value} ${unit}`) == null) return undefined
  return formatContenance(value, unit)
}

/** Cherche la contenance dans le libellé : multi-pack (« 6X33CL ») puis poids/volume, sinon sachets. */
export function extractPackSize(label: string): string | undefined {
  const s = cleanUnits(label).toLowerCase().replace(/,/g, '.')
  const multi = s.match(/(\d+)\s*[x×]\s*([\d.]+)\s*(kg|g|ml|cl|l)\b/)
  if (multi) {
    const n = Number(multi[1])
    const v = Number(multi[2])
    if (n > 1 && n <= 48 && v > 0) {
      const u = multi[3]
      const total = u === 'cl' ? v * n * 10 : v * n
      return normalizeSize(`${total} ${u === 'cl' ? 'ml' : u}`)
    }
  }
  const w = s.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/)
  if (w) {
    const sachets = s.match(/(?:^|[^\d.])(\d+)\s*(?:sachets?|sach\.?|sct)\b/)
    // « 12 sachets 300 g » : on garde le nombre de sachets, plus utile pour la conso.
    if (sachets) return normalizeSize(`${sachets[1]} sachet`)
    return normalizeSize(`${w[1]} ${w[2]}`)
  }
  const sach = s.match(/(?:^|[^\d.])(\d+)\s*(?:sachets?|sach\.?|sct)\b/)
  if (sach) return normalizeSize(`${sach[1]} sachet`)
  const other = s.match(/(?:^|[^\d.])(\d+)\s*(pots?|tranches?|bo[iî]tes?|pi[eè]ces?|pcs?)(?![a-zà-ÿ])/)
  if (other && Number(other[1]) > 1) return normalizeSize(`${other[1]} ${other[2]}`)
  return undefined
}
