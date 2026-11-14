import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AuthProvider } from './data/auth'
import { StoreProvider } from './data/store'
import { ToastProvider } from './components/Toast'
import { Tooltip } from './components/Tooltip'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <StoreProvider>
          <App />
          <Tooltip />
        </StoreProvider>
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
)

// Service worker : sert uniquement à recevoir les notifications push (aucun cache).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
