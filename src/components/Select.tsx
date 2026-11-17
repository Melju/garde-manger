import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Texte affiché quand aucune option ne correspond à la valeur. */
  placeholder?: string
  /** Titre de la feuille de choix. */
  title?: string
  className?: string
  ariaLabel?: string
  /** Contenu du bouton à la place du libellé (ex. icône + libellé masquable). */
  renderTrigger?: (label: string) => ReactNode
}

/** Liste déroulante maison (feuille de choix en bas d'écran) : remplace le <select> natif. */
export function Select({ value, onChange, options, placeholder, title, className, ariaLabel, renderTrigger }: SelectProps) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        className={`cselect-btn ${className ?? ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {renderTrigger ? renderTrigger(current?.label ?? placeholder ?? value) : (current?.label ?? placeholder ?? value)}
      </button>
      {open && createPortal(
        <div className="cselect-overlay" onClick={() => setOpen(false)}>
          <div className="cselect-sheet" role="listbox" aria-label={ariaLabel} onClick={(e) => e.stopPropagation()}>
            <div className="cselect-handle" />
            {(title ?? ariaLabel) && <div className="cselect-title">{title ?? ariaLabel}</div>}
            <div className="cselect-list">
              {options.map((o) => (
                <button
                  key={o.value + o.label}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`cselect-opt${o.value === value ? ' on' : ''}`}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  <span>{o.label}</span>
                  {o.value === value && (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
