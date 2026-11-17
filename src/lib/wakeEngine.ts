/**
 * Mot de réveil « Miam miam » avec la reconnaissance vocale de Chrome (tablette en mode cuisine).
 * Chrome écoute en continu ; il coupe régulièrement, on relance aussitôt (bip système à masquer
 * dans les réglages de son d'Android).
 *
 * « Miam miam » seul ouvre l'assistant à l'écoute ; « Miam miam, ajoute du lait » envoie directement
 * la commande. Pendant que l'assistant écoute ou que Miam miam parle, l'écoute de réveil est coupée.
 */

type Ev = { type: 'wake' | 'heard' | 'state'; text?: string; state?: string }
type Listener = (e: Ev) => void

const SR: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined

let rec: any = null
let running = false
let handedOff = false
let paused = false
let restartTimer: ReturnType<typeof setTimeout> | undefined
let status = 'off'
let lastError = ''
let fails = 0
const listeners = new Set<Listener>()

function emit(e: Ev) {
  if (e.type === 'state' && e.state) status = e.state
  listeners.forEach((l) => l(e))
}

export function onWake(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function wakeStatus() {
  return { status, error: lastError }
}

export function wakeRunning() {
  return running && !handedOff
}

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
// « miam miam », et ses transcriptions approchantes courantes.
const WAKE = /\b(?:miam|myam|niam|mia)[\s,.-]*(?:miam|myam|niam)\b/

function loop() {
  if (!running || handedOff || !SR) return
  if (paused || document.visibilityState !== 'visible') {
    restartTimer = setTimeout(loop, 700)
    return
  }
  const r = new SR()
  r.lang = 'fr-FR'
  r.continuous = true
  r.interimResults = true
  r.maxAlternatives = 2
  let woke = false
  r.onresult = (e: any) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i]
      const alts: string[] = []
      for (let j = 0; j < res.length; j++) alts.push(res[j].transcript)
      const best = alts[0] ?? ''
      emit({ type: 'heard', text: best })
      const hit = alts.some((a) => WAKE.test(norm(a)))
      if (!hit) continue
      if (!woke) {
        woke = true
        emit({ type: 'state', state: 'woke' })
      }
      // On attend la fin du segment pour savoir si une commande suit « miam miam ».
      if (res.isFinal) {
        const n = norm(best)
        const m = n.match(WAKE)
        let after = ''
        if (m && m.index !== undefined) after = best.slice(m.index + m[0].length).replace(/^[\s,.!-]+/, '').trim()
        stopRec()
        handedOff = true
        emit({ type: 'wake', text: after.length > 3 ? after : '' })
        return
      }
    }
  }
  r.onerror = (e: any) => {
    const code = e?.error ?? ''
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      lastError = code === 'not-allowed' ? 'micro refusé' : 'reconnaissance indisponible'
      emit({ type: 'state', state: 'error' })
      running = false
      return
    }
    if (code !== 'no-speech' && code !== 'aborted') fails++
  }
  r.onend = () => {
    if (rec === r) rec = null
    if (!running || handedOff) return
    // Fin de session Chrome : on relance (plus lentement s'il enchaîne les erreurs).
    restartTimer = setTimeout(loop, fails > 3 ? 4000 : 250)
  }
  rec = r
  try {
    r.start()
    fails = 0
    emit({ type: 'state', state: 'ready' })
  } catch {
    rec = null
    restartTimer = setTimeout(loop, 1500)
  }
}

function stopRec() {
  clearTimeout(restartTimer)
  const r = rec
  rec = null
  if (r) {
    try {
      r.onend = null
      r.onresult = null
      r.abort()
    } catch {
      /* déjà arrêté */
    }
  }
}

export function startWake() {
  if (!SR || running) return
  running = true
  handedOff = false
  lastError = ''
  loop()
}

export function stopWake() {
  running = false
  handedOff = false
  stopRec()
  emit({ type: 'state', state: 'off' })
}

/** L'assistant prend la reconnaissance (une seule à la fois dans Chrome). */
export function handOffToBrowser() {
  if (!running) return
  handedOff = true
  stopRec()
}

/** L'assistant a fini : on se remet à attendre « Miam miam ». */
export function takeBackFromBrowser() {
  if (!running || !handedOff) return
  handedOff = false
  clearTimeout(restartTimer)
  restartTimer = setTimeout(loop, 600)
}

/** Pause pendant que Miam miam parle (pour ne pas s'entendre lui-même). */
export function setWakePaused(p: boolean) {
  paused = p
  if (p) stopRec()
  else if (running && !handedOff && !rec) {
    clearTimeout(restartTimer)
    restartTimer = setTimeout(loop, 300)
  }
}

if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && running && !handedOff && !rec) loop()
  })
