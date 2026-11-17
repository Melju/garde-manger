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
