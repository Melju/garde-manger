import { useEffect, useRef, useState } from 'react'

const ITEM_H = 48 // hauteur d'un cran (doit correspondre au CSS)

interface WheelSheetProps {
  title: string
  subtitle?: string
  values: number[]
  /** Libellé affiché pour chaque valeur. */
  format: (v: number) => string
  /** Index sélectionné au départ. */
  initialIndex?: number
  confirmLabel?: string
  onConfirm: (value: number) => void
  onCancel: () => void
}

/**
 * Feuille modale qui remonte du bas avec une molette à aimantation
 * (style sélecteur de date iOS). Sélection au scroll, crans « sweet spots ».
 */
export function WheelSheet({
  title,
  subtitle,
  values,
  format,
  initialIndex = 0,
  confirmLabel = 'Valider',
  onConfirm,
  onCancel,
}: WheelSheetProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const raf = useRef<number | null>(null)
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, values.length - 1)))

  // Positionne la molette sur la valeur initiale à l'ouverture.
  useEffect(() => {
    listRef.current?.scrollTo({ top: index * ITEM_H })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onScroll() {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = listRef.current
      if (!el) return
      const i = Math.round(el.scrollTop / ITEM_H)
      setIndex(Math.max(0, Math.min(values.length - 1, i)))
    })
  }

  function pick(i: number) {
    setIndex(i)
    listRef.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
  }

  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          {subtitle && <div className="sheet-sub">{subtitle}</div>}
        </div>

        <div className="wheel">
          <div className="wheel-mask" />
          <div className="wheel-selection" />
          <div className="wheel-list" ref={listRef} onScroll={onScroll}>
            {values.map((v, i) => (
              <button
                key={i}
                type="button"
                className={`wheel-item${i === index ? ' active' : ''}`}
                onClick={() => pick(i)}
              >
                {format(v)}
              </button>
            ))}
          </div>
        </div>

        <div className="btn-row">
          <button className="btn-secondary" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn-primary" onClick={() => onConfirm(values[index])}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
