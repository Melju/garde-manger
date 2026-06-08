import { useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { ReviewItems } from '../components/ReviewItems'
import type { ReceiptItem } from '../types'

interface TicketScanScreenProps {
  onClose: () => void
  onAdded: () => void
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
  const { scanReceipt } = useStore()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<ReceiptItem[] | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    toast('Lecture du ticket…')
    try {
      const { data, mediaType } = await downscale(file)
      const found = await scanReceipt(data, mediaType)
      if (found.length === 0) toast('Aucun article détecté')
      setItems(found)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Analyse impossible')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="screen-fade">
      <PageHeader title="Scanner un ticket" onBack={onClose} />

      {!items ? (
        <div className="ticket-intro">
          <div className="ticket-illus">
            <Icon name="receipt" />
          </div>
          <p>Prends en photo (ou choisis) ton ticket de caisse. Claude en extrait les articles, tu valides, et ils sont ajoutés au stock.</p>
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
      ) : items.length === 0 ? (
        <div className="form-section">
          <p style={{ color: 'var(--muted)' }}>Aucun article détecté sur cette photo.</p>
          <button className="btn-secondary" onClick={() => setItems(null)}>Réessayer</button>
        </div>
      ) : (
        <ReviewItems items={items} onDone={onAdded} onRetry={() => setItems(null)} />
      )}
    </div>
  )
}
