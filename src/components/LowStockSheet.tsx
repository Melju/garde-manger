import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Product, ShopCatalogEntry } from '../types'
import { remainingRatio } from '../lib/contenance'

export interface LowCandidate {
  key: string
  name: string
  category: Product['category']
  total: number
  reason: string
  /** Vraiment à racheter : pré-coché. */
  urgent: boolean
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Produits à racheter : les lots d'un même produit sont additionnés (4 lots de 1 = 4, pas « bas »).
 * Pré-cochés seulement les cas vraiment bas : paquet entamé à 25 % ou moins, paquet ouvert, ou produit
 * habituel (déjà acheté plusieurs fois) dont il ne reste que le dernier exemplaire.
 */
export function lowStockCandidates(
  products: Product[],
  shoppingNames: Set<string>,
  threshold: number,
  catalog: ShopCatalogEntry[],
): LowCandidate[] {
  const groups = new Map<string, Product[]>()
  for (const p of products) {
    const k = norm(p.name)
    if (!k || shoppingNames.has(k)) continue
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  const bought = new Map(catalog.map((c) => [norm(c.name), c.count ?? 0]))
  const out: LowCandidate[] = []
  for (const [key, lots] of groups) {
    const total = lots.reduce((s, p) => s + (p.quantity || 0), 0)
    if (total > threshold) continue
    const p = lots[0]
    const ratios = lots.map((l) => remainingRatio(l.size)).filter((r): r is number => r !== null)
    const lowest = ratios.length ? Math.min(...ratios) : null
    const opened = lots.some((l) => l.openedAt)
    const habitual = (bought.get(key) ?? 0) >= 2
    let reason = total <= 0 ? 'Épuisé' : 'Dernier exemplaire'
    let urgent = total <= 0
    if (lowest !== null && lowest <= 0.25) {
      reason = `Presque fini (${Math.round(lowest * 100)} % restant)`
      urgent = true
    } else if (opened) {
      reason = 'Dernier paquet, déjà ouvert'
      urgent = true
    } else if (habitual) {
      reason = 'Dernier exemplaire, acheté souvent'
      urgent = true
    }
    out.push({ key, name: p.name, category: p.category, total, reason, urgent })
  }
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.name.localeCompare(b.name, 'fr'))
}

export function LowStockSheet({
  candidates,
  onConfirm,
  onCancel,
}: {
  candidates: LowCandidate[]
  onConfirm: (picked: LowCandidate[]) => void
  onCancel: () => void
}) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(candidates.filter((c) => c.urgent).map((c) => c.key)))
  const urgent = useMemo(() => candidates.filter((c) => c.urgent), [candidates])
  const others = useMemo(() => candidates.filter((c) => !c.urgent), [candidates])
  const toggle = (k: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const row = (c: LowCandidate) => (
    <label key={c.key} className="lss-row">
      <input type="checkbox" checked={sel.has(c.key)} onChange={() => toggle(c.key)} />
      <span className="lss-text">
        <span className="lss-name">{c.name}</span>
        <span className="lss-reason">{c.reason}</span>
      </span>
    </label>
  )

  return createPortal(
    <div className="cselect-overlay" onClick={onCancel}>
      <div className="cselect-sheet lss-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cselect-handle" />
        <div className="lss-title">Que veux-tu racheter ?</div>
        <div className="lss-list">
          {urgent.length > 0 && <div className="lss-group">À racheter</div>}
          {urgent.map(row)}
          {others.length > 0 && (
            <div className="lss-group lss-group-row">
              <span>Dernier exemplaire ({others.length})</span>
              <button
                onClick={() =>
                  setSel((s) => {
                    const n = new Set(s)
                    const all = others.every((c) => n.has(c.key))
                    for (const c of others) (all ? n.delete(c.key) : n.add(c.key))
                    return n
                  })
                }
              >
                {others.every((c) => sel.has(c.key)) ? 'Tout décocher' : 'Tout cocher'}
              </button>
            </div>
          )}
          {others.map(row)}
        </div>
        <button
          className="btn-primary lss-go"
          disabled={sel.size === 0}
          onClick={() => onConfirm(candidates.filter((c) => sel.has(c.key)))}
        >
          {sel.size === 0 ? 'Rien de sélectionné' : `Ajouter ${sel.size} article${sel.size > 1 ? 's' : ''}`}
        </button>
        <button className="scs-cancel" onClick={onCancel}>Annuler</button>
      </div>
    </div>,
    document.body,
  )
}
