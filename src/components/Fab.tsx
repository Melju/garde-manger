import { Icon } from './Icon'

/** Barre d'action fixe en bas (largeur d'une fiche), contextuelle à la page. */
export function Fab({ label, onOpen, round }: { label: string; onOpen: () => void; round?: boolean }) {
  return (
    <div className={`add-bar${round ? ' round' : ''}`}>
      <button className="add-btn" onClick={onOpen} aria-label={label} title={label}>
        <Icon name="plus" />
        <span className="add-btn-label">{label}</span>
      </button>
    </div>
  )
}
