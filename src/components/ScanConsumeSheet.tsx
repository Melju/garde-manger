import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '../types'
import { parseContenance, stockLabel, countUnit } from '../lib/contenance'

export type ConsumeChoice = { kind: 'units'; n: number } | { kind: 'fraction'; f: number }

/** Feuille affichée après un scan de retrait : on choisit combien retirer avant de valider. */
export function ScanConsumeSheet({
  product,
  onConfirm,
  onCancel,
}: {
  product: Product
  onConfirm: (c: ConsumeChoice) => void
  onCancel: () => void
}) {
  const max = Math.max(1, product.quantity)
  const [n, setN] = useState(1)
  const parsed = parseContenance(product.size)
  // Une partie d'un paquet : utile au poids/volume, ou pour un paquet de plusieurs pièces/sachets.
  const canPortion = Boolean(parsed && (!countUnit(parsed.unit) || parsed.value > 1))
  const [mode, setMode] = useState<'units' | 'part'>('units')
  const label = stockLabel(product) ?? `×${product.quantity}${product.unit ? ' ' + product.unit : ''}`

  return createPortal(
    <div className="cselect-overlay" onClick={onCancel}>
      <div className="cselect-sheet scan-consume-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cselect-handle" />
        <div className="scs-head">
          <div className="scs-name">{product.name}</div>
          <div className="scs-stock">En stock : {label}</div>
        </div>

        {canPortion && (
          <div className="scs-tabs">
            <button className={mode === 'units' ? 'on' : ''} onClick={() => setMode('units')}>
              {max > 1 ? 'Paquets entiers' : 'Le paquet entier'}
            </button>
            <button className={mode === 'part' ? 'on' : ''} onClick={() => setMode('part')}>
              Une partie
            </button>
          </div>
        )}

        {mode === 'units' ? (
          <>
            {max > 1 && (
              <div className="scs-stepper">
                <button aria-label="Moins" disabled={n <= 1} onClick={() => setN((v) => Math.max(1, v - 1))}>−</button>
                <span>{n}</span>
                <button aria-label="Plus" disabled={n >= max} onClick={() => setN((v) => Math.min(max, v + 1))}>+</button>
                <button className="scs-all" onClick={() => setN(max)}>Tout ({max})</button>
              </div>
            )}
            <button className="btn-primary scs-go" onClick={() => onConfirm({ kind: 'units', n })}>
              {n >= max ? 'Retirer du stock' : `Retirer ${n}`}
            </button>
          </>
        ) : (
          <div className="scs-fracs">
            {[
              [0.25, '¼'],
              [0.5, '½'],
              [0.75, '¾'],
            ].map(([f, l]) => (
              <button key={l as string} className="btn-secondary" onClick={() => onConfirm({ kind: 'fraction', f: f as number })}>
                {l} {max > 1 ? "d'un paquet" : 'du paquet'}
              </button>
            ))}
          </div>
        )}

        <button className="scs-cancel" onClick={onCancel}>Annuler</button>
      </div>
    </div>,
    document.body,
  )
}
