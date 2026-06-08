import { useRef, useState } from 'react'
import type { Product } from '../types'
import { categoryLabel } from '../types'
import { expiryLabel, expiryStatus } from '../lib/expiry'
import { categoryColor } from '../lib/categoryColors'
import {
  isWeightProduct,
  consumeAmount,
  portionScale,
  formatContenance,
} from '../lib/contenance'
import { Icon } from './Icon'
import { SwipeWheel } from './SwipeWheel'

interface ProductItemProps {
  product: Product
  onSelect: (product: Product) => void
  onRemoveQty: (product: Product, qty: number | 'all') => void
  onWaste: (product: Product) => void
  /** Mise à jour de la contenance restante (null = paquet terminé). */
  onConsumePortion: (product: Product, newSize: string | null) => void
}

type Swipe = 'none' | 'left' | 'right'

/**
 * Élément d'inventaire avec gestes :
 * - glisser à gauche → molette pour retirer (poids ou nombre)
 * - glisser à droite → marquer périmé (jeté)
 */
export function ProductItem({
  product,
  onSelect,
  onRemoveQty,
  onWaste,
  onConsumePortion,
}: ProductItemProps) {
  const [swipe, setSwipe] = useState<Swipe>('none')
  const startX = useRef<number | null>(null)
  const moved = useRef(false)

  const status = expiryStatus(product)
  const col = categoryColor(product.category)
  // Produit au poids/volume si une seule unité en stock avec une contenance continue.
  const byWeight = product.quantity <= 1 && isWeightProduct(product.size)
  const scale = byWeight ? portionScale(product.size) : null

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
    <div
      className={`swipe-wrapper${swipe === 'left' ? ' swiped-left' : swipe === 'right' ? ' swiped-right' : ''}`}
    >
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

      {/* Action droite révélée par un glissement vers la gauche : molette de retrait */}
      <div className="swipe-actions right">
        {byWeight && scale ? (
          <SwipeWheel
            values={scale.values}
            itemW={26}
            initialIndex={1}
            isMajor={(v) => v % scale.major === 0 || v === scale.values[scale.values.length - 1]}
            format={(v) => (v === 0 ? '0' : formatContenance(v, scale.baseUnit))}
            onConfirm={(v) => {
              setSwipe('none')
              if (v <= 0) return
              onConsumePortion(product, consumeAmount(product.size!, v, scale.baseUnit))
            }}
          />
        ) : (
          <SwipeWheel
            values={Array.from({ length: product.quantity }, (_, i) => i + 1)}
            itemW={48}
            initialIndex={0}
            isMajor={() => true}
            format={(v) => `−${v}`}
            onConfirm={(v) => {
              setSwipe('none')
              onRemoveQty(product, v >= product.quantity ? 'all' : v)
            }}
          />
        )}
      </div>
    </div>
  )
}
