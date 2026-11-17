import { useEffect, useState } from 'react'
import { kioskEnabled, KIOSK_IDLE } from '../lib/kiosk'

type WakeLockLike = { release: () => Promise<void>; addEventListener?: (t: string, f: () => void) => void }

const IDLE_MS = 2 * 60_000

/**
 * Mode tablette : garde l'écran allumé tant que l'appli est affichée et,
 * après 2 minutes sans toucher l'écran, revient au stock (recherche vidée, en haut de liste).
 */
export function KioskMode({ onIdle }: { onIdle: () => void }) {
  const [on, setOn] = useState(kioskEnabled)

  useEffect(() => {
    const f = () => setOn(kioskEnabled())
    window.addEventListener('miamm-kiosk', f)
    return () => window.removeEventListener('miamm-kiosk', f)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('kiosk', on)
    if (!on) return
    let lock: WakeLockLike | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }
    const acquire = async () => {
      if (document.hidden || !nav.wakeLock) return
      try {
        lock = await nav.wakeLock.request('screen')
      } catch {
        /* refusé (batterie faible…) : on réessaiera au prochain retour */
      }
    }
    void acquire()
    // Le verrou saute quand l'appli passe en arrière-plan : on le reprend au retour.
    const onVis = () => void (document.hidden ? null : acquire())
    document.addEventListener('visibilitychange', onVis)

    let timer = window.setTimeout(idle, IDLE_MS)
    function idle() {
      window.dispatchEvent(new Event(KIOSK_IDLE))
      onIdle()
      window.scrollTo({ top: 0 })
    }
    const poke = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(idle, IDLE_MS)
    }
    const evs = ['pointerdown', 'keydown', 'scroll', 'wheel'] as const
    for (const e of evs) window.addEventListener(e, poke, { passive: true })
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      for (const e of evs) window.removeEventListener(e, poke)
      window.clearTimeout(timer)
      void lock?.release().catch(() => {})
      document.documentElement.classList.remove('kiosk')
    }
  }, [on, onIdle])

  return null
}
