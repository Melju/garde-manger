import { useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { ReviewItems } from '../components/ReviewItems'
import { useDictation } from '../lib/useDictation'
import type { ReceiptItem } from '../types'

interface BulkAddScreenProps {
  onClose: () => void
  onAdded: () => void
}

/** Saisie en lot : liste libre → Claude structure → revue → ajout au stock. */
export function BulkAddScreen({ onClose, onAdded }: BulkAddScreenProps) {
  const { parseBulk } = useStore()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<ReceiptItem[] | null>(null)
  const dict = useDictation(setText)

  function toggleMic() {
    if (dict.listening) {
      dict.stop()
      return
    }
    if (!dict.supported) {
      document.getElementById('bulk-text')?.focus()
      toast('Touche le micro 🎤 de ton clavier pour dicter')
      return
    }
    dict.start(text)
  }

  async function analyze() {
    if (!text.trim()) return
    setBusy(true)
    toast('Analyse de la liste…')
    try {
      const found = await parseBulk(text)
      if (found.length === 0) toast('Aucun article reconnu')
      setItems(found)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Analyse impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen-fade">
      <PageHeader title="Ajouter en lot" onBack={onClose} />

      {!items ? (
        <div className="form-section">
          <div className="ticket-illus" style={{ margin: '8px auto 16px' }}>
            <Icon name="sparkles" />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 14, textAlign: 'center' }}>
            Tape ta liste en vrac, une ligne par produit ou séparés par des virgules. Claude la
            transforme en produits (nom, quantité, unité, catégorie).
          </p>
          <textarea
            id="bulk-text"
            className="form-input"
            style={{ minHeight: 160, resize: 'vertical', lineHeight: 1.5 }}
            placeholder={'Ex :\n6 yaourts nature\n1 kg farine\npâtes x3\nlait demi-écrémé 1L\n4 pommes'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className={`dictate-btn${dict.listening ? ' on' : ''}`}
            onClick={toggleMic}
            type="button"
          >
            <Icon name="mic" />
            {dict.listening ? 'Écoute… (touche pour arrêter)' : 'Dicter la liste'}
          </button>
          <button className="btn-primary" style={{ marginTop: 12 }} disabled={busy || !text.trim()} onClick={analyze}>
            {busy ? 'Analyse en cours…' : 'Analyser la liste'}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="form-section">
          <p style={{ color: 'var(--muted)' }}>Aucun article reconnu.</p>
          <button className="btn-secondary" onClick={() => setItems(null)}>Modifier la liste</button>
        </div>
      ) : (
        <ReviewItems items={items} onDone={onAdded} onRetry={() => setItems(null)} />
      )}
    </div>
  )
}
