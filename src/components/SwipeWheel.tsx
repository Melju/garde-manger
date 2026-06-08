import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

interface SwipeWheelProps {
  values: number[]
  /** Libellé de la valeur (affiché au-dessus du centre). */
  format: (v: number) => string
  /** Vrai si la valeur mérite une étiquette sous la graduation. */
  isMajor: (v: number) => boolean
  onConfirm: (value: number) => void
  initialIndex?: number
  /** Largeur d'un cran en px (fine pour la précision). */
  itemW?: number
}

/**
 * Réglette graduée horizontale intégrée à la barre de swipe.
 * Graduation fine (précision au cran), étiquettes sur les valeurs rondes,
 * valeur exacte affichée au centre, validation par ✓.
 */
export function SwipeWheel({
  values,
  format,
  isMajor,
  onConfirm,
  initialIndex = 0,
  itemW = 26,
}: SwipeWheelProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const raf = useRef<number | null>(null)
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, values.length - 1)))

  useEffect(() => {
    trackRef.current?.scrollTo({ left: index * itemW })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onScroll() {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = trackRef.current
      if (!el) return
      const i = Math.round(el.scrollLeft / itemW)
      setIndex(Math.max(0, Math.min(values.length - 1, i)))
    })
  }

  return (
    <div className="swipe-wheel">
      <div className="sw-window">
        <div className="sw-readout">{format(values[index])}</div>
        <div className="sw-center" />
        <div
          className="sw-track"
          ref={trackRef}
          onScroll={onScroll}
          style={{ ['--iw' as string]: `${itemW}px` }}
        >
          {values.map((v, i) => {
            const major = isMajor(v)
            return (
              <div key={i} className={`sw-tick${i === index ? ' active' : ''}${major ? ' major' : ''}`}>
                <span className="sw-mark" />
                {major && <span className="sw-lab">{format(v)}</span>}
              </div>
            )
          })}
        </div>
      </div>
      <button className="sw-go" onClick={() => onConfirm(values[index])} aria-label="Valider">
        <Icon name="check" width={1.4} />
      </button>
    </div>
  )
}
