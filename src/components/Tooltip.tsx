import { useEffect, useRef, useState } from 'react'

/**
 * Info-bulle personnalisée au survol (ordinateur uniquement).
 * Remplace l'info-bulle native des attributs title et affiche aussi aria-label
 * sur les boutons à icône sans texte visible.
 */
function tipSource(el: Element | null): { el: HTMLElement; text: string } | null {
  let n: Element | null = el
  while (n && n !== document.body) {
    if (n instanceof HTMLElement) {
      const t = n.getAttribute('title') || n.getAttribute('data-tip')
      if (t && t.trim()) return { el: n, text: t.trim() }
      const aria = n.getAttribute('aria-label')
      const isBtn = n.tagName === 'BUTTON' || n.tagName === 'A' || n.getAttribute('role') === 'button'
      if (aria && isBtn && !(n.textContent ?? '').trim()) return { el: n, text: aria.trim() }
    }
    n = n.parentElement
  }
  return null
}

export function Tooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const current = useRef<HTMLElement | null>(null)
  const saved = useRef<string | null>(null)

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    function restore() {
      if (current.current && saved.current != null) current.current.setAttribute('title', saved.current)
      current.current = null
      saved.current = null
    }
    function hide() {
      window.clearTimeout(timer.current)
      setTip(null)
      restore()
    }
    function over(e: MouseEvent) {
      const src = tipSource(e.target as Element)
      if (!src) {
        if (current.current) hide()
        return
      }
      if (src.el === current.current) return
      hide()
      current.current = src.el
      const t = src.el.getAttribute('title')
      if (t != null) {
        saved.current = t
        src.el.removeAttribute('title') // supprime l'info-bulle native
      }
      timer.current = window.setTimeout(() => {
        const r = src.el.getBoundingClientRect()
        const below = r.top < 56
        setTip({
          text: src.text,
          x: Math.min(Math.max(r.left + r.width / 2, 12), window.innerWidth - 12),
          y: below ? r.bottom + 8 : r.top - 8,
          below,
        })
      }, 350)
    }
    document.addEventListener('mouseover', over)
    document.addEventListener('mousedown', hide)
    document.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      document.removeEventListener('mouseover', over)
      document.removeEventListener('mousedown', hide)
      document.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
      hide()
    }
  }, [])

  if (!tip) return null
  return (
    <div
      className={`tooltip${tip.below ? ' below' : ''}`}
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
    </div>
  )
}
