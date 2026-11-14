import { useEffect, useState } from 'react'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const KEY = 'miamm-install-dismissed'
const SNOOZE_MS = 30 * 24 * 3600 * 1000

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

function snoozed() {
  try {
    const t = Number(localStorage.getItem(KEY) || 0)
    return Date.now() - t < SNOOZE_MS
  } catch {
    return false
  }
}

// Safari n'émet pas beforeinstallprompt : on explique le geste manuel.
function manualHint(): string | null {
  const ua = navigator.userAgent
  const safari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|Edg|Android/.test(ua)
  if (!safari) return null
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios
    ? 'Touche Partager puis « Sur l’écran d’accueil ».'
    : 'Menu Fichier, puis « Ajouter au Dock ».'
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (isStandalone() || snoozed()) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvt(e as InstallEvent)
      setHidden(false)
    }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    const h = manualHint()
    if (h) {
      setHint(h)
      setHidden(false)
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(KEY, String(Date.now())) } catch { /* ignore */ }
    setHidden(true)
  }
  const install = async () => {
    if (!evt) return
    await evt.prompt()
    const { outcome } = await evt.userChoice
    setEvt(null)
    if (outcome === 'accepted') setHidden(true)
    else dismiss()
  }

  if (hidden || (!evt && !hint)) return null
  return (
    <div className="install-banner" role="dialog" aria-label="Installer l'application">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
      <div className="install-text">
        <strong>Installer Miamm</strong>
        <span>{evt ? 'Accès direct depuis ton dock ou ton écran d’accueil.' : hint}</span>
      </div>
      {evt && <button className="install-go" onClick={install}>Installer</button>}
      <button className="install-x" onClick={dismiss} aria-label="Plus tard">×</button>
    </div>
  )
}
