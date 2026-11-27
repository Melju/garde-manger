import { Select } from './Select'
import { addStore, getCurrentStore, getStores, recordPurchases } from '../lib/stores'
import { recordPrices } from '../lib/prices'
import { normalize } from '../lib/productIcon'
import type { KnownProduct } from '../lib/knownProducts'
import { guessDateType } from '../lib/shelfLife'
import { extractPackSize, normalizeSize } from '../lib/packSize'
import { useState } from 'react'
import { linkedProduct } from '../lib/recipesLib'
import { useStore } from '../data/store'
import { useToast } from './Toast'
import { Icon } from './Icon'
import { CATEGORIES, defaultConservation, type Category, type ReceiptItem } from '../types'

interface Row extends Omit<ReceiptItem, 'size' | 'known'> {
  include: boolean
  /** Contenance d'un paquet, modifiable (« 500 g », « 12 sachets »). */
  size: string
  /** Produit déjà ajouté pendant les courses (même nom, récemment) : on ne le duplique pas. */
  matchId?: string
  matchName?: string
  /** Libellé lu sur le ticket (pour revenir en arrière si la suggestion ne convient pas). */
  ticketName: string
  ticketCategory: Category
  /** Produit déjà connu reconnu par l'IA, et s'il est appliqué. */
  known?: KnownProduct
  useKnown: boolean
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
  /** Ticket : produits déjà connus (l'IA a renvoyé leur index dans `items[].known`). */
  known?: KnownProduct[]
  /** Demander dans quel magasin les courses ont été faites. */
  askStore?: boolean
  /** Enseigne lue sur le ticket, proposée par défaut. */
  detectedStore?: string | null
}

/** Liste éditable d'articles détectés → ajout au stock. Partagée ticket / lot. */
export function ReviewItems({ items, onDone, onRetry, matchRecent, known = [], askStore, detectedStore }: ReviewItemsProps) {
  const { addProduct, updateProduct, products } = useStore()
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>(() => {
    const recent = products.filter((p) => Date.now() - new Date(p.createdAt).getTime() < RECENT_MS)
    return items.map((it) => {
      const k = it.known != null ? known[it.known] : undefined
      const m = matchRecent ? linkedProduct({ name: k?.name ?? it.name }, recent) : undefined
      const ticketSize = normalizeSize(it.size) ?? extractPackSize(it.name) ?? ''
      return {
        ...it,
        ticketName: it.name,
        ticketCategory: it.category,
        known: k,
        useKnown: !!k,
        name: k?.name ?? it.name,
        category: k?.category ?? it.category,
        include: !m,
        size: k ? normalizeSize(k.size) ?? ticketSize : ticketSize,
        matchId: m?.id,
        matchName: m ? [m.brand, m.name].filter(Boolean).join(' ') : undefined,
      }
    })
  })
  const [busy, setBusy] = useState(false)
  // Magasin : l'enseigne lue sur le ticket si elle existe, sinon le magasin courant.
  const storeChoices = (() => {
    const list = getStores()
    const det = detectedStore ? list.find((x) => normalize(x) === normalize(detectedStore)) ?? detectedStore : null
    const cur = getCurrentStore()
    return [...new Set([det, cur, ...list].filter((x): x is string => !!x))].slice(0, 5)
  })()
  const [shop, setShop] = useState<string>(() => storeChoices[0] ?? '')
  const [otherShop, setOtherShop] = useState(false)

  function applyKnown(i: number, on: boolean) {
    setRows((r) =>
      r.map((row, idx) =>
        idx !== i || !row.known
          ? row
          : on
            ? { ...row, useKnown: true, name: row.known.name, category: row.known.category, size: normalizeSize(row.known.size) ?? row.size }
            : { ...row, useKnown: false, name: row.ticketName, category: row.ticketCategory },
      ),
    )
  }

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
        // Produit reconnu : on reprend sa fiche (marque, emplacement, conservation, illustration…).
        const k = it.useKnown ? it.known : undefined
        const conservation = k?.conservation ?? defaultConservation(it.category)
        await addProduct({
          name: it.name,
          category: it.category,
          conservation,
          // quantité = nombre de paquets achetés ; contenance = celle d'UN paquet.
          quantity: it.quantity,
          size: normalizeSize(it.size),
          dateType: k?.dateType ?? guessDateType(it.name, conservation, it.category).type,
          price: it.price ?? undefined,
          ...(k ? { brand: k.brand, location: k.location, imageUrl: k.imageUrl, barcode: k.barcode } : {}),
        })
      }
      const store = askStore ? shop.trim() : getCurrentStore()
      if (store) {
        if (askStore) addStore(store)
        recordPurchases(store, selected.map((it) => ({ name: it.name, category: it.category, unit: it.unit, quantity: it.quantity })))
        if (askStore)
          void recordPrices(rows.filter((r) => r.price != null).map((r) => ({ name: r.name, store, price: r.price, source: 'ticket' })))
      }
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
      {askStore && (
        <div className="form-section ticket-store">
          <label className="form-label">Magasin</label>
          <div className="ticket-store-chips">
            {storeChoices.map((x) => (
              <button
                type="button"
                key={x}
                className={`usual-chip${!otherShop && shop === x ? ' on' : ''}`}
                onClick={() => {
                  setOtherShop(false)
                  setShop(x)
                }}
              >
                {x}
              </button>
            ))}
            <button
              type="button"
              className={`usual-chip${otherShop ? ' on' : ''}`}
              onClick={() => {
                setOtherShop(true)
                setShop('')
              }}
            >
              Autre…
            </button>
          </div>
          {otherShop && (
            <input className="form-input" style={{ marginTop: 8 }} autoFocus placeholder="Nom du magasin" value={shop} onChange={(e) => setShop(e.target.value)} />
          )}
        </div>
      )}
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
              {row.known && (
                <div className={`ticket-known${row.useKnown ? ' on' : ''}`}>
                  {row.useKnown ? (
                    <>
                      <Icon name="check" width={2.5} />
                      <span>
                        Déjà acheté{row.known.brand ? ` · ${row.known.brand}` : ''}
                        {row.known.location ? ` · ${row.known.location}` : ''}
                      </span>
                      <button type="button" onClick={() => applyKnown(i, false)}>
                        Nom du ticket
                      </button>
                    </>
                  ) : (
                    <button type="button" className="ticket-known-suggest" onClick={() => applyKnown(i, true)}>
                      Suggestion : {[row.known.name, row.known.brand].filter(Boolean).join(' · ')}
                    </button>
                  )}
                </div>
              )}
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
