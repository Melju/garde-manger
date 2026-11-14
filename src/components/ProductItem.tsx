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
  sachetsPerBox,
  normalizeBareUnit,
} from '../lib/contenance'
import { Icon, categoryIcon } from './Icon'
import { FoodIcon, hasFoodIcon } from './FoodIcon'
import { productIconKey } from '../lib/productIcon'
import { productImageSlug, chosenIconSlug, productImageUrl } from '../lib/productImage'
import { SwipeWheel } from './SwipeWheel'

interface ProductItemProps {
  product: Product
  onSelect: (product: Product) => void
  onRemoveQty: (product: Product, qty: number | 'all') => void
  onWaste: (product: Product) => void
  /** Mise à jour de la contenance restante (null = paquet terminé). */
  onConsumePortion: (product: Product, newSize: string | null) => void
  /** Retrait de n sachets sur plusieurs boîtes. */
  onConsumeSachets?: (product: Product, n: number) => void
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
  onConsumeSachets,
}: ProductItemProps) {
  // « kg » seul (ancienne saisie) est lu comme « 1 kg ».
  const product = normalizeBareUnit(rawProduct)
  const [swipe, setSwipe] = useState<Swipe>('none')
  const startX = useRef<number | null>(null)
  const moved = useRef(false)

  const status = expiryStatus(product)
  const col = categoryColor(product.category)
  const iconKey = productIconKey(product.name)
  const imageSlug = chosenIconSlug(product.imageUrl) ?? productImageSlug(product.name)
  // Produit au poids/volume si une seule unité en stock avec une contenance continue.
  const byWeight = product.quantity <= 1 && isWeightProduct(product.size)
  const scale = byWeight ? portionScale(product.size) : null
  // Plusieurs boîtes de sachets : on retire des sachets, pas des boîtes.
  const perBox = product.quantity > 1 ? sachetsPerBox(product.size) : null
  const sachetValues = perBox ? Array.from({ length: product.quantity * perBox }, (_, i) => i + 1) : null

  // Glissement progressif : la ligne suit le doigt, puis s'ouvre ou se referme selon la position relâchée.
  const OPEN_LEFT = 216
  const OPEN_RIGHT = 120
  const base = swipe === 'left' ? -OPEN_LEFT : swipe === 'right' ? OPEN_RIGHT : 0
  const [dragX, setDragX] = useState<number | null>(null)
  const startY = useRef(0)
  const captured = useRef(false)

  function clampOffset(v: number) {
    // Léger effet élastique au-delà des limites.
    if (v < -OPEN_LEFT) return -OPEN_LEFT + (v + OPEN_LEFT) * 0.25
    if (v > OPEN_RIGHT) return OPEN_RIGHT + (v - OPEN_RIGHT) * 0.25
    return v
  }
  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    startY.current = e.clientY
    moved.current = false
    captured.current = false
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    if (!captured.current) {
      if (Math.abs(dx) < 8) return
      // Geste plutôt vertical : on laisse défiler la liste.
      if (Math.abs(dy) > Math.abs(dx)) {
        startX.current = null
        return
      }
      captured.current = true
      moved.current = true
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    setDragX(clampOffset(base + dx))
  }
  function onPointerUp() {
    const x = dragX
    startX.current = null
    if (captured.current && x !== null) {
      // Seuil : à partir de 35 % de l'ouverture, la ligne s'ouvre ; sinon elle se referme.
      if (x < -OPEN_LEFT * 0.35) setSwipe('left')
      else if (x > OPEN_RIGHT * 0.35) setSwipe('right')
      else setSwipe('none')
    }
    captured.current = false
    setDragX(null)
    // Laisse le clic « fantôme » de fin de geste être ignoré, puis réarme.
    setTimeout(() => {
      moved.current = false
    }, 0)
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
        className={`product-item${dragX !== null ? ' dragging' : ''}`}
        style={dragX !== null ? { transform: `translateX(${dragX}px)` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
            tickFormat={scale.baseUnit === 'sachet' ? (v) => String(v) : undefined}
            onConfirm={(v) => {
              setSwipe('none')
              if (v <= 0) return
              onConsumePortion(rawProduct, consumeAmount(product.size!, v, scale.baseUnit))
            }}
          />
        ) : sachetValues && onConsumeSachets ? (
          <SwipeWheel
            values={sachetValues}
            itemW={48}
            initialIndex={0}
            isMajor={() => true}
            format={(v) => `−${v} sachet${v > 1 ? 's' : ''}`}
            tickFormat={(v) => String(v)}
            onConfirm={(v) => {
              setSwipe('none')
              onConsumeSachets(rawProduct, v)
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
