import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

const ITEM_W = 48 // largeur d'un cran (doit correspondre au CSS)

interface SwipeWheelProps {
  values: number[]
  format: (v: number) => string
  onConfirm: (value: number) => void
  initialIndex?: number
}

/**
 * Molette horizontale « réglette » intégrée dans la barre de swipe.
 * On fait défiler les crans (aimantation), la valeur centrale se valide
 * d'un appui sur le bouton ✓ (ou en tapant directement le cran voulu).
 */
export function SwipeWheel({ values, format, onConfirm, initialIndex = 0 }: SwipeWheelProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const raf = useRef<number | null>(null)
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, values.length - 1)))

  useEffect(() => {
    trackRef.current?.scrollTo({ left: index * ITEM_W })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onScroll() {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = trackRef.current
      if (!el) return
      const i = Math.round(el.scrollLeft / ITEM_W)
      setIndex(Math.max(0, Math.min(values.length - 1, i)))
    })
  }

  function tap(i: number) {
    setIndex(i)
    trackRef.current?.scrollTo({ left: i * ITEM_W, behavior: 'smooth' })
  }

  return (
    <div className="swipe-wheel">
      <div className="sw-window">
        <div className="sw-center" />
        <div className="sw-track" ref={trackRef} onScroll={onScroll}>
          {values.map((v, i) => (
            <button
              key={i}
              type="button"
              className={`sw-item${i === index ? ' active' : ''}`}
              onClick={() => tap(i)}
            >
              {format(v)}
            </button>
          ))}
        </div>
      </div>
      <button className="sw-go" onClick={() => onConfirm(values[index])} aria-label="Valider">
        <Icon name="check" width={1.4} />
      </button>
    </div>
  )
}
