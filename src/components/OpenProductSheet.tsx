import { useMemo, useState } from 'react'
import type { Product } from '../types'
import { useStore } from '../data/store'
import { useToast } from './Toast'
import { addDays, formatLong, toISODate } from '../lib/dates'
import { durationLabel } from '../lib/shelfLife'
import { OPEN_CHOICES, openShelfDays } from '../lib/openShelf'

/** « J'ai ouvert ce produit » : choisit combien de temps il se garde encore et révise la péremption. */
export function OpenProductSheet({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const { openProduct } = useStore()
  const toast = useToast()
  const sugg = useMemo(() => openShelfDays(product.name, product.category), [product])
  const [days, setDays] = useState(sugg.days)
  const [busy, setBusy] = useState(false)
  const choices = [...new Set([...OPEN_CHOICES, sugg.days])].sort((a, b) => a - b)
  const target = toISODate(addDays(new Date(), days))
  const keep = !!product.expiryDate && product.expiryDate < target

  async function confirm() {
    setBusy(true)
    try {
      await openProduct(product, days)
      toast(keep ? 'Marqué ouvert (date actuelle conservée)' : `Marqué ouvert : à consommer avant le ${formatLong(target)}`)
      onDone()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action impossible')
      setBusy(false)
    }
  }

  return (
    <div className="cselect-overlay" onClick={onClose}>
      <div className="cselect-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cselect-handle" />
        <div className="cselect-title">Ouvert : encore bon combien de temps ?</div>
        <p className="open-hint">
          {product.quantity > 1 ? `1 des ${product.quantity} est marqué ouvert, les autres restent fermés. ` : ''}
          {sugg.known ? `Habituel après ouverture : ${durationLabel(sugg.days)}.` : 'Durée estimée par défaut : ajuste si besoin.'}
        </p>
        <div className="open-chips">
          {choices.map((d) => (
            <button key={d} type="button" className={`usual-chip${days === d ? ' on' : ''}`} onClick={() => setDays(d)}>
              {durationLabel(d)}
            </button>
          ))}
        </div>
        <p className="open-result">
          {keep
            ? `Ta date actuelle (${formatLong(product.expiryDate!)}) arrive avant : elle est conservée.`
            : `Nouvelle date : ${formatLong(target)}`}
        </p>
        <div className="btn-row">
          <button type="button" className="action-chip cancel" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-primary" onClick={confirm} disabled={busy}>
            {busy ? '…' : 'Marquer ouvert'}
          </button>
        </div>
      </div>
    </div>
  )
}
