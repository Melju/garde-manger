import { useState } from 'react'
import { Icon, categoryIcon } from './Icon'
import { DatePicker } from './DatePicker'
import { DateScanner } from './DateScanner'
import { categoryColor } from '../lib/categoryColors'
import { productImageUrl } from '../lib/productImage'
import { estimatedExpiryISO } from '../lib/shelfLife'
import { defaultConservation, isNonFood, type ShoppingItem } from '../types'

function estimate(it: ShoppingItem): string {
  return isNonFood(it.category) ? '' : estimatedExpiryISO(it.name, defaultConservation(it.category), it.category) || ''
}

/**
 * Le panier en drawer : étape 1, ce qui a été pris (quantités ajustables, remettre dans la liste) ;
 * étape 2, les dates estimées à corriger ou scanner avant de ranger au stock.
 */
export function CartSheet({
  items,
  imageOf,
  qtyLabel,
  initialStep = 'cart',
  onStep,
  onBack,
  onClear,
  onConfirm,
  onClose,
}: {
  items: ShoppingItem[]
  imageOf: (name: string) => string | null
  qtyLabel: (q: number, unit?: string) => string
  initialStep?: 'cart' | 'dates'
  onStep: (it: ShoppingItem, dir: 1 | -1) => void
  onBack: (it: ShoppingItem) => void
  onClear: () => void
  onConfirm: (dates: Record<string, string>) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<'cart' | 'dates'>(initialStep)
  const [dates, setDates] = useState<Record<string, string>>({})
  const [scanning, setScanning] = useState<string | null>(null)
  const n = items.length
  const plural = n > 1 ? 's' : ''

  function thumb(it: ShoppingItem) {
    const col = categoryColor(it.category)
    const slug = imageOf(it.name)
    return (
      <span className="shop-thumb" style={{ background: col.bg, color: col.fg }}>
        {slug ? <img src={productImageUrl(slug)} alt="" loading="lazy" draggable={false} /> : <Icon name={categoryIcon(it.category)} width={1.8} />}
      </span>
    )
  }
  const dateOf = (it: ShoppingItem) => (it.id in dates ? dates[it.id] : estimate(it))

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer cart-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-head cart-sheet-head">
          {step === 'dates' && (
            <button type="button" className="icon-btn" onClick={() => setStep('cart')} aria-label="Retour au panier">
              <Icon name="back" />
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div className="drawer-title">{step === 'cart' ? 'Mon panier' : 'Ranger au stock'}</div>
            <div className="drawer-sub">
              {step === 'cart'
                ? n
                  ? `${n} article${plural} pris · ajuste les quantités si besoin`
                  : 'Le panier est vide'
                : 'Dates estimées : corrige ou scanne celles qui comptent'}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </div>

        {step === 'cart' ? (
          <>
            <div className="drawer-body cart-sheet-list">
              {n === 0 && (
                <div className="cart-empty">
                  <Icon name="cart" />
                  <p>Coche un article de la liste pour le mettre ici.</p>
                </div>
              )}
              {items.map((it) => (
                <div className="cart-row" key={it.id}>
                  {thumb(it)}
                  <span className="cart-name">{it.name}</span>
                  <div className="shop-step">
                    <button aria-label={`Moins de ${it.name}`} onClick={() => onStep(it, -1)}>
                      −
                    </button>
                    <span className="shop-step-val">{qtyLabel(it.quantity, it.unit)}</span>
                    <button aria-label={`Plus de ${it.name}`} onClick={() => onStep(it, 1)}>
                      +
                    </button>
                  </div>
                  <button type="button" className="cart-back" onClick={() => onBack(it)} aria-label={`Remettre ${it.name} dans la liste`} title="Remettre dans la liste">
                    <Icon name="undo" />
                  </button>
                </div>
              ))}
            </div>
            {n > 0 && (
              <div className="cart-sheet-foot">
                <button className="btn-primary cart-stow" onClick={() => setStep('dates')}>
                  <Icon name="box" />
                  Ranger {n} article{plural} au stock
                </button>
                <button type="button" className="cart-clear" onClick={onClear}>
                  Vider le panier sans ranger
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="drawer-body cart-sheet-list">
              {items.map((it) => (
                <div className="stow-row" key={it.id}>
                  {thumb(it)}
                  <div className="stow-name">
                    {it.name}
                    <small>{qtyLabel(it.quantity, it.unit)}</small>
                  </div>
                  {isNonFood(it.category) ? (
                    <span className="stow-nodate">sans date</span>
                  ) : (
                    <div className="stow-date">
                      <DatePicker value={dateOf(it)} onChange={(v) => setDates((d) => ({ ...d, [it.id]: v }))} />
                      <button type="button" className="icon-btn stow-scan" onClick={() => setScanning(it.id)} aria-label={`Scanner la date de ${it.name}`}>
                        <Icon name="scan" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="cart-sheet-foot">
              <button
                className="btn-primary cart-stow"
                onClick={() => onConfirm(Object.fromEntries(items.map((it) => [it.id, dateOf(it)])))}
              >
                <Icon name="check" />
                Ranger {n} article{plural}
              </button>
            </div>
          </>
        )}
      </div>
      {scanning && (
        <DateScanner
          onResult={(r) => {
            setDates((d) => ({ ...d, [scanning]: r.date }))
            setScanning(null)
          }}
          onClose={() => setScanning(null)}
        />
      )}
    </div>
  )
}
