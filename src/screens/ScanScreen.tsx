import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { acquireCamera, releaseCamera } from '../lib/camera'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { lookupBarcode } from '../lib/openfoodfacts'
import type { Product, ProductInput } from '../types'
import { DatePicker } from '../components/DatePicker'
import { DateScanner } from '../components/DateScanner'
import { estimatedExpiryISO } from '../lib/shelfLife'
import { chosenIconSlug, productImageSlug, productImageUrl } from '../lib/productImage'

interface ScanScreenProps {
  /** Mode 'add' (défaut) : recherche OFF + préremplissage. Mode 'consume' : retrait. */
  mode?: 'add' | 'consume'
  onResult?: (prefill: Partial<ProductInput>, found: boolean) => void
  /** Mode retrait : appelé à chaque scan avec le code-barres (le scan continue). */
  onConsume?: (barcode: string) => void
  /** Mode ajout : renvoie le produit déjà en stock pour ce code-barres (null si inconnu). */
  findKnown?: (barcode: string) => Product | null
  /** Mode ajout : ajoute n unités (avec leur péremption) au produit déjà en stock. */
  onAddKnown?: (product: Product, n: number, expiries: string[]) => Promise<void>
  /** Mode ajout : fiche mémorisée pour un code-barres qui n'est plus en stock. */
  findMemory?: (barcode: string) => Partial<ProductInput> | null
  /** Mode ajout : produits ajoutés pendant cette session de scan en série. */
  added?: { name: string; count: number }[]
  /** Mode retrait : produits retirés dans la session (pour correction). */
  removed?: { id: string; name: string; count: number }[]
  /** Mode retrait : annule un retrait (remet +1). */
  onUndo?: (id: string) => void
  onClose: () => void
}

type Phase = 'scanning' | 'looking-up' | 'error'

export function ScanScreen({ mode = 'add', onResult, onConsume, findKnown, onAddKnown, findMemory, added, removed, onUndo, onClose }: ScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const handledRef = useRef(false)
  const lastRef = useRef<{ code: string; t: number }>({ code: '', t: 0 })
  // Callbacks dans une ref pour ne pas relancer la caméra à chaque rendu.
  const cb = useRef({ mode, onResult, onConsume, findKnown, findMemory })
  cb.current = { mode, onResult, onConsume, findKnown, findMemory }
  const pausedRef = useRef(false)
  const [addedOpen, setAddedOpen] = useState(false)
  const [known, setKnown] = useState<Product | null>(null)
  const [knownQty, setKnownQty] = useState(1)
  const [knownExpiry, setKnownExpiry] = useState('')
  const [scanIdx, setScanIdx] = useState<number | null>(null) // -1 = date commune
  const [diffDates, setDiffDates] = useState(false)
  const [knownDates, setKnownDates] = useState<string[]>([])
  const setDateAt = (i: number, v: string) => setKnownDates((d) => { const c = [...d]; c[i] = v; return c })
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>('scanning')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false

    async function onDetected(barcode: string) {
      const { mode, onResult, onConsume, findKnown, findMemory } = cb.current
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
        setKnownExpiry('')
        setDiffDates(false)
        setKnownDates([])
        setKnown(k)
        return
      }
      handledRef.current = true
      controlsRef.current?.stop()
      setPhase('looking-up')
      const mem = findMemory?.(barcode)
      if (mem) {
        // Déjà ajouté par le passé : on reprend la fiche, la péremption est à renseigner.
        onResult?.({ ...mem, expiryDate: undefined, quantity: 1 }, true)
        return
      }
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
    const exps = Array.from({ length: n }, (_, i) => (diffDates ? knownDates[i] || '' : knownExpiry))
    await onAddKnown?.(p, n, exps)
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
          {isConsume ? 'Mode retrait · scanne puis choisis la quantité à retirer' : 'Mode ajout · scanne pour ajouter un produit'}
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

          {known && scanIdx !== null && (
            <DateScanner
              onResult={(r) => {
                if (scanIdx === -1) setKnownExpiry(r.date)
                else setDateAt(scanIdx!, r.date)
                setScanIdx(null)
              }}
              onClose={() => setScanIdx(null)}
            />
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
                <div className="scan-known-exp">
                  {knownQty > 1 && (
                    <div className="scan-known-exp-actions" style={{ marginTop: 0, marginBottom: 10 }}>
                      <button type="button" className={`usual-chip${!diffDates ? ' on' : ''}`} onClick={() => setDiffDates(false)}>
                        Même date pour tous
                      </button>
                      <button type="button" className={`usual-chip${diffDates ? ' on' : ''}`} onClick={() => setDiffDates(true)}>
                        Une date par article
                      </button>
                    </div>
                  )}
                  {!diffDates || knownQty < 2 ? (
                    <>
                      <label className="form-label">Date de péremption</label>
                      <DatePicker value={knownExpiry} onChange={setKnownExpiry} />
                      <div className="scan-known-exp-actions">
                        <button type="button" className="usual-chip" onClick={() => setScanIdx(-1)}>
                          Scanner la date
                        </button>
                        {!knownExpiry && (() => {
                          const est = estimatedExpiryISO(known.name, known.conservation, known.category)
                          return est ? (
                            <button type="button" className="usual-chip" onClick={() => setKnownExpiry(est)}>
                              Utiliser l'estimation
                            </button>
                          ) : null
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="scan-known-multi">
                      {Array.from({ length: knownQty }, (_, i) => (
                        <div key={i} className="scan-known-multi-row">
                          <div className="scan-known-multi-n">Article {i + 1}</div>
                          <DatePicker value={knownDates[i] || ''} onChange={(v) => setDateAt(i, v)} />
                          <div className="scan-known-exp-actions">
                            <button type="button" className="usual-chip" onClick={() => setScanIdx(i)}>
                              Scanner
                            </button>
                            {i > 0 && knownDates[i - 1] && knownDates[i] !== knownDates[i - 1] && (
                              <button type="button" className="usual-chip" onClick={() => setDateAt(i, knownDates[i - 1])}>
                                Idem article {i}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
            <div className={`scan-added-card${addedOpen ? ' open' : ''}`}>
              {addedOpen && (
                <ul className="scan-added-list">
                  {[...added].reverse().map((a) => (
                    <li key={a.name} className="scan-added-row">
                      <span className="scan-added-check">✓</span>
                      <span className="scan-added-name">{a.name}</span>
                      <span className="scan-added-count">×{a.count}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="scan-added-bar" onClick={() => setAddedOpen((o) => !o)} aria-expanded={addedOpen}>
                <span className="scan-added-check">✓</span>
                <span className="scan-added-name">
                  {added.length > 1 ? `${added.length} produits · dernier : ` : ''}
                  {added[added.length - 1].name}
                </span>
                <span className="scan-added-chev" aria-hidden>{addedOpen ? '▾' : '▴'}</span>
              </button>
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
