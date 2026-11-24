import { useState } from 'react'
import { Icon, categoryIcon } from './Icon'
import { DatePicker } from './DatePicker'
import { DateScanner } from './DateScanner'
import { categoryColor } from '../lib/categoryColors'
import { productImageUrl } from '../lib/productImage'
import { estimatedExpiryISO } from '../lib/shelfLife'
import { defaultConservation, isNonFood, type ShoppingItem } from '../types'

/**
 * Rangement du panier dans le stock : chaque article avec sa date estimée,
 * que l'on peut corriger ou scanner sur les produits qui comptent (viande, frais…).
 */
export function StowSheet({
  items,
  imageOf,
  onConfirm,
  onClose,
}: {
  items: ShoppingItem[]
  imageOf: (name: string) => string | null
  onConfirm: (dates: Record<string, string>) => void
  onClose: () => void
}) {
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((it) => [it.id, isNonFood(it.category) ? '' : estimatedExpiryISO(it.name, defaultConservation(it.category), it.category) || '']),
    ),
  )
  const [scanning, setScanning] = useState<string | null>(null)

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer stow-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-head">
          <div>
            <div className="drawer-title">Ranger au stock</div>
            <div className="drawer-sub">Dates estimées : corrige ou scanne celles qui comptent.</div>
          </div>
        </div>
        <div className="drawer-body stow-list">
          {items.map((it) => {
            const col = categoryColor(it.category)
            const slug = imageOf(it.name)
            const nonFood = isNonFood(it.category)
            return (
              <div className="stow-row" key={it.id}>
                <span className="shop-thumb" style={{ background: col.bg, color: col.fg }}>
                  {slug ? <img src={productImageUrl(slug)} alt="" loading="lazy" /> : <Icon name={categoryIcon(it.category)} width={1.8} />}
                </span>
                <div className="stow-name">{it.name}</div>
                {nonFood ? (
                  <span className="stow-nodate">sans date</span>
                ) : (
                  <div className="stow-date">
                    <DatePicker value={dates[it.id] || ''} onChange={(v) => setDates((d) => ({ ...d, [it.id]: v }))} />
                    <button type="button" className="icon-btn stow-scan" onClick={() => setScanning(it.id)} aria-label={`Scanner la date de ${it.name}`}>
                      <Icon name="scan" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="btn-row stow-actions">
          <button className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button className="btn-primary" onClick={() => onConfirm(dates)}>
            Ranger {items.length} article{items.length > 1 ? 's' : ''}
          </button>
        </div>
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
