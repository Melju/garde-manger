import type { Conservation } from '../types'

/**
 * Mode de conservation déduit de l'emplacement (« Congélateur » = congelé, « Réfrigérateur » = réfrigéré).
 * Comparaison sans accents : « congélateur » ne contient pas « congel » tel quel.
 */
export function conservationOfLocation(location?: string): Conservation {
  const n = (location ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (n.includes('congel') || n.includes('freez')) return 'congele'
  if (n.includes('frigo') || n.includes('refrig') || n.includes('fridge')) return 'refrigere'
  return 'frais'
}
