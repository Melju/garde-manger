import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useStore } from '../data/store'
import type { DateType } from '../types'

export interface ScannedDate {
  date: string
  type: DateType | null
  raw: string
  confident: boolean
}

/** Viseur en direct : tu cadres la date, un toucher lit l'image (pas d'appareil photo système). */
export function DateScanner({
  onResult,
  onClose,
}: {
  onResult: (r: ScannedDate) => void
  onClose: () => void
}) {
  const { scanExpiry } = useStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const v = videoRef.current
        if (v) {
          v.srcObject = s
          v.play().then(() => setReady(true)).catch(() => setReady(true))
        }
      })
      .catch((e) => {
        setError(
          e?.name === 'NotAllowedError'
            ? "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur."
            : 'Caméra indisponible (connexion sécurisée HTTPS requise).',
        )
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      const v = videoRef.current
      if (v) v.srcObject = null
    }
  }, [])

  async function capture() {
    const v = videoRef.current
    if (!v || busy || !v.videoWidth) return
    setBusy(true)
    setMsg('')
    try {
      const max = 1600
      const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(v.videoWidth * scale)
      c.height = Math.round(v.videoHeight * scale)
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
      const data = c.toDataURL('image/jpeg', 0.85).split(',')[1]
      const r = await scanExpiry(data, 'image/jpeg')
      if (!r.date) {
        setMsg('Aucune date lue : rapproche-toi, évite les reflets, réessaie')
        return
      }
      onResult({ date: r.date, type: r.type, raw: r.raw, confident: r.confident })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Lecture impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scan-screen">
      <div className="scan-topbar">
        <button className="back-btn" onClick={onClose} aria-label="Retour">
          <Icon name="back" />
        </button>
        <span className="scan-title">Scanner la date</span>
      </div>
      {error ? (
        <div className="scan-error">
          <Icon name="alert" />
          <p>{error}</p>
          <button className="btn-secondary" onClick={onClose} style={{ maxWidth: 240 }}>
            Fermer
          </button>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="scan-video" playsInline muted />
          <div className="scan-frame date-frame" />
          <div className="scan-bottom">
            <p className="scan-hint">{busy ? 'Lecture de la date…' : msg || 'Cadre la date sur l’emballage, puis touche le bouton'}</p>
            <button className="btn-primary scan-done" onClick={capture} disabled={busy || !ready}>
              {busy ? 'Lecture…' : 'Lire la date'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
