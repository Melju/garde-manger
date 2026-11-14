/**
 * Caméra : active uniquement pendant un scan. En quittant un scanner, le flux est coupé
 * tout de suite (plus aucune capture en arrière-plan). Un nouveau scan redemande le flux.
 */
let stream: MediaStream | null = null
let idleTimer: number | undefined

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
