/**
 * Reconnaissance vocale 100 % locale (Vosk, modèle français léger) pour la tablette :
 * aucun bip Android, rien d'envoyé à Google.
 *
 * Deux modes sur le même micro :
 *  - « wake » : un reconnaisseur limité à « miam miam » écoute en continu ;
 *  - « command » : après le mot de réveil (ou le bouton micro), un reconnaisseur libre transcrit
 *    la phrase jusqu'au silence, puis l'envoie à l'assistant.
 *
 * Le modèle (~40 Mo) est servi par le NAS et mis en cache par le navigateur après le premier chargement.
 */
import type { Model, KaldiRecognizer } from 'vosk-browser'

const MODEL_URL = `${import.meta.env.BASE_URL}vosk/fr-small.tar.gz`

type Mode = 'off' | 'wake' | 'command'
type Listener = (e: {
  type: 'partial' | 'final' | 'wake' | 'state' | 'error' | 'level' | 'heard'
  text?: string
  state?: string
  level?: number
}) => void

let model: Model | null = null
let wakeRec: KaldiRecognizer | null = null
let cmdRec: KaldiRecognizer | null = null
let ctx: AudioContext | null = null
let stream: MediaStream | null = null
let node: ScriptProcessorNode | null = null
let mode: Mode = 'off'
let paused = false
let silenceTimer: ReturnType<typeof setTimeout> | undefined
let cmdTimeout: ReturnType<typeof setTimeout> | undefined
let lastPartial = ''
let finalAsked = false
let finalWait: ReturnType<typeof setTimeout> | undefined
let status = 'off'
let lastError = ''
let lastLevelAt = 0
/** État lisible du moteur (affiché dans les Paramètres pour diagnostiquer). */
export function voskStatus() {
  return { status, error: lastError, audio: ctx?.state ?? 'none', rate: ctx?.sampleRate ?? 0 }
}
const listeners = new Set<Listener>()

const emit: Listener = (e) => {
  if (e.type === 'state' && e.state) status = e.state
  if (e.type === 'error') {
    status = 'error'
    lastError = e.text ?? ''
  }
  listeners.forEach((l) => l(e))
}

export function onVosk(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function voskActive() {
  return mode !== 'off'
}

const isWake = (t: string) => /\bmiam\b/.test(t.toLowerCase())
let ignoreWakeUntil = 0

/** Ramène le son à 16 kHz : 3 fois moins de calcul pour le moteur (le modèle est entraîné en 16 kHz). */
const TARGET = 16000
function downsample(input: Float32Array, rate: number): Float32Array {
  if (rate === TARGET) return input
  const ratio = rate / TARGET
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = sum / Math.max(1, end - start)
  }
  return out
}

function finishCommand(text: string) {
  clearTimeout(silenceTimer)
  clearTimeout(cmdTimeout)
  clearTimeout(finalWait)
  finalAsked = false
  if (mode !== 'command') return
  mode = 'wake'
  lastPartial = ''
  emit({ type: 'final', text: text.trim() })
}

/** Démarre le moteur (chargement du modèle + micro). Renvoie false si impossible. */
export async function startVosk(): Promise<boolean> {
  if (mode !== 'off') return true
  try {
    emit({ type: 'state', state: 'loading' })
    const { createModel } = await import('vosk-browser')
    model = model ?? (await createModel(MODEL_URL, -1))
    emit({ type: 'state', state: 'mic' })
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    })
    ctx = new AudioContext()
    const rate = TARGET

    wakeRec = new model.KaldiRecognizer(rate, JSON.stringify(['miam miam', 'miam', '[unk]']))
    const triggerWake = () => {
      if (mode !== 'wake' || paused || Date.now() < ignoreWakeUntil) return
      mode = 'command'
      // On vide le reconnaisseur de réveil pour ne pas redéclencher sur le même « miam ».
      ignoreWakeUntil = Date.now() + 1500
      wakeRec?.retrieveFinalResult()
      emit({ type: 'wake' })
      armCommandTimeout()
    }
    // Réveil dès le résultat partiel (sans attendre la fin de la phrase).
    wakeRec.on('partialresult', (m: any) => {
      const p = (m.result?.partial ?? '').trim()
      if (p) emit({ type: 'heard', text: p })
      if (/\bmiam\b/.test(p)) triggerWake()
    })
    wakeRec.on('result', (m: any) => {
      const t = (m.result?.text ?? '').trim()
      if (t) emit({ type: 'heard', text: t })
      if (isWake(t)) triggerWake()
    })
    cmdRec = new model.KaldiRecognizer(rate)
    cmdRec.on('partialresult', (m: any) => {
      if (mode !== 'command') return
      const p = (m.result?.partial ?? '').trim()
      if (p && p !== lastPartial) {
        lastPartial = p
        emit({ type: 'partial', text: p })
        // Fin de phrase : 1,4 s sans nouveau mot.
        clearTimeout(silenceTimer)
        silenceTimer = setTimeout(askFinal, 1100)
      }
    })
    cmdRec.on('result', (m: any) => {
      if (mode !== 'command') return
      const t = ((m.result?.text ?? '') as string).trim() || lastPartial
      if (t) finishCommand(t)
      else if (finalAsked) finishCommand('')
    })

    const src = ctx.createMediaStreamSource(stream)
    node = ctx.createScriptProcessor(2048, 1, 1)
    node.onaudioprocess = (ev) => {
      // Niveau du micro (diagnostic), 5 fois par seconde.
      const now = Date.now()
      if (now - lastLevelAt > 200) {
        lastLevelAt = now
        const d = ev.inputBuffer.getChannelData(0)
        let sum = 0
        for (let i = 0; i < d.length; i += 4) sum += d[i] * d[i]
        emit({ type: 'level', level: Math.sqrt(sum / (d.length / 4)) })
      }
      if (paused) return
      try {
        const pcm = downsample(ev.inputBuffer.getChannelData(0), ev.inputBuffer.sampleRate)
        if (mode === 'wake') wakeRec?.acceptWaveformFloat(pcm, TARGET)
        else if (mode === 'command') cmdRec?.acceptWaveformFloat(pcm, TARGET)
      } catch {
        /* tampon perdu */
      }
    }
    src.connect(node)
    // Certains navigateurs ne font tourner le processeur que s'il est relié à la sortie (sans son).
    const mute = ctx.createGain()
    mute.gain.value = 0
    node.connect(mute)
    mute.connect(ctx.destination)
    mode = 'wake'
    // Sans geste de l'utilisateur, le navigateur garde l'audio en veille : on le réveille au premier toucher.
    const wake = () => {
      if (ctx && ctx.state !== 'running') void ctx.resume().then(() => emit({ type: 'state', state: 'ready' }))
    }
    for (const ev of ['pointerdown', 'touchstart', 'click', 'keydown'])
      window.addEventListener(ev, wake, { capture: true, passive: true })
    document.addEventListener('visibilitychange', wake)
    void ctx.resume().catch(() => {})
    if (ctx.state === 'suspended') emit({ type: 'state', state: 'suspended' })
    if (ctx.state === 'running') emit({ type: 'state', state: 'ready' })
    return true
  } catch (e) {
    emit({ type: 'error', text: e instanceof Error ? e.message : 'Moteur vocal indisponible' })
    stopVosk()
    return false
  }
}

/** Demande le résultat final ; la tablette peut avoir du retard à traiter le son, on lui laisse 3 s. */
function askFinal() {
  if (mode !== 'command' || finalAsked) return
  finalAsked = true
  cmdRec?.retrieveFinalResult()
  clearTimeout(finalWait)
  finalWait = setTimeout(() => finishCommand(lastPartial), 3000)
}

function armCommandTimeout() {
  lastPartial = ''
  finalAsked = false
  clearTimeout(cmdTimeout)
  clearTimeout(finalWait)
  // Délai maximal pour une phrase.
  cmdTimeout = setTimeout(askFinal, 10000)
}

/** Passe directement en écoute d'une commande (bouton micro). */
export function listenCommand() {
  if (mode === 'off') return false
  void ctx?.resume()
  paused = false
  mode = 'command'
  armCommandTimeout()
  return true
}

/** Arrête la commande en cours (fenêtre fermée). */
export function cancelCommand() {
  clearTimeout(silenceTimer)
  clearTimeout(cmdTimeout)
  if (mode === 'command') mode = 'wake'
  lastPartial = ''
}

/** Pause pendant que Miam miam parle (pour ne pas s'entendre lui-même). */
export function setVoskPaused(p: boolean) {
  paused = p
}

export function stopVosk() {
  clearTimeout(silenceTimer)
  clearTimeout(cmdTimeout)
  mode = 'off'
  try {
    node?.disconnect()
  } catch {
    /* rien */
  }
  node = null
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  void ctx?.close().catch(() => {})
  ctx = null
  try {
    wakeRec?.remove()
    cmdRec?.remove()
  } catch {
    /* rien */
  }
  wakeRec = cmdRec = null
}
