import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { acquireCamera, releaseCamera } from '../lib/camera'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { lookupBarcode } from '../lib/openfoodfacts'
import type { Product, ProductInput } from '../types'
import { chosenIconSlug, productImageSlug, productImageUrl } from '../lib/productImage'

interface ScanScreenProps {
  /** Mode 'add' (défaut) : recherche OFF + préremplissage. Mode 'consume' : retrait. */
  mode?: 'add' | 'consume'
  onResult?: (prefill: Partial<ProductInput>, found: boolean) => void
  /** Mode retrait : appelé à chaque scan avec le code-barres (le scan continue). */
  onConsume?: (barcode: string) => void
  /** Mode ajout : renvoie le produit déjà en stock pour ce code-barres (null si inconnu). */
  findKnown?: (barcode: string) => Product | null
  /** Mode ajout : ajoute n unités au produit déjà en stock. */
  onAddKnown?: (product: Product, n: number) => Promise<void>
  /** Mode ajout : produits ajoutés pendant cette session de scan en série. */
  added?: { name: string; count: number }[]
  /** Mode retrait : produits retirés dans la session (pour correction). */
  removed?: { id: string; name: string; count: number }[]
  /** Mode retrait : annule un retrait (remet +1). */
  onUndo?: (id: string) => void
  onClose: () => void
}

type Phase = 'scanning' | 'looking-up' | 'error'

export function ScanScreen({ mode = 'add', onResult, onConsume, findKnown, onAddKnown, added, removed, onUndo, onClose }: ScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const handledRef = useRef(false)
  const lastRef = useRef<{ code: string; t: number }>({ code: '', t: 0 })
  // Callbacks dans une ref pour ne pas relancer la caméra à chaque rendu.
  const cb = useRef({ mode, onResult, onConsume, findKnown })
  cb.current = { mode, onResult, onConsume, findKnown }
  const pausedRef = useRef(false)
  const [known, setKnown] = useState<Product | null>(null)
  const [knownQty, setKnownQty] = useState(1)
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>('scanning')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false

    async function onDetected(barcode: string) {
      const { mode, onResult, onConsume, findKnown } = cb.current
      if (mode === 'consume') {
        // Anti-rebond : ignore le même code scanné dans la dernière seconde et demie.
        const now = Date.now()
        if (lastRef.current.code === barcode && now - lastRef.current.t < 1500) return
        lastRef.current = { code: barcode, t: now }
        onConsume?.(barcode)
        return
      }
      if (handledRef.current) return
      if (pausedRef.current) return
      // Produit déjà en stock : on demande combien en ajouter (le scan est en pause).
      const k = findKnown?.(barcode)
      if (k) {
        pausedRef.current = true
        setKnownQty(1)
        setKnown(k)
        return
      }
      handledRef.current = true
      controlsRef.current?.stop()
      setPhase('looking-up')
      const result = await lookupBarcode(barcode)
      if (cancelled) return
      if (!result.found) toast('Produit inconnu — à compléter manuellement')
      onResult?.(result.prefill, result.found)
    }

    acquireCamera()
      .then((stream) => {
        const v = videoRef.current
        if (cancelled || !v) return
        v.srcObject = stream
        void v.play().catch(() => {})
        // Boucle de lecture : une tentative de décodage toutes les ~150 ms.
        const timer = window.setInterval(() => {
          if (!v.videoWidth || v.paused) return
          try {
            const r = reader.decode(v)
            if (r) void onDetected(r.getText())
          } catch {
            /* pas de code dans l'image */
          }
        }, 150)
        controlsRef.current = { stop: () => window.clearInterval(timer) }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
        setErrorMsg(
          /denied|permission|NotAllowed/i.test(msg)
            ? "Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur."
            : "Caméra indisponible. Le scan nécessite une connexion sécurisée (HTTPS).",
        )
        setPhase('error')
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      const v = videoRef.current
      if (v) v.srcObject = null
      // La caméra est désactivée mais le flux reste réutilisable (pas de nouvelle autorisation).
      releaseCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isConsume = mode === 'consume'

  async function confirmKnown() {
    if (!known) return
    const p = known
    const n = knownQty
    setKnown(null)
    await onAddKnown?.(p, n)
    // Petit délai pour ne pas re-scanner immédiatement le même code.
    setTimeout(() => {
      pausedRef.current = false
    }, 1200)
  }
  function cancelKnown() {
    setKnown(null)
    setTimeout(() => {
      pausedRef.current = false
    }, 800)
  }
  const knownSlug = known ? (chosenIconSlug(known.imageUrl) ?? productImageSlug(known.name)) : null

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

          {isConsume && removed && removed.length > 0 && (
            <div className="scan-removed">
              <div className="scan-removed-title">Retirés · touche pour annuler</div>
              <div className="scan-removed-list">
                {removed.map((r) => (
                  <button key={r.id} className="removed-chip" onClick={() => onUndo?.(r.id)}>
                    <Icon name="back" width={2.2} />
                    {r.name} ×{r.count}
                  </button>
                ))}
              </div>
            </div>
          )}

          {known && (
            <div className="scan-known">
              <div className="scan-known-card">
                <div className="scan-known-head">
                  {knownSlug && <img src={productImageUrl(knownSlug)} alt="" width={56} height={56} />}
                  <div>
                    <strong>{known.name}</strong>
                    <div className="scan-known-sub">Déjà en stock · ×{known.quantity}</div>
                  </div>
                </div>
                <div className="scan-known-ask">Combien en ajouter ?</div>
                <div className="scan-known-stepper">
                  <button type="button" onClick={() => setKnownQty((q) => Math.max(1, q - 1))} aria-label="Moins">
                    <Icon name="minus" width={3} />
                  </button>
                  <span>{knownQty}</span>
                  <button type="button" onClick={() => setKnownQty((q) => q + 1)} aria-label="Plus">
                    <Icon name="plus" width={3} />
                  </button>
                </div>
                <button className="btn-primary" onClick={confirmKnown}>
                  Ajouter {knownQty}
                </button>
                <button className="scan-known-cancel" onClick={cancelKnown}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {!isConsume && added && added.length > 0 && (
            <div className="scan-removed">
              <div className="scan-removed-title">Ajoutés pendant ce scan</div>
              <div className="scan-removed-list">
                {added.map((a) => (
                  <span key={a.name} className="removed-chip added">
                    {a.name} ×{a.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="scan-bottom">
            <p className="scan-hint">
              {phase === 'looking-up'
                ? 'Recherche du produit…'
                : isConsume
                  ? 'Visez un produit à retirer (scan en continu)'
                  : 'Visez le code-barres du produit'}
            </p>
            {(isConsume || (added && added.length > 0)) && (
              <button className="btn-primary scan-done" onClick={onClose}>
                {isConsume ? 'Terminé' : `Terminé (${added!.reduce((n, a) => n + a.count, 0)} ajouté${added!.reduce((n, a) => n + a.count, 0) > 1 ? 's' : ''})`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
