/**
 * Caméra partagée : un seul flux réutilisé entre les écrans de scan, pour limiter les demandes
 * d'autorisation d'iOS (une par ouverture de l'appli au lieu d'une par scan).
 * En quittant un scanner, la caméra est seulement désactivée (voyant éteint) ; elle est
 * vraiment arrêtée après quelques minutes d'inactivité.
 */
let stream: MediaStream | null = null
let idleTimer: number | undefined

const IDLE_MS = 5 * 60 * 1000

function alive(s: MediaStream | null): s is MediaStream {
  return !!s && s.getVideoTracks().some((t) => t.readyState === 'live')
}

export async function acquireCamera(): Promise<MediaStream> {
  window.clearTimeout(idleTimer)
  if (alive(stream)) {
    stream.getVideoTracks().forEach((t) => (t.enabled = true))
    return stream
  }
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
  })
  return stream
}

export function releaseCamera() {
  if (!stream) return
  stream.getVideoTracks().forEach((t) => (t.enabled = false))
  window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(hardStopCamera, IDLE_MS)
}

export function hardStopCamera() {
  window.clearTimeout(idleTimer)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}
