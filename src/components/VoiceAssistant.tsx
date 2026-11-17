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

/** Lit une phrase à voix haute : Fully Kiosk (sa propre synthèse) ou le navigateur. */
export function speak(text: string) {
  const t = text.trim()
  if (!t) return
  try {
    const fully = (window as any).fully
    if (fully?.textToSpeech) {
      fully.stopTextToSpeech?.()
      fully.textToSpeech(t, 'fr_FR')
      return
    }
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(t)
    u.lang = 'fr-FR'
    const fr = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('fr'))
    if (fr) u.voice = fr
    u.rate = 1.05
    synth.speak(u)
  } catch {
    /* pas de voix disponible */
  }
}

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
      else if (auto && VOICE_SUPPORTED && !voiceBroken) listen()
      else setTimeout(() => inputRef.current?.focus(), 150)
    }
    window.addEventListener('miamm-voice', on)
    return () => window.removeEventListener('miamm-voice', on)
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
            </div>
            <div className="voice-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  clearTimeout(doneTimer.current)
                  setPhase('listen')
                  setText('')
                  if (VOICE_SUPPORTED && !voiceBroken) listen()
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
            {reply && <div className="voice-reply">{reply}</div>}
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
                  : VOICE_SUPPORTED && !voiceBroken
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
                  if (VOICE_SUPPORTED) listen()
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
 *
 * Chrome Android bipe à chaque démarrage de la reconnaissance vocale : on ne la lance donc pas en boucle.
 * L'app écoute le NIVEAU SONORE du micro en local (rien n'est envoyé, aucun bip) et ne démarre la
 * reconnaissance que quand quelqu'un parle. Le tout début de la phrase peut être perdu : un seul « miam »
 * entendu suffit, et ce qui suit est pris comme commande (« Miam miam, ajoute du lait »).
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
    if (!on || !VOICE_SUPPORTED || !navigator.mediaDevices?.getUserMedia) return
    let stopped = false
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let poll: ReturnType<typeof setInterval> | undefined
    let rearm: ReturnType<typeof setTimeout> | undefined
    let rec: any = null
    let floor = 0.01 // bruit de fond, ajusté en continu
    let loudSince = 0
    let lastRec = 0
    const norm = (t: string) =>
      t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z' ]/g, ' ')
    const WAKE = /\b(miam|myam|niam|mjam)\b/

    const busy = () =>
      !!document.querySelector('.voice-overlay') ||
      document.visibilityState !== 'visible' ||
      !!window.speechSynthesis?.speaking

    const releaseMic = () => {
      clearInterval(poll)
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      void ctx?.close().catch(() => {})
      ctx = null
    }

    // Écoute du niveau sonore, sans reconnaissance.
    const arm = async () => {
      if (stopped || stream) return
      if (busy()) {
        rearm = setTimeout(arm, 1500)
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
      } catch {
        stopped = true // micro refusé : on n'insiste pas
        return
      }
      if (stopped) return releaseMic()
      ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser()
      an.fftSize = 1024
      src.connect(an)
      const buf = new Float32Array(an.fftSize)
      poll = setInterval(() => {
        if (busy()) {
          // L'assistant prend le micro (ou Miam miam parle) : on le libère et on se réarme plus tard.
          loudSince = 0
          releaseMic()
          rearm = setTimeout(arm, 1500)
          return
        }
        an.getFloatTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
        const rms = Math.sqrt(sum / buf.length)
        const now = Date.now()
        if (rms > Math.max(floor * 3, 0.02)) {
          if (!loudSince) loudSince = now
          // Une voix (pas un claquement) : ~120 ms au-dessus du bruit de fond.
          if (now - loudSince > 120 && now - lastRec > 3000) recognize()
        } else {
          loudSince = 0
          floor = floor * 0.97 + rms * 0.03
        }
      }, 50)
    }

    // Reconnaissance (un bip) uniquement quand quelqu'un parle.
    const recognize = () => {
      lastRec = Date.now()
      loudSince = 0
      releaseMic() // le micro est rendu au navigateur pour la reconnaissance
      rec = new SR()
      rec.lang = 'fr-FR'
      rec.continuous = false
      rec.interimResults = false
      rec.maxAlternatives = 3
      let heard = '' // toutes les variantes, pour repérer « miam »
      let best = '' // la variante la plus probable, pour la commande qui suit
      rec.onresult = (e: any) => {
        heard = ''
        best = ''
        for (let i = 0; i < e.results.length; i++) {
          best += ' ' + e.results[i][0].transcript
          for (let j = 0; j < e.results[i].length; j++) heard += ' ' + e.results[i][j].transcript
        }
      }
      rec.onerror = () => {}
      rec.onend = () => {
        rec = null
        const t = norm(heard)
        const m = t.match(WAKE)
        if (m && !stopped) {
          // Ce qui suit le dernier « miam » est déjà la commande.
          const after = !WAKE.test(norm(best)) ? '' : best.trim().replace(/^.*?\b(?:miam|myam|niam|mjam)\b[\s,.!-]*(?:(?:miam|myam|niam|mjam)\b[\s,.!-]*)*/i, '').trim()
          openVoice({ autoListen: true, text: after.length > 3 ? after : '' })
          rearm = setTimeout(arm, 2500)
          return
        }
        rearm = setTimeout(arm, 600)
      }
      try {
        rec.start()
      } catch {
        rec = null
        rearm = setTimeout(arm, 2000)
      }
    }

    // L'assistant ou une réponse parlée en cours : on attend, puis on se réarme.
    const onVis = () => {
      if (document.visibilityState === 'visible') void arm()
      else releaseMic()
    }
    document.addEventListener('visibilitychange', onVis)
    void arm()
    return () => {
      stopped = true
      clearTimeout(rearm)
      releaseMic()
      try {
        if (rec) {
          rec.onend = null
          rec.abort()
        }
      } catch {
        /* déjà arrêté */
      }
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [on])

  return null
}
