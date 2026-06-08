import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { lookupBarcode } from '../lib/openfoodfacts'
import type { ProductInput } from '../types'

interface ScanScreenProps {
  onResult: (prefill: Partial<ProductInput>, found: boolean) => void
  onClose: () => void
}

type Phase = 'scanning' | 'looking-up' | 'error'

export function ScanScreen({ onResult, onClose }: ScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const handledRef = useRef(false)
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>('scanning')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false

    async function onDetected(barcode: string) {
      if (handledRef.current) return
      handledRef.current = true
      controlsRef.current?.stop()
      setPhase('looking-up')
      const result = await lookupBarcode(barcode)
      if (cancelled) return
      if (!result.found) {
        toast('Produit inconnu — à compléter manuellement')
      }
      onResult(result.prefill, result.found)
    }

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current!,
        (result, _err, controls) => {
          controlsRef.current = controls
          if (result) onDetected(result.getText())
        },
      )
      .then((controls) => {
        controlsRef.current = controls
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMsg(
          /denied|permission/i.test(msg)
            ? "Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur."
            : "Caméra indisponible. Le scan nécessite une connexion sécurisée (HTTPS).",
        )
        setPhase('error')
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [onResult, toast])

  return (
    <div className="scan-screen">
      <div className="scan-topbar">
        <button className="back-btn" onClick={onClose} aria-label="Retour">
          <Icon name="back" />
        </button>
        <span className="scan-title">Scanner un code-barres</span>
      </div>

      {phase === 'error' ? (
        <div className="scan-error">
          <Icon name="alert" />
          <p>{errorMsg}</p>
          <button className="btn-secondary" onClick={onClose} style={{ maxWidth: 240 }}>
            Saisir manuellement
          </button>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="scan-video" playsInline muted />
          <div className="scan-frame" />
          <p className="scan-hint">
            {phase === 'looking-up' ? 'Recherche du produit…' : 'Visez le code-barres du produit'}
          </p>
        </>
      )}
    </div>
  )
}
