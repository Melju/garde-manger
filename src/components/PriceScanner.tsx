import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useStore } from '../data/store'
import { acquireCamera, releaseCamera } from '../lib/camera'

export interface ScannedPrice {
  price: number
  unitPrice: number | null
  unitLabel: string | null
  name: string | null
  confident: boolean
}

/** Viseur en direct : tu cadres l'étiquette de prix, un toucher lit l'image. */
export function PriceScanner({
  onResult,
  onClose,
}: {
  onResult: (r: ScannedPrice) => void
  onClose: () => void
}) {
  const { scanPrice } = useStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    acquireCamera()
      .then((s) => {
        const v = videoRef.current
        if (cancelled || !v) return
        v.srcObject = s
        v.play().then(() => setReady(true)).catch(() => setReady(true))
      })
      .catch((e) => {
        setError(
          e?.name === 'NotAllowedError'
            ? 'Accès à la caméra refusé. Autorise-le dans les réglages du navigateur.'
            : 'Caméra indisponible (connexion sécurisée HTTPS requise).',
        )
      })
    return () => {
      cancelled = true
      const v = videoRef.current
      if (v) v.srcObject = null
      releaseCamera()
    }
  }, [])

  async function capture() {
    const v = videoRef.current
    if (!v || busy || !v.videoWidth) return
    setBusy(true)
    setMsg('')
    try {
      const max = 1280
      const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(v.videoWidth * scale)
      c.height = Math.round(v.videoHeight * scale)
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
      const data = c.toDataURL('image/jpeg', 0.8).split(',')[1]
      const r = await scanPrice(data, 'image/jpeg')
      if (r.price == null) {
        setMsg('Aucun prix lu : rapproche-toi de l’étiquette, évite les reflets, réessaie')
        return
      }
      onResult({ ...r, price: r.price })
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
        <span className="scan-title">Scanner le prix</span>
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
            <p className="scan-hint">{busy ? 'Lecture du prix…' : msg || 'Cadre l’étiquette de prix en rayon, puis touche le bouton'}</p>
            <button className="btn-primary scan-done" onClick={capture} disabled={busy || !ready}>
              {busy ? 'Lecture…' : 'Lire le prix'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
