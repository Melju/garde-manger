import { Icon } from './Icon'

/** Petite croix pour vider un champ de recherche. */
export function ClearButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`search-clear ${className}`}
      aria-label="Effacer la recherche"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon name="close" width={2.6} />
    </button>
  )
}
