import type { Category } from '../types'

/** Couleur d'accent par catégorie d'aliment (fond doux + teinte forte), en OKLCH. */
export const CATEGORY_COLORS: Record<Category, { bg: string; fg: string }> = {
  fruits: { bg: 'oklch(0.94 0.06 20)', fg: 'oklch(0.55 0.19 25)' }, // fraise / rouge
  legumes: { bg: 'oklch(0.93 0.08 145)', fg: 'oklch(0.5 0.16 150)' }, // vert
  viandes: { bg: 'oklch(0.93 0.05 10)', fg: 'oklch(0.55 0.16 8)' }, // viande / rosé
  poissons: { bg: 'oklch(0.93 0.06 235)', fg: 'oklch(0.55 0.15 240)' }, // bleu
  laitiers: { bg: 'oklch(0.95 0.07 90)', fg: 'oklch(0.55 0.13 85)' }, // crème / jaune
  epicerie: { bg: 'oklch(0.93 0.06 65)', fg: 'oklch(0.52 0.13 60)' }, // ambre
  conserves: { bg: 'oklch(0.92 0.04 255)', fg: 'oklch(0.5 0.11 255)' }, // ardoise
  sucreries: { bg: 'oklch(0.94 0.07 350)', fg: 'oklch(0.58 0.19 350)' }, // rose bonbon
  apero: { bg: 'oklch(0.93 0.07 310)', fg: 'oklch(0.55 0.18 305)' }, // violet
  boissons: { bg: 'oklch(0.93 0.06 200)', fg: 'oklch(0.55 0.13 205)' }, // cyan
  surgeles: { bg: 'oklch(0.93 0.06 225)', fg: 'oklch(0.55 0.14 225)' }, // glace
  autre: { bg: 'oklch(0.95 0.008 220)', fg: 'oklch(0.5 0.02 220)' }, // neutre
}

export function categoryColor(c: string): { bg: string; fg: string } {
  return CATEGORY_COLORS[c as Category] ?? CATEGORY_COLORS.autre
}
