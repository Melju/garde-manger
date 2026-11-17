import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../data/auth'
import type { Category } from '../types'
import { categoryColor } from '../lib/categoryColors'
import { Icon, categoryIcon } from './Icon'

type Arrival = { name: string; category: string; by: string }
type Batch = { key: number; who: string; items: { name: string; category: string; count: number }[] }

const MAX_SHOWN = 6

/**
 * Popup animé « Steph vient d'ajouter … » quand un autre membre du foyer ajoute des produits
 * au stock (retour de courses vu en direct sur la tablette ou le téléphone).
 */
export function ArrivalsPopup() {
  const { members } = useAuth()
  const [batch, setBatch] = useState<Batch | null>(null)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const membersRef = useRef(members)
  membersRef.current = members

  useEffect(() => {
    const close = () => {
      setLeaving(true)
      timer.current = setTimeout(() => {
        setBatch(null)
        setLeaving(false)
      }, 350)
    }
    const onArrivals = (e: Event) => {
      const list = (e as CustomEvent<Arrival[]>).detail
      if (!list?.length) return
      setBatch((prev) => {
        // Un nouveau lot du même membre pendant l'affichage : on complète au lieu de remplacer.
        const by = list[0].by
        const who = membersRef.current.find((m) => m.id === by)?.name?.trim() || 'Quelqu’un'
        const merged = new Map<string, { name: string; category: string; count: number }>()
        if (prev && prev.who === who) for (const it of prev.items) merged.set(it.name.toLowerCase(), { ...it })
        for (const a of list) {
          const k = a.name.toLowerCase()
          const cur = merged.get(k)
          if (cur) cur.count += 1
          else merged.set(k, { name: a.name, category: a.category, count: 1 })
        }
        return { key: prev && prev.who === who ? prev.key : Date.now(), who, items: [...merged.values()] }
      })
      setLeaving(false)
      clearTimeout(timer.current)
      const total = list.length
      timer.current = setTimeout(close, Math.min(12000, 6000 + total * 400))
    }
    window.addEventListener('miamm-arrivals', onArrivals)
    return () => {
      window.removeEventListener('miamm-arrivals', onArrivals)
      clearTimeout(timer.current)
    }
  }, [])

  if (!batch) return null
  const total = batch.items.reduce((s, it) => s + it.count, 0)
  const shown = batch.items.slice(0, MAX_SHOWN)
  const more = batch.items.length - shown.length

  const dismiss = () => {
    clearTimeout(timer.current)
    setLeaving(true)
    timer.current = setTimeout(() => {
      setBatch(null)
      setLeaving(false)
    }, 350)
  }

  return (
    <div className={`arrivals${leaving ? ' leaving' : ''}`} key={batch.key} role="status" onClick={dismiss}>
      <div className="arrivals-head">
        <span className="arrivals-bag" aria-hidden="true">
          <Icon name="cart" />
        </span>
        <div>
          <strong>{batch.who} vient d’ajouter</strong>
          <span>
            {total} produit{total > 1 ? 's' : ''} au stock
          </span>
        </div>
      </div>
      <ul className="arrivals-list">
        {shown.map((it, i) => {
          const col = categoryColor(it.category)
          return (
            <li key={it.name} style={{ animationDelay: `${180 + i * 110}ms` }}>
              <span className="arrivals-ic" style={{ background: col.bg, color: col.fg }}>
                <Icon name={categoryIcon(it.category as Category)} width={1.7} />
              </span>
              <span className="arrivals-name">{it.name}</span>
              {it.count > 1 && <span className="arrivals-count">×{it.count}</span>}
            </li>
          )
        })}
        {more > 0 && (
          <li className="arrivals-more" style={{ animationDelay: `${180 + shown.length * 110}ms` }}>
            et {more} autre{more > 1 ? 's' : ''}
          </li>
        )}
      </ul>
    </div>
  )
}
