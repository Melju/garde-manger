import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

const HOLD_MS = 450
const SLOP = 10
const TRASH_H = 130

type Drag<T> = { item: T; x: number; y: number; over: boolean }

/**
 * Appui long sur un élément → il se détache sous le doigt et une corbeille apparaît en bas :
 * on le lâche dessus pour le retirer. Un simple appui (tap) garde son comportement habituel,
 * et bouger avant la fin de l'appui long laisse défiler la page normalement.
 */
export function useDragTrash<T>({
  onDrop,
  label,
  thumb,
  idOf,
}: {
  onDrop: (item: T) => void
  label: (item: T) => string
  thumb?: (item: T) => ReactNode
  idOf: (item: T) => string
}) {
  const [drag, setDrag] = useState<Drag<T> | null>(null)
  const ref = useRef<{ timer?: number; sx: number; sy: number; active: boolean; suppress: boolean; cleanup?: () => void }>({
    sx: 0,
    sy: 0,
    active: false,
    suppress: false,
  })

  useEffect(() => () => ref.current.cleanup?.(), [])

  function start(e: React.PointerEvent, item: T) {
    if (e.button !== 0) return
    // Les boutons de la ligne (−, +, corbeille…) gardent leur rôle.
    const t = e.target as HTMLElement
    if (t.closest('button') && t.closest('button') !== e.currentTarget) return
    const s = ref.current
    s.cleanup?.()
    s.sx = e.clientX
    s.sy = e.clientY
    s.active = false

    const isOver = (y: number) => y > window.innerHeight - TRASH_H
    const onMove = (ev: PointerEvent) => {
      if (!s.active) {
        if (Math.hypot(ev.clientX - s.sx, ev.clientY - s.sy) > SLOP) end()
        return
      }
      setDrag({ item, x: ev.clientX, y: ev.clientY, over: isOver(ev.clientY) })
    }
    const onUp = (ev: PointerEvent) => {
      if (s.active) {
        s.suppress = true // le « clic » qui suit le lâcher ne doit pas cocher l'article
        setTimeout(() => (s.suppress = false), 400)
        if (ev.type === 'pointerup' && isOver(ev.clientY)) onDrop(item)
      }
      end()
    }
    // Pendant le glisser, on empêche la page de défiler sous le doigt.
    const onTouchMove = (ev: TouchEvent) => {
      if (s.active && ev.cancelable) ev.preventDefault()
    }
    const end = () => {
      window.clearTimeout(s.timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.removeEventListener('touchmove', onTouchMove)
      s.active = false
      s.cleanup = undefined
      setDrag(null)
    }
    s.cleanup = end
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    s.timer = window.setTimeout(() => {
      s.active = true
      navigator.vibrate?.(15)
      setDrag({ item, x: s.sx, y: s.sy, over: false })
    }, HOLD_MS)
  }

  const bind = (item: T) => ({
    onPointerDown: (e: React.PointerEvent) => start(e, item),
    onClickCapture: (e: React.MouseEvent) => {
      if (ref.current.suppress) {
        e.stopPropagation()
        e.preventDefault()
      }
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    'data-dragtrash': '',
  })

  const isDragging = (item: T) => !!drag && idOf(drag.item) === idOf(item)

  const layer = drag
    ? createPortal(
        <div className="dragtrash-layer" aria-hidden>
          <div className={`dragtrash-zone${drag.over ? ' over' : ''}`}>
            <Icon name="trash" />
            <span>{drag.over ? 'Lâche pour retirer' : 'Glisse ici pour retirer'}</span>
          </div>
          <div className="dragtrash-ghost" style={{ left: drag.x, top: drag.y }}>
            {thumb?.(drag.item)}
            <span>{label(drag.item)}</span>
          </div>
        </div>,
        document.body,
      )
    : null

  return { bind, isDragging, layer }
}
