/** Mode tablette : appareil posé dans la cuisine, écran toujours allumé, affichage en tuiles. Réglage par appareil. */
const KEY = 'miamm.kiosk'

export function kioskEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setKiosk(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('miamm-kiosk'))
}

/** Événement envoyé après une période d'inactivité : les écrans reviennent à leur état d'accueil. */
export const KIOSK_IDLE = 'miamm-kiosk-idle'

/** Réveil vocal « Miam miam » (tablette en mode cuisine). Réglage par appareil. */
const WAKE_KEY = 'miamm.wake'
export function wakeEnabled(): boolean {
  try {
    return localStorage.getItem(WAKE_KEY) === '1'
  } catch {
    return false
  }
}
export function setWake(on: boolean) {
  try {
    if (on) localStorage.setItem(WAKE_KEY, '1')
    else localStorage.removeItem(WAKE_KEY)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('miamm-wake'))
}

/** Mise en veille de l'écran (mode tablette) : minutes sans toucher avant d'estomper, 0 = jamais. */
const DIM_KEY = 'miamm.dim'
export function dimMinutes(): number {
  try {
    const v = localStorage.getItem(DIM_KEY)
    return v === null ? 5 : Math.max(0, Number(v) || 0)
  } catch {
    return 5
  }
}
export function setDimMinutes(m: number) {
  try {
    localStorage.setItem(DIM_KEY, String(m))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('miamm-dim'))
}
