import { Icon } from './Icon'

/** Barre d'action fixe en bas (largeur d'une fiche), contextuelle à la page. */
export function Fab({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <div className="add-bar">
      <button className="add-btn" onClick={onOpen}>
        <Icon name="plus" />
        {label}
      </button>
    </div>
  )
}
