import { Icon } from './Icon'

/** Bouton flottant « + » qui ouvre l'écran d'ajout de produits. */
export function Fab({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="fab" onClick={onOpen} aria-label="Ajouter des produits">
      <Icon name="plus" />
    </button>
  )
}
