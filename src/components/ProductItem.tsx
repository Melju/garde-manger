import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '../types'
import { categoryLabel, isNonFood } from '../types'
import { expiryLabel, expiryStatus, isFrozen } from '../lib/expiry'
import { OpenProductSheet } from './OpenProductSheet'
import { categoryColor } from '../lib/categoryColors'
import {
  isWeightProduct,
  consumeAmount,
  portionScale,
  formatContenance,
  stockLabel,
  countPerPack,
  countLabel,
  normalizeBareUnit,
} from '../lib/contenance'
import { Icon, categoryIcon } from './Icon'
import { FoodIcon, hasFoodIcon } from './FoodIcon'
import { productIconKey } from '../lib/productIcon'
import { productImageSlug, chosenIconSlug, productImageUrl } from '../lib/productImage'
import { SwipeWheel } from './SwipeWheel'
import { ConsumeSheet } from './ConsumeSheet'

/** Souris / pavé tactile : boutons d'action au lieu des glissements. */
const finePointer = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

interface ProductItemProps {
  product: Product
  /** Fiche complète (tous les exemplaires) quand la ligne n'en représente qu'un seul. */
  detail?: Product
  /** Position dans un groupe de lignes identiques (rassemblées visuellement). */
  groupPos?: 'first' | 'middle' | 'last'
  /** Nombre de lignes identiques rassemblées (affiché sur la ligne de tête). */
  groupCount?: number
  /** Pas de glissement (affichage en tuiles sur PC). */
  noSwipe?: boolean
  groupOpen?: boolean
  onToggleGroup?: () => void
  onSelect: (product: Product) => void
  onRemoveQty: (product: Product, qty: number | 'all') => void
  onWaste: (product: Product) => void
  /** Mise à jour de la contenance restante (null = paquet terminé). */
  onConsumePortion: (product: Product, newSize: string | null) => void
  /** Retrait de n sachets sur plusieurs boîtes. */
  onConsumeSachets?: (product: Product, n: number) => void
  /** Joue une fois l'animation d'indice de glissement (première visite). */
  demo?: boolean
  onDemoDone?: () => void
}

type Swipe = 'none' | 'left' | 'right'

/**
 * Élément d'inventaire avec gestes :
 * - glisser à gauche → molette pour retirer (poids ou nombre)
 * - glisser à droite → marquer périmé (jeté)
 */
export function ProductItem({
  product: rawProduct,
  detail,
  groupPos,
  groupCount,
  noSwipe,
  groupOpen,
  onToggleGroup,
  onSelect,
  onRemoveQty,
  onWaste,
  onConsumePortion,
  onConsumeSachets,
  demo,
  onDemoDone,
}: ProductItemProps) {
  // « kg » seul (ancienne saisie) est lu comme « 1 kg ».
  const product = normalizeBareUnit(rawProduct)
  // Boutons d'action : à la souris, ou en tuiles (tablette tactile comprise).
  const mouse = finePointer || Boolean(noSwipe)
  const swipeOff = noSwipe || mouse
  const [consuming, setConsuming] = useState(false)
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
  const packInfo = product.quantity > 1 ? countPerPack(product.size) : null
  const sachetValues = packInfo ? Array.from({ length: product.quantity * packInfo.per }, (_, i) => i + 1) : null

  // Glissement progressif : la ligne suit le doigt, puis s'ouvre ou se referme selon la position relâchée.
  const OPEN_LEFT = 216
  // Glissement à droite : « Ouvert » (si applicable) + « Périmé ».
  const canOpen = !product.openedAt && !isNonFood(product.category) && !isFrozen(product)
  const [opening, setOpening] = useState(false)
  const OPEN_RIGHT = canOpen ? 240 : 120
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
    if (swipeOff) return
    if (demo) onDemoDone?.()
    startX.current = e.clientX
    startY.current = e.clientY
    moved.current = false
    captured.current = false
  }
  function onPointerMove(e: React.PointerEvent) {
    if (swipeOff) return
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
    if (groupCount && groupCount > 1 && !groupOpen && onToggleGroup) {
      onToggleGroup()
      return
    }
    onSelect(detail ?? rawProduct)
  }

  const weightLabel = stockLabel(product)
  // Au poids / volume, la quantité est affichée à droite (« 700 g / 1 kg ») : pas de doublon dans la ligne de détail.
  const meta = [product.location?.trim() || categoryLabel(product.category), weightLabel ? null : product.size, product.openedAt ? 'Ouvert' : null].filter(Boolean).join(' · ')
  const qtyLabel =
    weightLabel ?? (product.unit ? `×${product.quantity} ${product.unit}` : `×${product.quantity}`)

  return (
    <div
      className={`swipe-wrapper${status === 'expired' ? ' is-expired' : ''}${mouse ? ' mouse' : ''}${groupPos ? ` grp grp-${groupPos}` : ''}${dragX !== null || demo ? ' is-active' : ''}${swipe === 'left' ? ' swiped-left' : swipe === 'right' ? ' swiped-right' : ''}`}
      style={{ ['--open-right' as string]: `${OPEN_RIGHT}px` }}
    >
      {/* Action gauche révélée par un glissement vers la droite : périmé */}
      <div className="swipe-actions left">
        {canOpen && (
          <button className="qty-btn open" onClick={() => setOpening(true)}>
            Ouvert<span>péremption revue</span>
          </button>
        )}
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
        className={`product-item${dragX !== null ? ' dragging' : ''}${demo && dragX === null ? ' swipe-demo' : ''}`}
        onAnimationEnd={() => demo && onDemoDone?.()}
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
          {product.brand && <div className="product-brand">{product.brand}</div>}
          <div className="product-meta">{meta}</div>
          {groupCount && groupCount > 1 && (
            <button
              type="button"
              className={`group-chip${groupOpen ? ' open' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onToggleGroup?.()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-expanded={!!groupOpen}
            >
              {groupOpen ? `Replier (${groupCount})` : `${groupCount} identiques`}
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
        <div className="product-right">
          <div className="product-qty">{qtyLabel}</div>
          <span className={`status-tag ${status}`}>{expiryLabel(product)}</span>
        </div>
        {mouse && (
          <div className={`pi-actions${canOpen ? '' : ' two'}`} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <button className="pi-act consume" title="Indiquer une quantité consommée" onClick={() => setConsuming(true)}>
              Consommé
            </button>
            {canOpen && (
              <button className="pi-act" title="Marquer comme ouvert" onClick={() => setOpening(true)}>
                Ouvert
              </button>
            )}
            <button className="pi-act waste" title="Jeté car périmé" onClick={() => onWaste(rawProduct)}>
              Périmé
            </button>
          </div>
        )}
      </div>

      {consuming && (
        <ConsumeSheet
          product={product}
          onClose={() => setConsuming(false)}
          onRemoveQty={(_, q) => onRemoveQty(rawProduct, q)}
          onConsumePortion={(_, sz) => onConsumePortion(rawProduct, sz)}
          onConsumeSachets={onConsumeSachets ? (_, k) => onConsumeSachets(rawProduct, k) : undefined}
        />
      )}

      {opening &&
        createPortal(
          <OpenProductSheet
            product={detail ?? rawProduct}
            onClose={() => setOpening(false)}
            onDone={() => {
              setOpening(false)
              setSwipe('none')
            }}
          />,
          document.body,
        )}

      {/* Action droite révélée par un glissement vers la gauche : molette de retrait */}
      <div className="swipe-actions right">
        {byWeight && scale ? (
          <SwipeWheel
            values={scale.values}
            itemW={26}
            initialIndex={1}
            isMajor={(v) => v % scale.major === 0 || v === scale.values[scale.values.length - 1]}
            format={(v) => (v === 0 ? '0' : formatContenance(v, scale.baseUnit))}
            tickFormat={scale.count ? (v) => String(v) : undefined}
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
            format={(v) => `−${countLabel(v, packInfo!.unit)}`}
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
