import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { lookupBarcode } from '../lib/openfoodfacts'
import type { ProductInput } from '../types'

interface ScanScreenProps {
  /** Mode 'add' (défaut) : recherche OFF + préremplissage. Mode 'consume' : retrait. */
  mode?: 'add' | 'consume'
  onResult?: (prefill: Partial<ProductInput>, found: boolean) => void
  /** Mode retrait : appelé à chaque scan avec le code-barres (le scan continue). */
  onConsume?: (barcode: string) => void
  onClose: () => void
}

type Phase = 'scanning' | 'looking-up' | 'error'

export function ScanScreen({ mode = 'add', onResult, onConsume, onClose }: ScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const handledRef = useRef(false)
  const lastRef = useRef<{ code: string; t: number }>({ code: '', t: 0 })
  // Callbacks dans une ref pour ne pas relancer la caméra à chaque rendu.
  const cb = useRef({ mode, onResult, onConsume })
  cb.current = { mode, onResult, onConsume }
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>('scanning')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false

    async function onDetected(barcode: string) {
      const { mode, onResult, onConsume } = cb.current
      if (mode === 'consume') {
        // Anti-rebond : ignore le même code scanné dans la dernière seconde et demie.
        const now = Date.now()
        if (lastRef.current.code === barcode && now - lastRef.current.t < 1500) return
        lastRef.current = { code: barcode, t: now }
        onConsume?.(barcode)
        return
      }
      if (handledRef.current) return
      handledRef.current = true
      controlsRef.current?.stop()
      setPhase('looking-up')
      const result = await lookupBarcode(barcode)
      if (cancelled) return
      if (!result.found) toast('Produit inconnu — à compléter manuellement')
      onResult?.(result.prefill, result.found)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isConsume = mode === 'consume'

  return (
    <div className={`scan-screen${isConsume ? ' consume' : ''}`}>
      <div className="scan-topbar">
        <button className="back-btn" onClick={onClose} aria-label="Retour">
          <Icon name="back" />
        </button>
        <span className="scan-title">{isConsume ? 'Scanner un retrait' : 'Scanner un code-barres'}</span>
      </div>

      <div className={`scan-mode-banner${isConsume ? ' minus' : ' plus'}`}>
        <span className="smb-icon">
          <Icon name={isConsume ? 'minus' : 'plus'} width={3} />
        </span>
        <span className="smb-text">
          {isConsume ? 'Mode retrait · chaque scan enlève 1 du stock' : 'Mode ajout · scanne pour ajouter un produit'}
        </span>
      </div>

      {phase === 'error' ? (
        <div className="scan-error">
          <Icon name="alert" />
          <p>{errorMsg}</p>
          <button className="btn-secondary" onClick={onClose} style={{ maxWidth: 240 }}>
            {isConsume ? 'Fermer' : 'Saisir manuellement'}
          </button>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="scan-video" playsInline muted />
          <div className="scan-frame" />
          <div className="scan-bottom">
            <p className="scan-hint">
              {phase === 'looking-up'
                ? 'Recherche du produit…'
                : isConsume
                  ? 'Visez un produit à retirer (scan en continu)'
                  : 'Visez le code-barres du produit'}
            </p>
            {isConsume && (
              <button className="btn-primary scan-done" onClick={onClose}>
                Terminé
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
