import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../data/auth'
import type { Category } from '../types'
import { categoryColor } from '../lib/categoryColors'
import { productIconKey } from '../lib/productIcon'
import { productImageSlug, chosenIconSlug, productImageUrl } from '../lib/productImage'
import { FoodIcon, hasFoodIcon } from './FoodIcon'
import { Icon, categoryIcon } from './Icon'

type Arrival = { name: string; category: string; by?: string; imageUrl?: string }
type Item = { name: string; category: string; imageUrl?: string; count: number }
type Batch = { key: number; who: string; items: Item[] }

const STEP_MS = 1400
const CONFETTI = Array.from({ length: 14 }, (_, i) => i)

function Visual({ item, size }: { item: Item; size: 'hero' | 'chip' }) {
  const col = categoryColor(item.category)
  const slug = chosenIconSlug(item.imageUrl) ?? productImageSlug(item.name)
  const key = productIconKey(item.name)
  return (
    <span className={`arr-visual arr-${size}`} style={{ background: col.bg, color: col.fg }}>
      {slug ? (
        <img src={productImageUrl(slug)} alt="" draggable={false} />
      ) : key && hasFoodIcon(key) ? (
        <FoodIcon name={key} />
      ) : (
        <Icon name={categoryIcon(item.category as Category)} width={1.7} />
      )}
    </span>
  )
}

/**
 * Popup centré et animé « Steph vient d'ajouter … » quand un autre membre du foyer
 * ajoute des produits au stock : les aliments défilent un à un avec une petite explosion de confettis.
 */
export function ArrivalsPopup() {
  const { members } = useAuth()
  const [batch, setBatch] = useState<Batch | null>(null)
  const [idx, setIdx] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const membersRef = useRef(members)
  membersRef.current = members

  const close = () => {
    clearTimeout(closeTimer.current)
    setLeaving(true)
    closeTimer.current = setTimeout(() => {
      setBatch(null)
      setLeaving(false)
    }, 380)
  }

  useEffect(() => {
    const onArrivals = (e: Event) => {
      const list = (e as CustomEvent<Arrival[]>).detail
      if (!list?.length) return
      const by = list[0].by
      const raw = membersRef.current.find((m) => m.id === by)?.name?.trim() || 'Quelqu’un'
      const who = raw.charAt(0).toUpperCase() + raw.slice(1)
      setBatch((prev) => {
        const same = prev && prev.who === who
        const merged = new Map<string, Item>()
        if (same) for (const it of prev.items) merged.set(it.name.toLowerCase(), { ...it })
        for (const a of list) {
          const k = a.name.toLowerCase()
          const cur = merged.get(k)
          if (cur) cur.count += 1
          else merged.set(k, { name: a.name, category: a.category, imageUrl: a.imageUrl, count: 1 })
        }
        if (!same) setIdx(0)
        return { key: same ? prev.key : Date.now(), who, items: [...merged.values()] }
      })
      setLeaving(false)
    }
    window.addEventListener('miamm-arrivals', onArrivals)
    return () => window.removeEventListener('miamm-arrivals', onArrivals)
  }, [])

  // Défilement des aliments, puis fermeture automatique quelques secondes après le dernier.
  useEffect(() => {
    if (!batch || leaving) return
    clearTimeout(closeTimer.current)
    if (idx < batch.items.length - 1) {
      const t = setTimeout(() => setIdx((i) => i + 1), STEP_MS)
      return () => clearTimeout(t)
    }
    closeTimer.current = setTimeout(close, 3500)
    return () => clearTimeout(closeTimer.current)
  }, [batch, idx, leaving])

  if (!batch) return null
  const current = batch.items[Math.min(idx, batch.items.length - 1)]
  const total = batch.items.reduce((s, it) => s + it.count, 0)

  return (
    <div className={`arr-overlay${leaving ? ' leaving' : ''}`} onClick={close} role="status">
      <div className="arr-card" key={batch.key}>
        <div className="arr-stage">
          <div className="arr-burst" key={`b${idx}`} aria-hidden="true">
            {CONFETTI.map((i) => (
              <i key={i} style={{ ['--a' as string]: `${(360 / CONFETTI.length) * i}deg`, ['--c' as string]: i % 3 }} />
            ))}
          </div>
          <div className="arr-hero" key={`h${idx}`}>
            <Visual item={current} size="hero" />
            {current.count > 1 && <span className="arr-badge">×{current.count}</span>}
          </div>
        </div>
        <div className="arr-who">{batch.who} vient d’ajouter</div>
        <div className="arr-name" key={`n${idx}`}>
          {current.name}
        </div>
        {batch.items.length > 1 && (
          <div className="arr-chips">
            {batch.items.map((it, i) => (
              <span key={it.name} className={`arr-chip${i === idx ? ' on' : ''}${i > idx ? ' wait' : ''}`}>
                <Visual item={it} size="chip" />
              </span>
            ))}
          </div>
        )}
        <div className="arr-total">
          {total} produit{total > 1 ? 's' : ''} au stock
        </div>
      </div>
    </div>
  )
}
