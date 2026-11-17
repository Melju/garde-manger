import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { kioskEnabled, dimMinutes } from '../lib/kiosk'

/**
 * Mode tablette : après quelques minutes sans toucher l'écran, il s'estompe (fond noir, qui éteint
 * les pixels sur un écran AMOLED comme celui de la Tab S3) avec juste l'heure, qui se déplace
 * doucement pour ne pas marquer l'écran. Un toucher, « Miam miam » ou un ajout d'un autre membre
 * le rallument ; le premier toucher ne fait que réveiller (il ne clique sur rien).
 */
export function ScreenDim() {
  const [enabled, setEnabled] = useState(() => kioskEnabled() && dimMinutes() > 0)
  const [minutes, setMinutes] = useState(dimMinutes)
  const [dim, setDim] = useState(false)
  // Bouclier quelques instants après le réveil : le toucher qui réveille ne clique sur rien dessous.
  const [shield, setShield] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [pos, setPos] = useState({ x: 50, y: 45 })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const f = () => {
      setEnabled(kioskEnabled() && dimMinutes() > 0)
      setMinutes(dimMinutes())
    }
    window.addEventListener('miamm-kiosk', f)
    window.addEventListener('miamm-dim', f)
    return () => {
      window.removeEventListener('miamm-kiosk', f)
      window.removeEventListener('miamm-dim', f)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setDim(false)
      return
    }
    const arm = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        // Pas pendant une fenêtre ouverte (assistant vocal, saisie…).
        if (document.querySelector('.voice-overlay, .cselect-overlay, .confirm-overlay, .drawer-overlay')) arm()
        else setDim(true)
      }, minutes * 60_000)
    }
    const poke = () => {
      setDim(false)
      arm()
    }
    const evs = ['pointerdown', 'keydown', 'wheel'] as const
    for (const e of evs) window.addEventListener(e, poke, { passive: true })
    // Réveil sans toucher : Miam miam, un ajout d'un autre membre, une surprise.
    const wakers = ['miamm-voice', 'miamm-arrivals', 'miamm-egg']
    for (const e of wakers) window.addEventListener(e, poke)
    arm()
    return () => {
      for (const e of evs) window.removeEventListener(e, poke)
      for (const e of wakers) window.removeEventListener(e, poke)
      clearTimeout(timer.current)
    }
  }, [enabled, minutes])

  // Horloge et léger déplacement (toutes les 30 s) pendant la veille.
  useEffect(() => {
    if (!dim) return
    const tick = () => {
      setNow(new Date())
      setPos({ x: 25 + Math.random() * 50, y: 25 + Math.random() * 50 })
    }
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [dim])

  if (!enabled) return null
  return createPortal(
    <div
      className={`screen-dim${dim ? ' on' : ''}${shield ? ' shield' : ''}`}
      aria-hidden={!dim}
      // Le toucher qui réveille ne doit rien déclencher dessous.
      onPointerDown={(e) => {
        if (!dim) return
        e.preventDefault()
        e.stopPropagation()
        setShield(true)
        setDim(false)
        setTimeout(() => setShield(false), 600)
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {dim && (
        <div className="screen-dim-clock" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
          <div className="screen-dim-time">
            {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="screen-dim-date">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div className="screen-dim-hint">Touche l’écran ou dis « Miam miam »</div>
        </div>
      )}
    </div>,
    document.body,
  )
}
