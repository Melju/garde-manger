import { useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { CATEGORIES, defaultConservation, type Category, type ReceiptItem } from '../types'

interface TicketScanScreenProps {
  onClose: () => void
  onAdded: () => void
}

interface Row extends ReceiptItem {
  include: boolean
}

/** Réduit une image à max 1280px de large en JPEG (limite payload + coût). */
function downscale(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 1280
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        resolve({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function TicketScanScreen({ onClose, onAdded }: TicketScanScreenProps) {
  const { scanReceipt, addProduct } = useStore()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    toast('Lecture du ticket…')
    try {
      const { data, mediaType } = await downscale(file)
      const items = await scanReceipt(data, mediaType)
      if (items.length === 0) {
        toast('Aucun article détecté')
        setRows([])
      } else {
        setRows(items.map((it) => ({ ...it, include: true })))
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Analyse impossible')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function patch(i: number, p: Partial<Row>) {
    setRows((r) => (r ? r.map((row, idx) => (idx === i ? { ...row, ...p } : row)) : r))
  }

  const selected = rows?.filter((r) => r.include) ?? []

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
      onAdded()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ajout impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen-fade">
      <PageHeader title="Scanner un ticket" onBack={onClose} />

      {!rows ? (
        <div className="ticket-intro">
          <div className="ticket-illus">
            <Icon name="receipt" />
          </div>
          <p>Prends en photo (ou choisis) la photo de ton ticket de caisse. Claude en extrait les articles, tu valides, et ils sont ajoutés au stock.</p>
          <button className="btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Analyse en cours…' : 'Prendre / choisir une photo'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={onPick}
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="form-section">
          <p style={{ color: 'var(--muted)' }}>Aucun article détecté sur cette photo.</p>
          <button className="btn-secondary" onClick={() => setRows(null)}>Réessayer</button>
        </div>
      ) : (
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
            <button className="btn-secondary" onClick={() => setRows(null)} disabled={busy}>Reprendre</button>
            <button className="btn-primary" onClick={addAll} disabled={busy || selected.length === 0}>
              {busy ? 'Ajout…' : `Ajouter (${selected.length})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
