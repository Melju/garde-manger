import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastAction = { label: string; onClick: () => void }
type ToastFn = (message: string, action?: ToastAction) => void

const ToastContext = createContext<ToastFn | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const [action, setAction] = useState<ToastAction | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback<ToastFn>((msg, act) => {
    setMessage(msg)
    setAction(act ?? null)
    setVisible(true)
    if (timer.current) clearTimeout(timer.current)
    // Avec une action (Annuler), on laisse le temps de réagir.
    timer.current = setTimeout(() => setVisible(false), act ? 6000 : 2200)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={`toast${visible ? ' show' : ''}${action ? ' has-action' : ''}`} role="status">
        <span>{message}</span>
        {action && (
          <button
            className="toast-action"
            onClick={() => {
              setVisible(false)
              action.onClick()
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans un <ToastProvider>')
  return ctx
}
