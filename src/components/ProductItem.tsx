import { useRef, useState } from 'react'
import type { Product } from '../types'
import { categoryLabel } from '../types'
import { expiryLabel, expiryStatus } from '../lib/expiry'
import { categoryColor } from '../lib/categoryColors'
import { Icon } from './Icon'

interface ProductItemProps {
  product: Product
  onSelect: (product: Product) => void
  onRemoveQty: (product: Product, qty: number | 'all') => void
}

/**
 * Élément de la liste d'inventaire avec geste « glisser vers la gauche »
 * révélant les boutons de retrait de quantité (−1, −2, −3, tout).
 */
export function ProductItem({ product, onSelect, onRemoveQty }: ProductItemProps) {
  const [swiped, setSwiped] = useState(false)
  const startX = useRef<number | null>(null)
  const moved = useRef(false)

  const status = expiryStatus(product)
  const col = categoryColor(product.category)

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    moved.current = false
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    if (Math.abs(dx) > 8) moved.current = true
    if (dx < -40) setSwiped(true)
    else if (dx > 40) setSwiped(false)
  }

  function onPointerUp() {
    startX.current = null
  }

  function handleClick() {
    // Un clic après un glissement ne doit pas ouvrir la fiche.
    if (moved.current) return
    if (swiped) {
      setSwiped(false)
      return
    }
    onSelect(product)
  }

  const meta = [categoryLabel(product.category), product.size].filter(Boolean).join(' · ')
  const qtyLabel = product.unit ? `×${product.quantity} ${product.unit}` : `×${product.quantity}`

  return (
    <div className={`swipe-wrapper${swiped ? ' swiped' : ''}`}>
      <div
        className="product-item"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={handleClick}
      >
        <div className="product-icon" style={{ background: col.bg, color: col.fg }}>
          <Icon name="box" width={1.7} />
        </div>
        <div className="product-info">
          <div className="product-name">{product.name}</div>
          <div className="product-meta">{meta}</div>
        </div>
        <div className="product-right">
          <div className="product-qty">{qtyLabel}</div>
          <span className={`status-tag ${status}`}>{expiryLabel(product)}</span>
        </div>
      </div>
      <div className="swipe-actions">
        <div className="swipe-qty-picker">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className="qty-btn"
              disabled={n > product.quantity}
              onClick={() => {
                onRemoveQty(product, n)
                setSwiped(false)
              }}
            >
              −{n}
            </button>
          ))}
          <button
            className="qty-btn delete-all"
            onClick={() => {
              onRemoveQty(product, 'all')
              setSwiped(false)
            }}
          >
            Tout<span>suppr.</span>
          </button>
        </div>
      </div>
    </div>
  )
}
