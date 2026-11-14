import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Bouton de confirmation en rouge (suppression). */
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>
const Ctx = createContext<ConfirmFn | null>(null)

/** Modale de confirmation maison, remplace window.confirm. Usage : `if (!(await confirm({ title: '…' }))) return`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false)
      resolver.current = resolve
      setOpts(o)
    })
  }, [])

  function close(v: boolean) {
    resolver.current?.(v)
    resolver.current = null
    setOpts(null)
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <div className="confirm-overlay" onClick={() => close(false)}>
          <div className="confirm-box" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-title">{opts.title}</div>
            {opts.message && <div className="confirm-msg">{opts.message}</div>}
            <div className="confirm-actions">
              <button type="button" className="confirm-btn" onClick={() => close(false)}>
                {opts.cancelLabel ?? 'Annuler'}
              </button>
              <button
                type="button"
                className={`confirm-btn primary${opts.danger ? ' danger' : ''}`}
                autoFocus
                onClick={() => close(true)}
              >
                {opts.confirmLabel ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConfirm doit être utilisé dans un <ConfirmProvider>')
  return ctx
}
