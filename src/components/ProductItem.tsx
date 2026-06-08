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
  onWaste: (product: Product) => void
}

type Swipe = 'none' | 'left' | 'right'

/**
 * Élément d'inventaire avec gestes :
 * - glisser à gauche → retirer des quantités (consommé)
 * - glisser à droite → marquer périmé (jeté)
 */
export function ProductItem({ product, onSelect, onRemoveQty, onWaste }: ProductItemProps) {
  const [swipe, setSwipe] = useState<Swipe>('none')
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
    if (dx < -40) setSwipe('left')
    else if (dx > 40) setSwipe('right')
  }
  function onPointerUp() {
    startX.current = null
  }
  function handleClick() {
    if (moved.current) return
    if (swipe !== 'none') {
      setSwipe('none')
      return
    }
    onSelect(product)
  }

  const meta = [categoryLabel(product.category), product.size].filter(Boolean).join(' · ')
  const qtyLabel = product.unit ? `×${product.quantity} ${product.unit}` : `×${product.quantity}`

  return (
    <div className={`swipe-wrapper${swipe === 'left' ? ' swiped-left' : swipe === 'right' ? ' swiped-right' : ''}`}>
      {/* Action gauche révélée par un glissement vers la droite : périmé */}
      <div className="swipe-actions left">
        <button
          className="qty-btn waste"
          onClick={() => {
            onWaste(product)
            setSwipe('none')
          }}
        >
          Périmé<span>jeté</span>
        </button>
      </div>

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

      {/* Action droite révélée par un glissement vers la gauche : retirer */}
      <div className="swipe-actions right">
        <div className="swipe-qty-picker">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className="qty-btn"
              disabled={n > product.quantity}
              onClick={() => {
                onRemoveQty(product, n)
                setSwipe('none')
              }}
            >
              −{n}
            </button>
          ))}
          <button
            className="qty-btn delete-all"
            onClick={() => {
              onRemoveQty(product, 'all')
              setSwipe('none')
            }}
          >
            Tout<span>suppr.</span>
          </button>
        </div>
      </div>
    </div>
  )
}
