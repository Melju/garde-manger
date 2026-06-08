import { Icon } from './Icon'

/** Barre d'ajout fixe en bas (largeur d'une fiche produit), ouvre l'écran d'ajout. */
export function Fab({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="add-bar">
      <button className="add-btn" onClick={onOpen}>
        <Icon name="plus" />
        Ajouter un produit
      </button>
    </div>
  )
}
