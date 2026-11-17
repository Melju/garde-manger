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
export function openVoice(opts?: { autoListen?: boolean }) {
  window.dispatchEvent(new CustomEvent('miamm-voice', { detail: { autoListen: opts?.autoListen ?? true } }))
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
export const VOICE_SUPPORTED = !!SR && !IS_IOS

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
  const [phase, setPhase] = useState<'listen' | 'think' | 'review'>('listen')
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
    setOpen(false)
  }

  const listen = () => {
    if (!VOICE_SUPPORTED) {
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
    rec.onerror = () => setListening(false)
    // Fin de phrase (silence) : on envoie directement.
    rec.onend = () => {
      setListening(false)
      recRef.current = null
      if (textRef.current.trim()) void understand(textRef.current)
    }
    recRef.current = rec
    setText('')
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  useEffect(() => {
    const on = (e: Event) => {
      const auto = (e as CustomEvent<{ autoListen?: boolean }>).detail?.autoListen ?? true
      setOpen(true)
      setPhase('listen')
      setText('')
      setRows([])
      setUnknown([])
      setError('')
      if (auto && VOICE_SUPPORTED) setTimeout(listen, 120)
      else setTimeout(() => inputRef.current?.focus(), 150)
    }
    window.addEventListener('miamm-voice', on)
    return () => window.removeEventListener('miamm-voice', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setUnknown(((data as any)?.unknown ?? []) as string[])
    setRows(acts.map((a) => ({ act: a, on: true })))
    setPhase('review')
  }

  // ----- Application, avec de quoi annuler -----
  async function apply() {
    if (busy) return
    setBusy(true)
    const undo: (() => Promise<void>)[] = []
    const t0 = new Date().toISOString()
    let done = 0
    try {
      for (const r of rows) {
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
        done++
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Une action a échoué')
    } finally {
      setBusy(false)
    }
    close()
    if (done)
      toast(`${done} action${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''}`, {
        label: 'Annuler',
        onClick: async () => {
          for (const u of undo.reverse()) {
            try {
              await u()
            } catch {
              /* au mieux */
            }
          }
          toast('Annulé')
        },
      })
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
        {phase !== 'review' ? (
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
                  : VOICE_SUPPORTED
                    ? 'Touche le micro et parle'
                    : 'Écris ou dicte avec le micro du clavier'}
            </div>
            <textarea
              ref={inputRef}
              className="voice-text"
              rows={2}
              placeholder="« Ajoute du lait aux courses », « enlève 200 g de comté »…"
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
 * Mot de réveil « Miam miam » : écoute en continu (tablette en mode cuisine uniquement, option à activer),
 * et ouvre l'assistant quand on le prononce. S'arrête quand l'assistant est ouvert ou l'écran caché.
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
    if (!on || !VOICE_SUPPORTED) return
    let rec: any = null
    let stopped = false
    let paused = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let fails = 0
    const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const HIT = /\b(miam|myam|mia|niam)[\s-]*(miam|myam|niam|mia)\b|\bmiam miam\b/

    const start = () => {
      if (stopped || paused || document.visibilityState !== 'visible') return
      rec = new SR()
      rec.lang = 'fr-FR'
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (HIT.test(norm(e.results[i][0].transcript))) {
            paused = true
            try {
              rec.onend = null
              rec.abort()
            } catch {
              /* déjà arrêté */
            }
            openVoice({ autoListen: true })
            return
          }
        }
      }
      rec.onerror = (e: any) => {
        // Micro refusé : on n'insiste pas.
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') stopped = true
        fails++
      }
      rec.onend = () => {
        rec = null
        // Le navigateur coupe l'écoute régulièrement : on relance (plus lentement après des erreurs).
        timer = setTimeout(start, fails > 3 ? 5000 : 400)
      }
      try {
        rec.start()
        fails = 0
      } catch {
        timer = setTimeout(start, 2000)
      }
    }
    const halt = () => {
      clearTimeout(timer)
      if (rec) {
        try {
          rec.onend = null
          rec.abort()
        } catch {
          /* déjà arrêté */
        }
        rec = null
      }
    }
    // L'assistant ouvert prend le micro ; on reprend quand il se ferme.
    const obs = new MutationObserver(() => {
      const busy = !!document.querySelector('.voice-overlay')
      if (busy && !paused) {
        paused = true
        halt()
      } else if (!busy && paused) {
        paused = false
        timer = setTimeout(start, 800)
      }
    })
    obs.observe(document.body, { childList: true })
    const onVis = () => {
      if (document.visibilityState === 'visible') start()
      else halt()
    }
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => {
      stopped = true
      halt()
      obs.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [on])

  return null
}
