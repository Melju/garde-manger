import { useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from './Toast'
import { Icon } from './Icon'
import { CATEGORIES, defaultConservation, type Category, type ReceiptItem } from '../types'

interface Row extends ReceiptItem {
  include: boolean
}

interface ReviewItemsProps {
  items: ReceiptItem[]
  /** Appelé une fois les produits ajoutés. */
  onDone: () => void
  /** Recommencer (revenir à l'étape précédente). */
  onRetry: () => void
}

/** Liste éditable d'articles détectés → ajout au stock. Partagée ticket / lot. */
export function ReviewItems({ items, onDone, onRetry }: ReviewItemsProps) {
  const { addProduct } = useStore()
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>(items.map((it) => ({ ...it, include: true })))
  const [busy, setBusy] = useState(false)

  const selected = rows.filter((r) => r.include)

  function patch(i: number, p: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...p } : row)))
  }

  async function addAll() {
    if (selected.length === 0) return
    setBusy(true)
    try {
      for (const it of selected) {
        await addProduct({
          name: it.name,
          category: it.category,
          conservation: defaultConservation(it.category),
          quantity: it.quantity,
          size: it.unit ? `${it.unit}` : undefined,
          dateType: 'dlc',
          price: it.price ?? undefined,
        })
      }
      toast(`${selected.length} produit${selected.length > 1 ? 's' : ''} ajouté${selected.length > 1 ? 's' : ''}`)
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ajout impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="form-section" style={{ paddingBottom: 0 }}>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          {selected.length} sélectionné{selected.length > 1 ? 's' : ''} · décoche ce que tu ne veux pas, ajuste si besoin.
        </p>
      </div>
      <div className="ticket-list">
        {rows.map((row, i) => (
          <div className={`ticket-item${row.include ? '' : ' off'}`} key={i}>
            <button
              className={`check-box${row.include ? ' on' : ''}`}
              onClick={() => patch(i, { include: !row.include })}
              aria-label="Inclure"
            >
              {row.include && <Icon name="check" width={3} />}
            </button>
            <div className="ticket-fields">
              <input
                className="form-input"
                value={row.name}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <div className="ticket-sub">
                <select
                  className="form-select"
                  value={row.category}
                  onChange={(e) => patch(i, { category: e.target.value as Category })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <div className="qty-stepper small">
                  <button type="button" onClick={() => patch(i, { quantity: Math.max(1, row.quantity - 1) })}>−</button>
                  <span>{row.quantity}</span>
                  <button type="button" onClick={() => patch(i, { quantity: row.quantity + 1 })}>+</button>
                </div>
                {row.price != null && <span className="ticket-price">{row.price.toFixed(2)}€</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="btn-row" style={{ margin: '16px 20px' }}>
        <button className="btn-secondary" onClick={onRetry} disabled={busy}>Reprendre</button>
        <button className="btn-primary" onClick={addAll} disabled={busy || selected.length === 0}>
          {busy ? 'Ajout…' : `Ajouter (${selected.length})`}
        </button>
      </div>
    </>
  )
}
