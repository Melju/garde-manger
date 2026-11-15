import type { Category } from '../types'
import { normalize } from './productIcon'

/**
 * Durée de conservation (jours, au frigo) d'un produit une fois ouvert.
 * Valeurs prudentes, indicatives ; le premier mot-clé trouvé l'emporte (du plus précis au plus général).
 */
const OPEN_ROWS: [string[], number][] = [
  [['creme fraiche'], 7],
  [['creme liquide', 'creme entiere', 'creme legere', 'creme uht', 'creme fleurette'], 4],
  [['creme dessert', 'creme anglaise'], 3],
  [['creme'], 5],
  [['mascarpone'], 5],
  [['ricotta'], 4],
  [['fromage frais', 'fromage blanc', 'cottage', 'petit suisse'], 4],
  [['faisselle'], 3],
  [['yaourt', 'yogourt', 'skyr', 'dessert lacte'], 3],
  [['lait de coco', 'lait de soja', 'lait d amande', 'lait d avoine', 'lait vegetal', 'boisson vegetale'], 4],
  [['lait'], 3],
  [['rape'], 5],
  [['mozzarella'], 4],
  [['feta'], 7],
  [['saumon fume'], 3],
  [['jambon', 'charcuterie', 'lardon', 'blanc de poulet', 'blanc de dinde'], 4],
  [['bacon'], 5],
  [['rillettes', 'foie gras', 'terrine'], 5],
  [['houmous', 'hummus'], 5],
  [['tzatziki', 'taboule', 'salade composee'], 3],
  [['guacamole'], 2],
  [['pesto', 'tapenade'], 7],
  [['bechamel', 'sauce blanche', 'bolognaise', 'sauce carbonara'], 4],
  [['sauce tomate', 'coulis', 'passata', 'concentre de tomate'], 5],
  [['ketchup', 'mayonnaise', 'moutarde', 'sauce soja', 'sauce'], 60],
  [['cornichon', 'oignons au vinaigre', 'oignon au vinaigre', 'vinaigre', 'olive', 'capres'], 30],
  [['confiture', 'gelee', 'miel'], 30],
  [['compote'], 5],
  [['jus', 'smoothie'], 4],
  [['soupe', 'bouillon', 'veloute'], 4],
  [['tofu', 'seitan', 'tempeh'], 4],
  [['thon', 'sardine', 'maquereau'], 2],
  [['haricot', 'mais', 'petits pois', 'macedoine', 'champignon', 'legumes', 'poivron', 'artichaut', 'conserve'], 3],
  [['bocal', 'pot'], 7],
]

/** Durée proposée après ouverture ; `known` = false quand c'est la valeur par défaut. */
export function openShelfDays(name: string, _category?: Category): { days: number; known: boolean } {
  const padded = ` ${normalize(name)} `
  for (const [words, days] of OPEN_ROWS) {
    for (const w of words) {
      if (padded.includes(` ${w} `) || padded.includes(` ${w}s `) || padded.includes(` ${w}x `) || (w === 'rape' && padded.includes(' rape'))) {
        return { days, known: true }
      }
    }
  }
  return { days: 7, known: false }
}

export const OPEN_CHOICES = [2, 3, 5, 7, 14, 30]
