import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export interface PromptOptions {
  title: string
  defaultValue?: string
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal'
  confirmLabel?: string
}
type PromptFn = (opts: PromptOptions) => Promise<string | null>
const PromptCtx = createContext<PromptFn | null>(null)

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

  const [ask, setAsk] = useState<PromptOptions | null>(null)
  const [text, setText] = useState('')
  const askResolver = useRef<((v: string | null) => void) | null>(null)
  const prompt = useCallback<PromptFn>((o) => {
    return new Promise<string | null>((resolve) => {
      askResolver.current?.(null)
      askResolver.current = resolve
      setText(o.defaultValue ?? '')
      setAsk(o)
    })
  }, [])
  function closeAsk(v: string | null) {
    askResolver.current?.(v)
    askResolver.current = null
    setAsk(null)
  }

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
      <PromptCtx.Provider value={prompt}>
      {children}
      {ask && (
        <div className="confirm-overlay" onClick={() => closeAsk(null)}>
          <form
            className="confirm-box"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              closeAsk(text)
            }}
          >
            <div className="confirm-title">{ask.title}</div>
            <input
              className="form-input confirm-input"
              autoFocus
              inputMode={ask.inputMode}
              placeholder={ask.placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="confirm-actions">
              <button type="button" className="confirm-btn" onClick={() => closeAsk(null)}>
                Annuler
              </button>
              <button type="submit" className="confirm-btn primary">
                {ask.confirmLabel ?? 'OK'}
              </button>
            </div>
          </form>
        </div>
      )}
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
      </PromptCtx.Provider>
    </Ctx.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConfirm doit être utilisé dans un <ConfirmProvider>')
  return ctx
}

export function usePrompt(): PromptFn {
  const ctx = useContext(PromptCtx)
  if (!ctx) throw new Error('usePrompt doit être utilisé dans un <ConfirmProvider>')
  return ctx
}
