import { useEffect, useRef } from 'react'

const ITEM_W = 40 // largeur d'un cran (doit correspondre au CSS)

interface QuantityWheelProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

/**
 * Roulette horizontale (réglette) pour choisir une quantité, façon dashboard,
 * mais en thème neutre. Reporte la valeur centrale en continu (pas de bouton).
 */
export function QuantityWheel({ value, onChange, min = 1, max = 30 }: QuantityWheelProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const raf = useRef<number | null>(null)
  const values: number[] = []
  for (let v = min; v <= max; v++) values.push(v)

  // Recale la position quand la valeur est pilotée de l'extérieur (ex : reset à 1).
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const target = (value - min) * ITEM_W
    if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function onScroll() {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = trackRef.current
      if (!el) return
      const i = Math.round(el.scrollLeft / ITEM_W)
      const v = Math.max(min, Math.min(max, min + i))
      if (v !== value) onChange(v)
    })
  }

  function tap(v: number) {
    onChange(v)
    trackRef.current?.scrollTo({ left: (v - min) * ITEM_W, behavior: 'smooth' })
  }

  return (
    <div className="qwheel">
      <div className="qwheel-center" />
      <div className="qwheel-track" ref={trackRef} onScroll={onScroll}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className={`qwheel-item${v === value ? ' active' : ''}`}
            onClick={() => tap(v)}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}
