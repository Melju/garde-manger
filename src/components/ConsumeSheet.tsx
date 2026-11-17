import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '../types'
import { consumeAmount, formatContenance, portionScale, countLabel, countPerPack, isWeightProduct } from '../lib/contenance'

/**
 * Retrait d'une quantité à la souris (PC) : curseur pour une portion au poids/volume,
 * ou compteur −/+ pour des unités ou des sachets. Remplace la molette tactile.
 */
export function ConsumeSheet({
  product,
  onClose,
  onRemoveQty,
  onConsumePortion,
  onConsumeSachets,
}: {
  product: Product
  onClose: () => void
  onRemoveQty: (product: Product, qty: number | 'all') => void
  onConsumePortion: (product: Product, newSize: string | null) => void
  onConsumeSachets?: (product: Product, n: number) => void
}) {
  const byWeight = product.quantity <= 1 && isWeightProduct(product.size)
  const scale = byWeight ? portionScale(product.size) : null
  const pack = product.quantity > 1 ? countPerPack(product.size) : null
  const sachets = pack && onConsumeSachets ? product.quantity * pack.per : 0
  const max = sachets || Math.max(1, product.quantity)

  const [idx, setIdx] = useState(scale ? Math.min(1, scale.values.length - 1) : 0)
  const [n, setN] = useState(1)

  const confirm = () => {
    if (scale) {
      const v = scale.values[idx]
      if (v > 0) onConsumePortion(product, consumeAmount(product.size!, v, scale.baseUnit))
    } else if (sachets && onConsumeSachets) onConsumeSachets(product, n)
    else onRemoveQty(product, n >= product.quantity ? 'all' : n)
    onClose()
  }

  const label = scale
    ? formatContenance(scale.values[idx], scale.baseUnit)
    : sachets
      ? countLabel(n, pack!.unit)
      : `${n}`

  return createPortal(
    <div className="cselect-overlay" onClick={onClose}>
      <div className="cselect-sheet scan-consume-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="scs-head">
          <div className="scs-name">Consommer : {product.name}</div>
          <div className="scs-stock">Combien en as-tu utilisé ?</div>
        </div>
        {scale ? (
          <div className="cs-range">
            <div className="cs-range-value">{label}</div>
            <div className="cs-range-row">
              <button className="cs-step" aria-label="Moins" disabled={idx <= 1} onClick={() => setIdx((i) => Math.max(1, i - 1))}>−</button>
              <input
                type="range"
                min={1}
                max={scale.values.length - 1}
                value={idx}
                onChange={(e) => setIdx(Number(e.target.value))}
              />
              <button
                className="cs-step"
                aria-label="Plus"
                disabled={idx >= scale.values.length - 1}
                onClick={() => setIdx((i) => Math.min(scale.values.length - 1, i + 1))}
              >
                +
              </button>
            </div>
            <div className="cs-range-ends">
              <span>{formatContenance(scale.values[1] ?? 0, scale.baseUnit)}</span>
              <button onClick={() => setIdx(scale.values.length - 1)}>Tout ({formatContenance(scale.values[scale.values.length - 1], scale.baseUnit)})</button>
            </div>
          </div>
        ) : (
          <div className="scs-stepper">
            <button aria-label="Moins" disabled={n <= 1} onClick={() => setN((v) => Math.max(1, v - 1))}>−</button>
            <span>{label}</span>
            <button aria-label="Plus" disabled={n >= max} onClick={() => setN((v) => Math.min(max, v + 1))}>+</button>
            <button className="scs-all" onClick={() => setN(max)}>Tout ({max})</button>
          </div>
        )}
        <button className="btn-primary scs-go" onClick={confirm}>
          Retirer {label}
        </button>
        <button className="scs-cancel" onClick={onClose}>Annuler</button>
      </div>
    </div>,
    document.body,
  )
}
