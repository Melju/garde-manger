import { normalize } from './productIcon'

/** Marques ajoutées à la main (même sans produit associé). Stockage local. */
const LS_BRANDS = 'miamm.brands.list'

function read(): string[] {
  try {
    const raw = localStorage.getItem(LS_BRANDS)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}
function write(v: string[]) {
  try {
    localStorage.setItem(LS_BRANDS, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export const getCustomBrands = () => read()

export function addBrand(name: string) {
  const n = name.trim()
  if (!n) return
  const cur = read()
  if (!cur.some((b) => normalize(b) === normalize(n))) write([n, ...cur])
}

export function removeCustomBrand(name: string) {
  write(read().filter((b) => normalize(b) !== normalize(name)))
}

export function renameCustomBrand(oldName: string, newName: string) {
  const n = newName.trim()
  if (!n) return
  write([n, ...read().filter((b) => normalize(b) !== normalize(oldName) && normalize(b) !== normalize(n))])
}
