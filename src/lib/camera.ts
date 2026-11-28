/**
 * Caméra : active uniquement pendant un scan. En quittant un scanner, le flux est coupé
 * tout de suite (plus aucune capture en arrière-plan). Un nouveau scan redemande le flux.
 *
 * Choix de l'objectif : sur les Android à plusieurs caméras arrière (Samsung S21/S22…),
 * « environment » peut ouvrir l'ultra grand-angle, à mise au point fixe : un code-barres
 * vu de près reste flou et ne se lit jamais. On retient donc la caméra arrière principale
 * (« camera2 0 » chez Samsung), avec mise au point continue quand elle est disponible.
 */
let stream: MediaStream | null = null
let idleTimer: number | undefined
const LS_CAM = 'miamm.cameraId'

function alive(s: MediaStream | null): s is MediaStream {
  return !!s && s.getVideoTracks().some((t) => t.readyState === 'live')
}

async function backCameras(): Promise<MediaDeviceInfo[]> {
  const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
  const back = all.filter((d) => /back|rear|arri|environment|camera2 [0-9]/i.test(d.label) && !/front|avant|user/i.test(d.label))
  return back.length ? back : all
}

/** Caméra arrière principale : on écarte ultra grand-angle et téléobjectif, et chez Samsung le plus petit index. */
function pickMain(cams: MediaDeviceInfo[]): MediaDeviceInfo | undefined {
  const plain = cams.filter((d) => !/ultra|wide|grand|tele|télé|macro|depth|zoom/i.test(d.label))
  const pool = plain.length ? plain : cams
  const idx = (d: MediaDeviceInfo) => Number(/camera2 (\d+)/i.exec(d.label)?.[1] ?? 99)
  return [...pool].sort((a, b) => idx(a) - idx(b))[0]
}

async function tune(s: MediaStream) {
  const track = s.getVideoTracks()[0]
  const caps: any = track?.getCapabilities?.() ?? {}
  const adv: any = {}
  if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) adv.focusMode = 'continuous'
  if (Object.keys(adv).length) await track.applyConstraints({ advanced: [adv] } as any).catch(() => {})
}

async function open(deviceId?: string): Promise<MediaStream> {
  const base = { width: { ideal: 1920 }, height: { ideal: 1080 } }
  return navigator.mediaDevices.getUserMedia({
    video: deviceId ? { ...base, deviceId: { exact: deviceId } } : { ...base, facingMode: { ideal: 'environment' } },
  })
}

export async function acquireCamera(): Promise<MediaStream> {
  window.clearTimeout(idleTimer)
  if (alive(stream)) {
    stream.getVideoTracks().forEach((t) => (t.enabled = true))
    return stream
  }
  // 1) Caméra choisie par l'utilisateur, ou retenue la dernière fois.
  const saved = localStorage.getItem(LS_CAM) || ''
  if (saved) {
    try {
      stream = await open(saved)
      await tune(stream)
      return stream
    } catch {
      localStorage.removeItem(LS_CAM)
    }
  }
  // 2) Ouverture classique (donne l'autorisation et les noms des caméras), puis bascule sur la principale.
  stream = await open()
  try {
    const cams = await backCameras()
    const current = stream.getVideoTracks()[0]?.getSettings().deviceId
    const main = cams.length > 1 ? pickMain(cams) : undefined
    if (main && main.deviceId && main.deviceId !== current) {
      stream.getTracks().forEach((t) => t.stop())
      stream = await open(main.deviceId)
    }
    const id = stream.getVideoTracks()[0]?.getSettings().deviceId
    if (id && cams.length > 1) localStorage.setItem(LS_CAM, id)
  } catch {
    /* on garde le flux d'origine */
    if (!alive(stream)) stream = await open()
  }
  await tune(stream)
  return stream
}

/** Nombre de caméras arrière (pour proposer « changer de caméra »). */
export async function countBackCameras(): Promise<number> {
  try {
    return (await backCameras()).length
  } catch {
    return 0
  }
}

/** Passe à la caméra arrière suivante (si la mise au point ne se fait pas sur l'objectif choisi). */
export async function nextCamera(): Promise<MediaStream> {
  const cams = await backCameras()
  const current = stream?.getVideoTracks()[0]?.getSettings().deviceId
  const i = cams.findIndex((c) => c.deviceId === current)
  const next = cams[(i + 1) % cams.length]
  hardStopCamera()
  stream = await open(next?.deviceId)
  const id = stream.getVideoTracks()[0]?.getSettings().deviceId
  if (id) localStorage.setItem(LS_CAM, id)
  await tune(stream)
  return stream
}

export function releaseCamera() {
  hardStopCamera()
}

export function hardStopCamera() {
  window.clearTimeout(idleTimer)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

// Sécurité : si l'appli passe en arrière-plan, la caméra est coupée.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hardStopCamera()
  })
}
