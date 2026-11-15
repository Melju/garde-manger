import { useToast } from './Toast'

/** Secours quand le partage natif est refusé : copier le lien ou relancer le partage. */
export function ShareLinkSheet({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  const toast = useToast()
  const text = `Une recette Miamm à découvrir : ${title}`
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      toast('Lien copié')
      onClose()
    } catch {
      toast('Copie impossible, sélectionne le lien')
    }
  }
  async function share() {
    try {
      await navigator.share({ title, text, url })
      onClose()
    } catch {
      /* annulé */
    }
  }
  return (
    <div className="cselect-overlay" onClick={onClose}>
      <div className="cselect-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cselect-handle" />
        <div className="cselect-title">Lien de partage prêt</div>
        <input className="form-input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ marginBottom: 12 }} />
        <div className="btn-row">
          {typeof navigator.share === 'function' && (
            <button type="button" className="action-chip cancel" onClick={share}>Partager</button>
          )}
          <button type="button" className="btn-primary" onClick={copy}>Copier le lien</button>
        </div>
      </div>
    </div>
  )
}
