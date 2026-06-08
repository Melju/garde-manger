import { useRef, useState } from 'react'
import type { Product } from '../types'
import { categoryLabel } from '../types'
import { expiryLabel, expiryStatus } from '../lib/expiry'
import { categoryColor } from '../lib/categoryColors'
import {
  isWeightProduct,
  consumeFraction,
  consumeAmount,
  weightInfo,
  portionValues,
  formatContenance,
} from '../lib/contenance'
import { Icon } from './Icon'
import { WheelSheet } from './WheelSheet'

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
 * - glisser à gauche → retirer des quantités (consommé)
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
  const [sheet, setSheet] = useState<'none' | 'weight' | 'count'>('none')
  const startX = useRef<number | null>(null)
  const moved = useRef(false)

  const status = expiryStatus(product)
  const col = categoryColor(product.category)
  // Produit au poids/volume si une seule unité en stock avec une contenance continue.
  const byWeight = product.quantity <= 1 && isWeightProduct(product.size)

  function fraction(f: number) {
    onConsumePortion(product, consumeFraction(product.size!, f))
    setSwipe('none')
  }
  function openSheet(kind: 'weight' | 'count') {
    setSheet(kind)
    setSwipe('none')
  }

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
          {byWeight ? (
            <>
              <button className="qty-btn" onClick={() => fraction(0.25)}>
                ¼
              </button>
              <button className="qty-btn" onClick={() => fraction(0.5)}>
                ½
              </button>
              <button className="qty-btn" onClick={() => openSheet('weight')}>
                <Icon name="pencil" width={1.2} />
                <span>saisir</span>
              </button>
              <button
                className="qty-btn delete-all"
                onClick={() => {
                  onConsumePortion(product, null)
                  setSwipe('none')
                }}
              >
                Tout<span>fini</span>
              </button>
            </>
          ) : (
            <>
              {[1, 2].map((n) => (
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
                className="qty-btn"
                disabled={product.quantity < 3}
                onClick={() => openSheet('count')}
              >
                <Icon name="pencil" width={1.2} />
                <span>saisir</span>
              </button>
              <button
                className="qty-btn delete-all"
                onClick={() => {
                  onRemoveQty(product, 'all')
                  setSwipe('none')
                }}
              >
                Tout<span>suppr.</span>
              </button>
            </>
          )}
        </div>
      </div>

      {sheet === 'weight' && (() => {
        const wi = weightInfo(product.size)
        const values = portionValues(product.size)
        if (!wi || values.length === 0) return null
        return (
          <WheelSheet
            title="Quantité utilisée"
            subtitle={`${product.name} · ${product.size} en stock`}
            values={values}
            format={(v) => (v === 0 ? '0' : formatContenance(v, wi.baseUnit))}
            initialIndex={0}
            onCancel={() => setSheet('none')}
            onConfirm={(v) => {
              setSheet('none')
              if (v <= 0) return
              onConsumePortion(product, consumeAmount(product.size!, v, wi.baseUnit))
            }}
          />
        )
      })()}

      {sheet === 'count' && (
        <WheelSheet
          title="Combien en retirer ?"
          subtitle={`${product.name} · ×${product.quantity} en stock`}
          values={Array.from({ length: product.quantity }, (_, i) => i + 1)}
          format={(v) => `${v}`}
          initialIndex={0}
          onCancel={() => setSheet('none')}
          onConfirm={(v) => {
            setSheet('none')
            onRemoveQty(product, v >= product.quantity ? 'all' : v)
          }}
        />
      )}
    </div>
  )
}
