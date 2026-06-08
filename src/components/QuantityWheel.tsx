import { useEffect, useRef } from 'react'

const ITEM_W = 56 // largeur d'un cran (doit correspondre au CSS)

interface QuantityWheelProps {
  values: number[]
  value: number
  onChange: (value: number) => void
  /** Libellé d'un cran (ex : « 500 g », « 1 L », « ×3 »). */
  format: (v: number) => string
}

/**
 * Roulette horizontale (réglette) pour choisir une quantité, thème neutre.
 * Les paliers et leur libellé sont fournis (adaptatifs : nombre, poids, volume).
 */
export function QuantityWheel({ values, value, onChange, format }: QuantityWheelProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const raf = useRef<number | null>(null)

  const index = Math.max(0, values.indexOf(value))

  // Recale la position quand la valeur/les paliers changent de l'extérieur.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const target = index * ITEM_W
    if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, values.length])

  function onScroll() {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = trackRef.current
      if (!el) return
      const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollLeft / ITEM_W)))
      const v = values[i]
      if (v !== value) onChange(v)
    })
  }

  function tap(i: number) {
    onChange(values[i])
    trackRef.current?.scrollTo({ left: i * ITEM_W, behavior: 'smooth' })
  }

  return (
    <div className="qwheel">
      <div className="qwheel-center" />
      <div className="qwheel-track" ref={trackRef} onScroll={onScroll}>
        {values.map((v, i) => (
          <button
            key={v}
            type="button"
            className={`qwheel-item${v === value ? ' active' : ''}`}
            onClick={() => tap(i)}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  )
}
