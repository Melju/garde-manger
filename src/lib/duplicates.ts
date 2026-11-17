import type { Product } from '../types'

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'au', 'aux', 'a', 'et', 'en', 'a', 'pour', 'avec', 'the', 'and', 'of', 'met', 'mit', 'con', 'with'])

/** Mots significatifs d'un nom : sans accents, articles, contenances (500 g, 6x33cl…). */
export function nameTokens(name: string): string[] {
  return name
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b\d+([.,]\d+)?\s*(x\s*\d+([.,]\d+)?\s*)?(g|gr|kg|ml|cl|l|pcs?|pieces?|x)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w))
}

export interface DupGroup {
  /** Noms différents qui désignent probablement le même produit. */
  names: { name: string; count: number }[]
  /** Nom proposé (le plus utilisé, puis le plus court). */
  suggested: string
  /** Même nom à l'écriture près (casse, accents, contenance) : très probable. */
  strong: boolean
}

/**
 * Regroupe les noms de produits proches.
 * Fort : mêmes mots significatifs (casse, accents, contenance, articles).
 * Faible : le nom long n'ajoute qu'un mot d'emballage ou de gamme (« Boîte de thon » / « Thon »).
 */
export function findDuplicates(products: Product[], ignored: Set<string> = new Set()): DupGroup[] {
  const counts = new Map<string, number>()
  for (const p of products) counts.set(p.name.trim(), (counts.get(p.name.trim()) ?? 0) + 1)
  const names = [...counts.keys()]
  const tok = new Map(names.map((n) => [n, nameTokens(n)]))

  // Union-find léger
  const parent = new Map(names.map((n) => [n, n]))
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!))
  const strongPair = new Set<string>()
  const union = (a: string, b: string, strong: boolean) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
    if (strong) strongPair.add(find(a))
  }
  // Mots d'emballage ou de gamme, qui ne changent pas le produit (« Boîte de thon » = « Thon »).
  const PACKAGING = new Set(['boite', 'boites', 'sachet', 'sachets', 'pot', 'bocal', 'brique', 'bouteille', 'paquet', 'classic', 'classics', 'original', 'originale', 'bio', 'maison', 'nature'])

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i]
      const b = names[j]
      const ta = tok.get(a)!
      const tb = tok.get(b)!
      if (!ta.length || !tb.length) continue
      const sa = ta.join(' ')
      const sb = tb.join(' ')
      if (sa === sb) {
        union(a, b, true)
        continue
      }
      const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
      const extra = long.filter((w) => !short.includes(w))
      // Faible : un seul mot en plus, et c'est un mot d'emballage ou de gamme.
      // « Saumon » / « Saumon fumé » ou « Haricots blancs » / « … à la sauce tomate » restent séparés.
      if (short.every((w) => long.includes(w)) && extra.length === 1 && PACKAGING.has(extra[0])) union(a, b, false)
    }
  }

  const groups = new Map<string, string[]>()
  for (const n of names) groups.set(find(n), [...(groups.get(find(n)) ?? []), n])
  const out: DupGroup[] = []
  for (const [root, members] of groups) {
    if (members.length < 2) continue
    const key = [...members].sort().join('|')
    if (ignored.has(key)) continue
    const list = members.map((name) => ({ name, count: counts.get(name)! })).sort((x, y) => y.count - x.count || x.name.length - y.name.length)
    out.push({ names: list, suggested: list[0].name, strong: strongPair.has(root) && members.every((m) => tok.get(m)!.join(' ') === tok.get(members[0])!.join(' ')) })
  }
  return out.sort((a, b) => Number(b.strong) - Number(a.strong) || b.names.length - a.names.length)
}

export const groupKey = (g: DupGroup) => g.names.map((n) => n.name).sort().join('|')
