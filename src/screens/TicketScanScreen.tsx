import { useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { ReviewItems } from '../components/ReviewItems'
import type { ReceiptItem } from '../types'
import { buildKnownCatalog, knownLabel } from '../lib/knownProducts'

interface TicketScanScreenProps {
  onClose: () => void
  onAdded: () => void
  /** « file » : ticket électronique (PDF ou capture), sans ouvrir l'appareil photo. */
  mode?: 'photo' | 'file'
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

/** PDF lu tel quel (base64), limité pour rester sous la taille d'envoi. */
function readPdf(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    if (file.size > 8 * 1024 * 1024) return reject(new Error('PDF trop lourd (8 Mo maximum)'))
    const reader = new FileReader()
    reader.onload = () => resolve({ data: String(reader.result).split(',')[1], mediaType: 'application/pdf' })
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.readAsDataURL(file)
  })
}

export function TicketScanScreen({ onClose, onAdded, mode = 'photo' }: TicketScanScreenProps) {
  const electronic = mode === 'file'
  const { scanReceipt, products, pharmacy, history } = useStore()
  // Produits déjà connus (stock + historique) : envoyés avec le ticket pour reconnaître les lignes abrégées.
  const known = useMemo(() => buildKnownCatalog([...products, ...pharmacy], history), [products, pharmacy, history])
  const [detectedStore, setDetectedStore] = useState<string | null>(null)
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
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      const { data, mediaType } = isPdf ? await readPdf(file) : await downscale(file)
      const found = await scanReceipt(data, mediaType, known.map(knownLabel))
      if (found.items.length === 0) toast('Aucun article détecté')
      setDetectedStore(found.store)
      setItems(found.items)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Analyse impossible')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="screen-fade">
      <PageHeader title={electronic ? 'Ticket électronique' : 'Scanner un ticket'} onBack={onClose} />

      {!items ? (
        <div className="ticket-intro">
          <div className="ticket-illus">
            <Icon name="receipt" />
          </div>
          {electronic ? (
            <p>
              Choisis le PDF du ticket reçu par e-mail ou une capture d'écran du ticket dans l'appli du magasin
              (Lidl Plus, Carrefour, Colruyt…). Claude en extrait les articles, tu valides, et ils sont ajoutés au stock.
            </p>
          ) : (
            <p>Prends en photo (ou choisis) ton ticket de caisse. Claude en extrait les articles, tu valides, et ils sont ajoutés au stock.</p>
          )}
          <button className="btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Analyse en cours…' : electronic ? 'Choisir le PDF ou la capture' : 'Prendre / choisir une photo'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={electronic ? 'application/pdf,.pdf,image/*' : 'image/*'}
            capture={electronic ? undefined : 'environment'}
            style={{ display: 'none' }}
            onChange={onPick}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="form-section">
          <p style={{ color: 'var(--muted)' }}>Aucun article détecté sur ce ticket.</p>
          <button className="btn-secondary" onClick={() => setItems(null)}>Réessayer</button>
        </div>
      ) : (
        <ReviewItems
          items={items}
          onDone={onAdded}
          onRetry={() => setItems(null)}
          matchRecent
          known={known}
          askStore
          detectedStore={detectedStore}
        />
      )}
    </div>
  )
}
