import { Icon } from './Icon'

interface Props {
  onCancel: () => void
  onSave: () => void
  saveLabel: string
  disabled?: boolean
  cancelLabel?: string
}

/** Barre d'actions collée en bas des formulaires : Annuler + bouton principal, identique à la fiche produit. */
export function FormFooter({ onCancel, onSave, saveLabel, disabled, cancelLabel = 'Annuler' }: Props) {
  return (
    <div className="form-footer">
      <div className="form-actions">
        <button type="button" className="action-chip cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
      <button className="btn-primary form-save" disabled={disabled} onClick={onSave}>
        <Icon name="check" width={2.4} />
        {saveLabel}
      </button>
    </div>
  )
}
