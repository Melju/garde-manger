import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useAuth } from '../data/auth'
import type { Recipe } from '../types'
import { recipeStock } from '../lib/recipesLib'
import { productImageSlug, chosenIconSlug, productImageUrl } from '../lib/productImage'
import { expiryStatus } from '../lib/expiry'

/** Mots secrets tapés dans la recherche du stock. */
export type Egg = { kind: 'rain' } | { kind: 'hungry' } | { kind: 'member'; name: string; profileId?: string }

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Prénom lisible d'un nom de profil (« stephanie.moyen » → « Stephanie »). */
function firstName(raw: string): string {
  const w = raw.split(/[.\s_-]+/)[0] ?? ''
  return w.length >= 3 && !/\d/.test(w) ? capital(w) : ''
}

/**
 * Reconnaît un mot secret dans la recherche. Les prénoms (membres du foyer et famille)
 * se déclenchent sur le prénom complet, ou sur ses 5 premières lettres au moins (« steph »).
 */
export function detectEgg(
  search: string,
  family: { name: string }[],
  members: { id: string; name: string }[],
): Egg | null {
  const q = norm(search)
  if (!q) return null
  if (q === 'miam miam' || q === 'miammiam' || q === 'miam miam miam') return { kind: 'rain' }
  if (q === 'jai faim' || q === 'j ai faim' || q === 'faim') return { kind: 'hungry' }
  if (q.length < 3 || q.includes(' ')) return null
  const people: { name: string; profileId?: string }[] = [
    ...members.map((m) => ({ name: firstName(m.name), profileId: m.id })),
    ...family.map((f) => ({ name: capital((f.name ?? '').trim().split(/\s+/)[0] ?? '') })),
  ].filter((p) => p.name.length >= 3)
  for (const p of people) {
    const n = norm(p.name)
    if (q === n || (q.length >= 5 && n.startsWith(q))) return { kind: 'member', name: p.name, profileId: p.profileId }
  }
  return null
}

// ----- Pluie d'aliments -----

const FALLBACK = ['pomme', 'banane', 'fraise', 'carotte', 'fromage', 'croissant', 'tomate', 'brocoli', 'avocat', 'ananas', 'abricot', 'citron']

function FoodRain({ onDone }: { onDone: () => void }) {
  const { products } = useStore()
  // Le logo apparaît au centre et « avale » les aliments du stock qui arrivent de tout autour.
  const foods = useMemo(() => {
    const slugs = [
      ...new Set(
        products.map((p) => chosenIconSlug(p.imageUrl) ?? productImageSlug(p.name)).filter((s): s is string => !!s),
      ),
    ]
    const pool = (slugs.length >= 8 ? slugs : [...slugs, ...FALLBACK]).sort(() => Math.random() - 0.5)
    const n = 14
    return Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI * 2 + Math.random() * 0.3
      const dist = 38 + Math.random() * 10
      return {
        slug: pool[i % pool.length],
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        delay: 0.55 + i * 0.13,
        rot: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 200),
      }
    })
  }, [products])

  useEffect(() => {
    const t = setTimeout(onDone, 4200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="egg-feast" onClick={onDone} aria-hidden="true">
      <div className="egg-feast-glow" />
      {foods.map((f, i) => (
        <img
          key={i}
          className="egg-feast-food"
          src={productImageUrl(f.slug)}
          alt=""
          draggable={false}
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
          style={{
            ['--x' as string]: `${f.x}vmin`,
            ['--y' as string]: `${f.y}vmin`,
            ['--rot' as string]: `${f.rot}deg`,
            animationDelay: `${f.delay}s`,
          }}
        />
      ))}
      <img className="egg-feast-logo" src={`${import.meta.env.BASE_URL}logo.webp`} alt="" />
      <div className="egg-feast-text">Miam miam !</div>
    </div>
  )
}

// ----- J'ai faim -----

function bestRecipe(recipes: Recipe[], products: Parameters<typeof recipeStock>[1]): { recipe: Recipe; missing: number } | null {
  let best: { recipe: Recipe; missing: number; ratio: number } | null = null
  for (const r of recipes) {
    if (!r.ingredients?.length) continue
    const s = recipeStock(r, products)
    const ratio = s.inStock / s.total
    if (!best || s.missing < best.missing || (s.missing === best.missing && ratio > best.ratio)) best = { recipe: r, missing: s.missing, ratio }
  }
  return best && best.ratio >= 0.5 ? best : null
}

function Hungry({ onDone }: { onDone: () => void }) {
  const { recipes, products } = useStore()
  const [phase, setPhase] = useState<'chew' | 'idea'>('chew')
  const pick = useMemo(() => bestRecipe(recipes, products), [recipes, products])

  useEffect(() => {
    const t = setTimeout(() => setPhase('idea'), 2300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="egg-overlay" onClick={onDone} role="dialog">
      <div className="egg-card" onClick={(e) => e.stopPropagation()}>
        <img className={`egg-chomp${phase === 'idea' ? ' done' : ''}`} src={`${import.meta.env.BASE_URL}logo.webp`} alt="" />
        {phase === 'chew' ? (
          <div className="egg-chew-text">
            Miam<span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
        ) : pick ? (
          <div className="egg-idea">
            <div className="egg-sub">Avec ce qu’il y a dans le stock :</div>
            <div className="egg-title">{pick.recipe.title}</div>
            <div className="egg-sub">
              {pick.missing === 0
                ? 'Tu as tout ce qu’il faut !'
                : `Il ne manque que ${pick.missing} ingrédient${pick.missing > 1 ? 's' : ''}.`}
            </div>
            <div className="egg-actions">
              <button className="btn-secondary" onClick={onDone}>
                Plus tard
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  onDone()
                  window.dispatchEvent(new CustomEvent('miamm-open-recipe', { detail: pick.recipe }))
                }}
              >
                Voir la recette
              </button>
            </div>
          </div>
        ) : (
          <div className="egg-idea">
            <div className="egg-title">Le frigo a besoin d’un peu d’amour</div>
            <div className="egg-sub">Aucune recette faisable avec le stock actuel. Un petit tour aux courses ?</div>
            <div className="egg-actions">
              <button className="btn-primary" onClick={onDone}>
                D’accord
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ----- Message perso pour un membre -----

const CHOCO = /chocolat|nutella|choco|pepite|praline|kinder|twix|mars|bounty|m&m/

function MemberHello({ name, profileId, onDone }: { name: string; profileId?: string; onDone: () => void }) {
  const { products } = useStore()
  const message = useMemo(() => {
    const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const choco = products.filter((p) => CHOCO.test(n(p.name))).length
    const soon = products.filter((p) => ['urgent', 'expired'].includes(expiryStatus(p))).length
    const weekAgo = Date.now() - 7 * 86400000
    const added = profileId
      ? products.filter((p) => p.createdBy === profileId && p.createdAt && new Date(p.createdAt).getTime() > weekAgo).length
      : 0
    const any = products.length ? products[Math.floor(Math.random() * products.length)].name : ''
    const options: string[] = []
    if (choco >= 2) options.push(`Salut ${name} ! Il y a ${choco} produits au chocolat dans le stock… On se demande bien qui les achète.`)
    if (added >= 3) options.push(`${name}, ${added} produits ajoutés cette semaine. Champion des courses, rien à dire !`)
    if (soon >= 1)
      options.push(`${name}, ${soon} produit${soon > 1 ? 's' : ''} ${soon > 1 ? 'sont' : 'est'} à manger d’urgence. Ce soir, c’est toi qui cuisines ?`)
    if (any) options.push(`Psst ${name}… il reste « ${any} ». Je dis ça, je dis rien.`)
    options.push(`${name} est dans la place ! Le frigo tremble.`)
    return options[Math.floor(Math.random() * options.length)]
  }, [name, profileId, products])

  useEffect(() => {
    const t = setTimeout(onDone, 7000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="egg-overlay" onClick={onDone} role="status">
      <div className="egg-card egg-hello">
        <div className="egg-wave" aria-hidden="true">
          👋
        </div>
        <div className="egg-avatar">{name.charAt(0)}</div>
        <div className="egg-msg">{message}</div>
      </div>
    </div>
  )
}

/** Affiche l'œuf de Pâques demandé (événement « miamm-egg »). */
export function EasterEggs() {
  const [egg, setEgg] = useState<Egg | null>(null)
  useEffect(() => {
    const on = (e: Event) => setEgg((e as CustomEvent<Egg>).detail)
    window.addEventListener('miamm-egg', on)
    return () => window.removeEventListener('miamm-egg', on)
  }, [])
  const done = useMemo(() => () => setEgg(null), [])
  if (!egg) return null
  if (egg.kind === 'rain') return <FoodRain onDone={done} />
  if (egg.kind === 'hungry') return <Hungry onDone={done} />
  return <MemberHello name={egg.name} profileId={egg.profileId} onDone={done} />
}

/** Hook pour l'écran de stock : déclenche l'œuf une fois par mot tapé. */
export function useEasterEgg(search: string) {
  const { family } = useStore()
  const { members } = useAuth()
  const [last, setLast] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      const egg = detectEgg(search, family, members)
      const key = egg ? JSON.stringify(egg) : ''
      if (egg && key !== last) window.dispatchEvent(new CustomEvent('miamm-egg', { detail: egg }))
      setLast(key)
    }, 650)
    return () => clearTimeout(t)
  }, [search, family, members, last])
}
