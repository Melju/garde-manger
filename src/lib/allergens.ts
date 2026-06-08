import type { FamilyMember } from '../types'

/** Libellés français des allergènes (clés Open Food Facts normalisées). */
const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'Gluten',
  milk: 'Lait',
  eggs: 'Œufs',
  nuts: 'Fruits à coque',
  peanuts: 'Arachides',
  soybeans: 'Soja',
  fish: 'Poisson',
  crustaceans: 'Crustacés',
  molluscs: 'Mollusques',
  celery: 'Céleri',
  mustard: 'Moutarde',
  sesame: 'Sésame',
  'sesame-seeds': 'Sésame',
  sulphites: 'Sulfites',
  'sulphur-dioxide-and-sulphites': 'Sulfites',
  lupin: 'Lupin',
}

export function allergenLabel(key: string): string {
  return ALLERGEN_LABELS[key] ?? key
}

/** Restriction famille → clés d'allergènes correspondantes. */
const RESTRICTION_TO_ALLERGENS: Record<string, string[]> = {
  'sans gluten': ['gluten'],
  'sans lactose': ['milk'],
  'sans œufs': ['eggs'],
  'sans oeufs': ['eggs'],
  'sans fruits à coque': ['nuts', 'peanuts'],
  'sans fruits de mer': ['crustaceans', 'molluscs'],
}

export interface AllergenWarning {
  member: FamilyMember
  allergens: string[]
}

/** Détecte les conflits entre les allergènes d'un produit et les restrictions des membres. */
export function familyAllergenWarnings(
  allergens: string[] | undefined,
  family: FamilyMember[],
): AllergenWarning[] {
  if (!allergens || allergens.length === 0) return []
  const present = new Set(allergens)
  const out: AllergenWarning[] = []
  for (const m of family) {
    const hits = new Set<string>()
    for (const r of m.restrictions) {
      for (const key of RESTRICTION_TO_ALLERGENS[r.toLowerCase()] ?? []) {
        if (present.has(key)) hits.add(key)
      }
    }
    if (hits.size) out.push({ member: m, allergens: [...hits] })
  }
  return out
}
