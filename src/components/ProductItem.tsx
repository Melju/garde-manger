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
  stockLabel,
  normalizeBareUnit,
} from '../lib/contenance'
import { Icon, categoryIcon } from './Icon'
import { FoodIcon, hasFoodIcon } from './FoodIcon'
import { productIconKey } from '../lib/productIcon'
import { productImageSlug, productImageUrl } from '../lib/productImage'
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
  product: rawProduct,
  onSelect,
  onRemoveQty,
  onWaste,
  onConsumePortion,
}: ProductItemProps) {
  // « kg » seul (ancienne saisie) est lu comme « 1 kg ».
  const product = normalizeBareUnit(rawProduct)
  const [swipe, setSwipe] = useState<Swipe>('none')
  const startX = useRef<number | null>(null)
  const moved = useRef(false)

  const status = expiryStatus(product)
  const col = categoryColor(product.category)
  const iconKey = productIconKey(product.name)
  const imageSlug = productImageSlug(product.name)
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
    onSelect(rawProduct)
  }

  const weightLabel = stockLabel(product)
  // Au poids / volume, la quantité est affichée à droite (« 700 g / 1 kg ») : pas de doublon dans la ligne de détail.
  const meta = [categoryLabel(product.category), weightLabel ? null : product.size].filter(Boolean).join(' · ')
  const qtyLabel =
    weightLabel ?? (product.unit ? `×${product.quantity} ${product.unit}` : `×${product.quantity}`)

  return (
    <div
      className={`swipe-wrapper${swipe === 'left' ? ' swiped-left' : swipe === 'right' ? ' swiped-right' : ''}`}
    >
      {/* Action gauche révélée par un glissement vers la droite : périmé */}
      <div className="swipe-actions left">
        <button
          className="qty-btn waste"
          onClick={() => {
            onWaste(rawProduct)
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
        <div className={`product-icon${imageSlug ? ' has-img' : ''}`} style={{ background: col.bg, color: col.fg }}>
          {imageSlug ? (
            <img className="product-img" src={productImageUrl(imageSlug)} alt="" width={54} height={54} loading="lazy" draggable={false} />
          ) : iconKey && hasFoodIcon(iconKey) ? (
            <FoodIcon name={iconKey} />
          ) : (
            <Icon name={categoryIcon(product.category)} width={1.7} />
          )}
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
              onConsumePortion(rawProduct, consumeAmount(product.size!, v, scale.baseUnit))
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
              onRemoveQty(rawProduct, v >= product.quantity ? 'all' : v)
            }}
          />
        )}
      </div>
    </div>
  )
}
