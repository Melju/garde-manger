import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../data/store'
import { invokeFn } from '../lib/aiKey'
import { consumeAmount, buyScale, parseContenance } from '../lib/contenance'
import { openShelfDays } from '../lib/openShelf'
import { defaultConservation, type Category, type Product } from '../types'
import { useToast } from './Toast'
import { Icon } from './Icon'
import { kioskEnabled, wakeEnabled } from '../lib/kiosk'
import { startVosk, stopVosk, onVosk, voskActive, listenCommand, cancelCommand, setVoskPaused, voskStatus } from '../lib/voskEngine'

// ----- Types renvoyés par la fonction « voice » -----
type Act =
  | { type: 'shop_add'; label: string; name: string; quantity: number; unit: string; category: Category }
  | { type: 'stock_add'; label: string; name: string; quantity: number; unit: string; category: Category }
  | { type: 'shop_remove'; label: string; id: string }
  | { type: 'stock_remove'; label: string; id: string; amount: number; unit: string }
  | { type: 'stock_finish' | 'stock_open' | 'stock_waste'; label: string; id: string }
  | {
      type: 'ask'
      label: string
      question: string
      options: { id: string; label: string }[]
      then: 'stock_remove' | 'stock_finish' | 'stock_open' | 'stock_waste'
      amount: number
      unit: string
    }

type Row = { act: Act; on: boolean; pick?: string }

/** Ouvre l'assistant vocal depuis n'importe où (bouton micro, mot de réveil). */
export function openVoice(opts?: { autoListen?: boolean; text?: string }) {
  window.dispatchEvent(
    new CustomEvent('miamm-voice', { detail: { autoListen: opts?.autoListen ?? true, text: opts?.text ?? '' } }),
  )
}

/** Bouton micro carré, à poser à côté d'une barre de recherche. */
export function VoiceButton({ className = '' }: { className?: string }) {
  return (
    <button type="button" className={`voice-btn ${className}`} onClick={() => openVoice()} aria-label="Commande vocale" title="Commande vocale">
      <Icon name="mic" />
    </button>
  )
}

const SR: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined
const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document))
// Navigateurs intégrés Android (WebView : Fully Kiosk, applis) : l'API existe parfois mais ne reconnaît rien.
const IS_WEBVIEW = typeof navigator !== 'undefined' && (/; wv\)/.test(navigator.userAgent) || /FullyKiosk|Fully Kiosk/i.test(navigator.userAgent) || 'fully' in window)
export const VOICE_SUPPORTED = !!SR && !IS_IOS && !IS_WEBVIEW
/** Passe à true si le navigateur refuse la dictée (service indisponible) : on bascule sur la saisie. */
let voiceBroken = false

/**
 * Lit une phrase à voix haute : Fully Kiosk (sa propre synthèse) ou le navigateur.
 * Chrome Android avale parfois une phrase lancée juste après cancel(), ou tant que les voix
 * ne sont pas chargées : on attend un peu dans ces deux cas.
 */
export function speak(text: string) {
  const t = text.trim()
  if (!t) return
  // Le micro local se met en pause le temps de la phrase (sinon Miam miam s'entend lui-même).
  setVoskPaused(true)
  setTimeout(() => setVoskPaused(false), 1200 + t.length * 75)
  try {
    const fully = (window as any).fully
    if (fully?.textToSpeech) {
      fully.stopTextToSpeech?.()
      fully.textToSpeech(t, 'fr_FR')
      return
    }
    const synth = window.speechSynthesis
    if (!synth) return
    const go = () => {
      const u = new SpeechSynthesisUtterance(t)
      u.lang = 'fr-FR'
      const voices = synth.getVoices()
      const fr =
        voices.find((v) => v.lang?.toLowerCase().startsWith('fr') && v.localService) ??
        voices.find((v) => v.lang?.toLowerCase().startsWith('fr'))
      if (fr) u.voice = fr
      u.rate = 1.05
      synth.resume()
      synth.speak(u)
    }
    const wasBusy = synth.speaking || synth.pending
    if (wasBusy) synth.cancel()
    if (!synth.getVoices().length) {
      let done = false
      const once = () => {
        if (done) return
        done = true
        synth.removeEventListener?.('voiceschanged', once)
        go()
      }
      synth.addEventListener?.('voiceschanged', once)
      setTimeout(once, 600)
    } else setTimeout(go, wasBusy ? 150 : 0)
  } catch {
    /* pas de voix disponible */
  }
}

/** Chrome n'autorise la voix qu'après un geste : on « amorce » la synthèse au premier toucher. */
if (typeof window !== 'undefined' && window.speechSynthesis) {
  const prime = () => {
    try {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      window.speechSynthesis.speak(u)
    } catch {
      /* rien */
    }
    window.removeEventListener('pointerdown', prime, true)
  }
  window.addEventListener('pointerdown', prime, true)
}

const canListen = () => voskActive() || (VOICE_SUPPORTED && !voiceBroken)

const toBase = (v: number, u: string) => {
  const l = u.toLowerCase()
  return l === 'kg' || l === 'l' ? v * 1000 : l === 'cl' ? v * 10 : v
}

/** Feuille de l'assistant : écoute → compréhension → confirmation → application (avec Annuler). */
export function VoiceAssistant() {
  const store = useStore()
  const live = useRef(store)
  live.current = store
  const { products, shopping } = store
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<'listen' | 'think' | 'review' | 'done' | 'answer'>('listen')
  const [doneLabels, setDoneLabels] = useState<string[]>([])
  const [reply, setReply] = useState('')
  const undoRef = useRef<(() => Promise<void>)[]>([])
  const doneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [unknown, setUnknown] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const recRef = useRef<any>(null)
  const textRef = useRef('')
  textRef.current = text
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const stopRec = () => {
    if (voskActive()) cancelCommand()
    const r = recRef.current
    recRef.current = null
    setListening(false)
    if (r) {
      try {
        r.onend = null
        r.onresult = null
        r.abort?.()
      } catch {
        /* déjà arrêté */
      }
    }
  }

  const close = () => {
    stopRec()
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* rien */
    }
    clearTimeout(doneTimer.current)
    setOpen(false)
  }

  const listen = () => {
    setError('')
    if (voskActive()) {
      setText('')
      if (listenCommand()) setListening(true)
      return
    }
    if (!VOICE_SUPPORTED || voiceBroken) {
      inputRef.current?.focus()
      return
    }
    stopRec()
    const rec = new SR()
    rec.lang = 'fr-FR'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e: any) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setText(t)
    }
    rec.onerror = (e: any) => {
      setListening(false)
      const code = e?.error ?? ''
      setError(
        code === 'not-allowed'
          ? 'Accès au micro refusé : autorise le micro pour ce site dans les réglages du navigateur.'
          : code === 'no-speech'
            ? 'Je n’ai rien entendu. Touche le micro et réessaie.'
            : code === 'audio-capture'
              ? 'Aucun micro détecté sur cet appareil.'
              : code === 'network'
                ? 'La reconnaissance vocale ne répond pas (réseau). Écris ta phrase à la place.'
                : code === 'aborted'
                  ? ''
                  : 'La dictée n’est pas disponible ici : écris ta phrase ou utilise le micro du clavier.',
      )
      if (code === 'service-not-allowed' || code === 'language-not-supported') voiceBroken = true
      if (code && code !== 'aborted' && code !== 'no-speech') setTimeout(() => inputRef.current?.focus(), 50)
    }
    // Fin de phrase (silence) : on envoie directement.
    rec.onend = () => {
      setListening(false)
      recRef.current = null
      if (textRef.current.trim()) void understandRef.current(textRef.current)
    }
    recRef.current = rec
    setText('')
    try {
      rec.start()
      setListening(true)
    } catch (e) {
      setListening(false)
      setError('Impossible de démarrer le micro : ' + (e instanceof Error ? e.message : 'erreur inconnue'))
    }
  }

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ autoListen?: boolean; text?: string }>).detail
      const auto = d?.autoListen ?? true
      const given = (d?.text ?? '').trim()
      setOpen(true)
      setPhase('listen')
      setText(given)
      setRows([])
      setUnknown([])
      setError('')
      setReply('')
      // « Miam miam, ajoute du lait » dit d'une traite : la commande est déjà là, on l'envoie.
      if (given) setTimeout(() => void understandRef.current(given), 0)
      else if (auto && canListen()) listen()
      else setTimeout(() => inputRef.current?.focus(), 150)
    }
    window.addEventListener('miamm-voice', on)
    // Moteur local (tablette) : texte en direct, fin de phrase, mot de réveil.
    const off = onVosk((e) => {
      if (e.type === 'partial') setText(e.text ?? '')
      else if (e.type === 'final') {
        setListening(false)
        if (e.text) void understandRef.current(e.text)
        else setError('Je n’ai rien entendu. Touche le micro et réessaie.')
      } else if (e.type === 'wake') {
        setOpen(true)
        setPhase('listen')
        setText('')
        setRows([])
        setUnknown([])
        setError('')
        setReply('')
        setListening(true)
      }
    })
    return () => {
      window.removeEventListener('miamm-voice', on)
      off()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const understandRef = useRef<(said: string) => Promise<void>>(async () => {})
  understandRef.current = (said: string) => understand(said)
  async function understand(said: string) {
    stopRec()
    const phrase = said.trim()
    if (!phrase) return
    setPhase('think')
    setError('')
    const stock = products.slice(0, 400).map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand || undefined,
      qty: p.quantity,
      size: p.size || undefined,
      opened: !!p.openedAt || undefined,
      exp: p.expiryDate || undefined,
      place: p.location || undefined,
    }))
    const list = shopping
      .filter((s) => !s.checked)
      .map((s) => ({ id: s.id, name: s.name, qty: s.unit ? `${s.quantity} ${s.unit}` : `×${s.quantity}` }))
    const { data, error: err } = await invokeFn('voice', { text: phrase, stock, shopping: list })
    if (err) {
      setError(err.message)
      setPhase('listen')
      return
    }
    const acts = ((data as any)?.actions ?? []) as Act[]
    const said2 = String((data as any)?.reply ?? '')
    setUnknown(((data as any)?.unknown ?? []) as string[])
    setReply(said2)
    const next = acts.map((a) => ({ act: a, on: true }))
    setRows(next)
    speak(said2)
    if (!next.length) {
      // Une question (« est-ce que j'ai encore du beurre ? ») : juste la réponse.
      setPhase('answer')
      clearTimeout(doneTimer.current)
      doneTimer.current = setTimeout(close, Math.min(15000, 6000 + said2.length * 60))
      return
    }
    // Rien d'ambigu : on applique tout de suite (on peut annuler juste après).
    if (!next.some((r) => r.act.type === 'ask')) void apply(next)
    else setPhase('review')
  }

  // ----- Application, avec de quoi annuler -----
  async function apply(list: Row[] = rows) {
    if (busy) return
    setBusy(true)
    const undo: (() => Promise<void>)[] = []
    const t0 = new Date().toISOString()
    const labels: string[] = []
    try {
      for (const r of list) {
        if (!r.on) continue
        let a = r.act
        if (a.type === 'ask') {
          if (!r.pick) continue
          a =
            a.then === 'stock_remove'
              ? { type: 'stock_remove', label: a.label, id: r.pick, amount: a.amount, unit: a.unit }
              : { type: a.then, label: a.label, id: r.pick }
        }
        await applyOne(a, undo, t0)
        labels.push(a.label)
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Une action a échoué')
    } finally {
      setBusy(false)
    }
    if (!labels.length) {
      close()
      return
    }
    // Récap dans la feuille, avec un gros bouton Annuler, puis fermeture automatique.
    undoRef.current = undo
    setDoneLabels(labels)
    setPhase('done')
    clearTimeout(doneTimer.current)
    doneTimer.current = setTimeout(close, 7000)
  }

  async function undoAll() {
    clearTimeout(doneTimer.current)
    const list = undoRef.current
    undoRef.current = []
    for (const u of list.reverse()) {
      try {
        await u()
      } catch {
        /* au mieux */
      }
    }
    close()
    toast('Annulé')
  }

  async function applyOne(a: Exclude<Act, { type: 'ask' }>, undo: (() => Promise<void>)[], t0: string) {
    if (a.type === 'shop_add') {
      const sc = buyScale(a.unit)
      const quantity = a.unit ? Math.round(toBase(a.quantity, a.unit)) : Math.max(1, Math.round(a.quantity))
      const ids = await store.addShoppingBatch([
        { name: a.name, category: a.category, quantity, unit: sc.baseUnit || undefined, source: 'manuel' },
      ])
      await store.recordShopItem(a.name, a.category, a.unit, quantity)
      undo.push(() => store.removeShoppingItems(ids))
      return
    }
    if (a.type === 'shop_remove') {
      const it = shopping.find((s) => s.id === a.id)
      if (!it) return
      await store.removeShoppingItem(it.id)
      undo.push(() =>
        store.addShoppingItem({ name: it.name, category: it.category, quantity: it.quantity, unit: it.unit, source: it.source }),
      )
      return
    }
    if (a.type === 'stock_add') {
      const withSize = !!a.unit
      await store.addProduct({
        name: a.name,
        category: a.category,
        quantity: withSize ? 1 : Math.max(1, Math.round(a.quantity)),
        size: withSize ? `${a.quantity} ${a.unit}` : undefined,
        conservation: defaultConservation(a.category),
      } as any)
      undo.push(async () => {
        // On retrouve le produit créé (même nom, créé après le début de l'application).
        const created = live.current.products.find((p) => p.name === a.name && p.createdAt >= t0)
        if (created) await live.current.removeProduct(created.id)
      })
      return
    }
    const p = products.find((x) => x.id === a.id)
    if (!p) return
    const snap: Product = { ...p }
    undo.push(() => restore(snap))
    if (a.type === 'stock_finish') return store.adjustQuantity(p.id, -Math.max(1, p.quantity))
    if (a.type === 'stock_waste') return store.wasteProduct(p.id)
    if (a.type === 'stock_open') return store.openProduct(p, openShelfDays(p.name, p.category).days)
    if (a.type !== 'stock_remove') return
    const parsed = parseContenance(p.size)
    if (!a.unit || !parsed) {
      const n = a.unit ? 1 : Math.max(1, Math.round(a.amount))
      return store.adjustQuantity(p.id, -Math.min(n, p.quantity))
    }
    const newSize = consumeAmount(p.size!, a.amount, a.unit)
    if (p.quantity > 1) {
      // Un paquet parmi plusieurs est entamé : il devient un lot à part.
      if (newSize === null) return store.adjustQuantity(p.id, -1)
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = p
      await store.updateProduct(p.id, { quantity: p.quantity - 1 })
      await store.addProduct({ ...rest, quantity: 1, size: newSize })
      return
    }
    if (newSize === null) return store.adjustQuantity(p.id, -Math.max(1, p.quantity))
    return store.updateProduct(p.id, { size: newSize })
  }

  async function restore(snap: Product) {
    const { id, createdAt: _c, updatedAt: _u, ...rest } = snap
    const st = live.current
    const still = st.products.find((x) => x.id === id)
    if (still) await st.updateProduct(id, rest)
    else await st.addProduct(rest)
  }

  if (!open) return null
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? ''
  const ready = rows.some((r) => r.on && (r.act.type !== 'ask' || r.pick))

  return createPortal(
    <div className="cselect-overlay voice-overlay" onClick={close}>
      <div className="cselect-sheet voice-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Commande vocale">
        <div className="cselect-handle" />
        {phase === 'answer' ? (
          <>
            <div className="voice-said">« {text} »</div>
            <div className="voice-answer">
              <span className="voice-answer-ico">
                <Icon name="sparkles" />
              </span>
              <p>{reply || 'Je n’ai pas su répondre. Reformule ?'}</p>
              {reply && (
                <button type="button" className="voice-replay-ico" onClick={() => speak(reply)} aria-label="Réécouter">
                  <Icon name="volume" />
                </button>
              )}
            </div>
            <div className="voice-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  clearTimeout(doneTimer.current)
                  setPhase('listen')
                  setText('')
                  if (canListen()) listen()
                }}
              >
                Autre question
              </button>
              <button className="btn-primary" onClick={close}>
                OK
              </button>
            </div>
          </>
        ) : phase === 'done' ? (
          <>
            <div className="voice-done-ico">
              <Icon name="check" width={3} />
            </div>
            <div className="voice-done-title">C’est fait</div>
            {reply && (
              <button type="button" className="voice-reply voice-replay" onClick={() => speak(reply)} title="Réécouter">
                <Icon name="volume" />
                {reply}
              </button>
            )}
            <div className="voice-rows">
              {doneLabels.map((l, i) => (
                <div className="voice-row done" key={i}>
                  <Icon name="check" width={2.5} />
                  <span className="voice-label">{l}</span>
                </div>
              ))}
            </div>
            <div className="voice-actions">
              <button className="btn-secondary" onClick={() => void undoAll()}>
                Annuler
              </button>
              <button className="btn-primary" onClick={close}>
                OK
              </button>
            </div>
            <div className="voice-done-bar" />
          </>
        ) : phase !== 'review' ? (
          <>
            <button
              type="button"
              className={`voice-orb${listening ? ' on' : ''}${phase === 'think' ? ' think' : ''}`}
              onClick={() => (listening ? stopRec() : listen())}
              aria-label={listening ? 'Arrêter' : 'Parler'}
            >
              <Icon name="mic" />
            </button>
            <div className="voice-hint">
              {phase === 'think'
                ? 'Je regarde ton stock…'
                : listening
                  ? 'Je t’écoute…'
                  : canListen()
                    ? 'Touche le micro et parle'
                    : 'Dicte avec le micro du clavier, puis Envoyer'}
            </div>
            <textarea
              ref={inputRef}
              className="voice-text"
              rows={2}
              placeholder="« Ajoute du lait aux courses », « enlève 200 g de comté », « il me reste du beurre ? »…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void understand(text)
                }
              }}
              disabled={phase === 'think'}
            />
            {error && <div className="voice-error">{error}</div>}
            <div className="voice-actions">
              <button className="btn-secondary" onClick={close}>
                Fermer
              </button>
              <button className="btn-primary" disabled={!text.trim() || phase === 'think'} onClick={() => void understand(text)}>
                Envoyer
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="voice-said">« {text} »</div>
            {reply && <div className="voice-reply">{reply}</div>}
            {rows.length === 0 && <div className="voice-hint">Je n’ai pas compris quoi faire. Reformule ?</div>}
            <div className="voice-rows">
              {rows.map((r, i) =>
                r.act.type === 'ask' ? (
                  <div className="voice-ask" key={i}>
                    <div className="voice-ask-q">{r.act.question}</div>
                    <div className="voice-ask-opts">
                      {r.act.options.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className={`usual-chip${r.pick === o.id ? ' on' : ''}`}
                          onClick={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, pick: o.id } : x)))}
                        >
                          {o.label || nameOf(o.id)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <label className={`voice-row${r.on ? '' : ' off'}`} key={i}>
                    <input
                      type="checkbox"
                      checked={r.on}
                      onChange={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                    />
                    <span className={`voice-kind k-${r.act.type}`}>
                      <Icon name={r.act.type.startsWith('shop') ? 'cart' : 'box'} />
                    </span>
                    <span className="voice-label">{r.act.label}</span>
                  </label>
                ),
              )}
            </div>
            {unknown.length > 0 && <div className="voice-unknown">Pas trouvé dans le stock : {unknown.join(', ')}</div>}
            <div className="voice-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setPhase('listen')
                  setRows([])
                  if (canListen()) listen()
                }}
              >
                Recommencer
              </button>
              <button className="btn-primary" disabled={!ready || busy} onClick={() => void apply()}>
                {busy ? '…' : 'Valider'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Mot de réveil « Miam miam » (tablette en mode cuisine, option à activer).
 * Reconnaissance entièrement locale (Vosk) : pas de bip Android, rien d'envoyé tant qu'on ne parle pas
 * à Miam miam. Fonctionne aussi dans Fully Kiosk si l'accès au micro y est autorisé.
 */
export function WakeWord() {
  const [on, setOn] = useState(() => kioskEnabled() && wakeEnabled())
  useEffect(() => {
    const refresh = () => setOn(kioskEnabled() && wakeEnabled())
    window.addEventListener('miamm-wake', refresh)
    window.addEventListener('miamm-kiosk', refresh)
    return () => {
      window.removeEventListener('miamm-wake', refresh)
      window.removeEventListener('miamm-kiosk', refresh)
    }
  }, [])

  useEffect(() => {
    if (!on || !navigator.mediaDevices?.getUserMedia) return
    void startVosk()
    return () => stopVosk()
  }, [on])

  return null
}

/** Petit panneau de diagnostic du réveil vocal (Paramètres) : état, niveau du micro, ce qui est entendu. */
export function VoskDiag() {
  const [st, setSt] = useState(voskStatus())
  const [level, setLevel] = useState(0)
  const [heard, setHeard] = useState('')
  useEffect(() => {
    const off = onVosk((e) => {
      if (e.type === 'level') setLevel(e.level ?? 0)
      else if (e.type === 'heard') setHeard(e.text ?? '')
      setSt(voskStatus())
    })
    const t = setInterval(() => setSt(voskStatus()), 1000)
    return () => {
      off()
      clearInterval(t)
    }
  }, [])
  const label =
    st.status === 'loading'
      ? 'Téléchargement du modèle vocal…'
      : st.status === 'mic'
        ? 'Ouverture du micro…'
        : st.status === 'suspended' || st.audio === 'suspended'
          ? 'Touche l’écran pour activer le micro'
          : st.status === 'ready'
            ? 'À l’écoute de « Miam miam »'
            : st.status === 'error'
              ? `Erreur : ${st.error}`
              : 'Arrêté'
  return (
    <div className="vosk-diag">
      <div className="vosk-diag-row">
        <span className={`vosk-dot s-${st.status}`} />
        {label}
      </div>
      <div className="vosk-meter">
        <span style={{ width: `${Math.min(100, Math.round(level * 900))}%` }} />
      </div>
      <div className="vosk-heard">Entendu : {heard || '…'}</div>
    </div>
  )
}
