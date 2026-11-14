import { Select } from './Select'
import { getCurrentStore, recordPurchases } from '../lib/stores'
import { guessDateType } from '../lib/shelfLife'
import { extractPackSize, normalizeSize } from '../lib/packSize'
import { useState } from 'react'
import { linkedProduct } from '../lib/recipesLib'
import { useStore } from '../data/store'
import { useToast } from './Toast'
import { Icon } from './Icon'
import { CATEGORIES, defaultConservation, type Category, type ReceiptItem } from '../types'

interface Row extends Omit<ReceiptItem, 'size'> {
  include: boolean
  /** Contenance d'un paquet, modifiable (« 500 g », « 12 sachets »). */
  size: string
  /** Produit déjà ajouté pendant les courses (même nom, récemment) : on ne le duplique pas. */
  matchId?: string
  matchName?: string
}

/** Fenêtre pendant laquelle un produit est considéré comme « déjà ajouté pendant les courses ». */
const RECENT_MS = 48 * 3600 * 1000

interface ReviewItemsProps {
  items: ReceiptItem[]
  /** Appelé une fois les produits ajoutés. */
  onDone: () => void
  /** Recommencer (revenir à l'étape précédente). */
  onRetry: () => void
  /** Ticket de caisse : ne pas dupliquer les produits déjà ajoutés pendant les courses. */
  matchRecent?: boolean
}

/** Liste éditable d'articles détectés → ajout au stock. Partagée ticket / lot. */
export function ReviewItems({ items, onDone, onRetry, matchRecent }: ReviewItemsProps) {
  const { addProduct, updateProduct, products } = useStore()
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>(() => {
    const recent = products.filter((p) => Date.now() - new Date(p.createdAt).getTime() < RECENT_MS)
    return items.map((it) => {
      const m = matchRecent ? linkedProduct({ name: it.name }, recent) : undefined
      return {
        ...it,
        include: !m,
        size: normalizeSize(it.size) ?? extractPackSize(it.name) ?? '',
        matchId: m?.id,
        matchName: m ? [m.brand, m.name].filter(Boolean).join(' ') : undefined,
      }
    })
  })
  const [busy, setBusy] = useState(false)

  const selected = rows.filter((r) => r.include)
  // Déjà ajoutés pendant les courses : on met seulement leur prix à jour.
  const priceUpdates = rows.filter((r) => !r.include && r.matchId && r.price != null)

  function patch(i: number, p: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...p } : row)))
  }

  async function addAll() {
    if (selected.length === 0 && priceUpdates.length === 0) return
    setBusy(true)
    try {
      for (const u of priceUpdates) await updateProduct(u.matchId!, { price: u.price! })
      for (const it of selected) {
        await addProduct({
          name: it.name,
          category: it.category,
          conservation: defaultConservation(it.category),
          // quantité = nombre de paquets achetés ; contenance = celle d'UN paquet.
          quantity: it.quantity,
          size: normalizeSize(it.size),
          dateType: guessDateType(it.name, defaultConservation(it.category), it.category).type,
          price: it.price ?? undefined,
        })
      }
      const store = getCurrentStore()
      if (store) recordPurchases(store, selected.map((it) => ({ name: it.name, category: it.category, unit: it.unit, quantity: it.quantity })))
      const parts: string[] = []
      if (selected.length) parts.push(`${selected.length} produit${selected.length > 1 ? 's' : ''} ajouté${selected.length > 1 ? 's' : ''}`)
      if (priceUpdates.length) parts.push(`${priceUpdates.length} prix mis à jour`)
      toast(parts.join(' · '))
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
          {selected.length} à ajouter{priceUpdates.length ? ` · ${priceUpdates.length} déjà dans le stock (prix mis à jour)` : ''} · coche ou décoche pour ajuster.
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
              {row.matchId && (
                <div className="ticket-match">
                  {row.include ? 'Sera ajouté en plus de' : 'Déjà dans le stock :'} {row.matchName}
                </div>
              )}
              <input
                className="form-input"
                value={row.name}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <div className="ticket-sub">
                <Select
                  className="form-select"
                  ariaLabel="Catégorie"
                  value={row.category}
                  onChange={(v) => patch(i, { category: v as Category })}
                  options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
                />
                <div className="qty-stepper small">
                  <button type="button" onClick={() => patch(i, { quantity: Math.max(1, row.quantity - 1) })}>−</button>
                  <span>{row.quantity}</span>
                  <button type="button" onClick={() => patch(i, { quantity: row.quantity + 1 })}>+</button>
                </div>
                {row.price != null && <span className="ticket-price">{row.price.toFixed(2)}€</span>}
              </div>
              <input
                className="form-input ticket-size"
                placeholder="Contenance d'un paquet (500 g, 12 sachets…)"
                value={row.size}
                onChange={(e) => patch(i, { size: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="btn-row" style={{ margin: '16px 0' }}>
        <button className="btn-secondary" onClick={onRetry} disabled={busy}>Reprendre</button>
        <button className="btn-primary" onClick={addAll} disabled={busy || (selected.length === 0 && priceUpdates.length === 0)}>
          {busy ? 'Ajout…' : selected.length ? `Ajouter (${selected.length})` : 'Mettre à jour les prix'}
        </button>
      </div>
    </>
  )
}
