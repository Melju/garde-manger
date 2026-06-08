import { useState } from 'react'
import { Icon } from './Icon'

interface FabProps {
  onScanBarcode: () => void
  onScanTicket: () => void
  onManual: () => void
}

/** Bouton flottant d'ajout, ouvrant un menu (code-barres, ticket, manuel). */
export function Fab({ onScanBarcode, onScanTicket, onManual }: FabProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const pick = (fn: () => void) => () => {
    close()
    fn()
  }

  return (
    <>
      <div className={`fab-backdrop${open ? ' open' : ''}`} onClick={close} />
      <div className={`fab-menu${open ? ' open' : ''}`}>
        <div className="fab-option" onClick={pick(onScanBarcode)}>
          <div className="fab-option-icon">
            <Icon name="scan" />
          </div>
          <span className="fab-option-text">Scanner code-barres</span>
        </div>
        <div className="fab-option soon" onClick={pick(onScanTicket)}>
          <div className="fab-option-icon">
            <Icon name="receipt" />
          </div>
          <span className="fab-option-text">Scanner ticket (bientôt)</span>
        </div>
        <div className="fab-option" onClick={pick(onManual)}>
          <div className="fab-option-icon">
            <Icon name="pencil" />
          </div>
          <span className="fab-option-text">Saisir manuellement</span>
        </div>
      </div>
      <button
        className={`fab${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Ajouter un produit"
      >
        <Icon name="plus" />
      </button>
    </>
  )
}
