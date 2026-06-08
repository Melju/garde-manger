import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastFn = (message: string) => void

const ToastContext = createContext<ToastFn | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback<ToastFn>((msg) => {
    setMessage(msg)
    setVisible(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), 2200)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={`toast${visible ? ' show' : ''}`} role="status">
        {message}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans un <ToastProvider>')
  return ctx
}
