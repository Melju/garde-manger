import type { ReactNode } from 'react'
import {
  Apple, Avocado, Bacon, Banana, Bean, Beef, Beer, BottleWine, Broccoli, CakeSlice, Candy, Carrot, Cheese,
  Cherry, Citrus, Coffee, Cookie, Croissant, CupSoda, Cupcake, Donut, Drumstick, Egg, Fish, Flame, GlassWater,
  Grape, Ham, Hamburger, IceCreamCone, LeafyGreen, Martini, Milk, Nut, Pizza, Popcorn, Sandwich, Shell, Shrimp,
  Soup, Sprout, Wheat, Wine, Can, CanSoda,
  type LucideIcon,
} from 'lucide-react'

type Props = { name: string; width?: number }

/** Pictogrammes absents de Lucide, dessinés dans le même style (24x24, trait arrondi). */
const CUSTOM: Record<string, ReactNode> = {
  pasta: (
    <>
      <path d="M3 13h18a9 9 0 0 1-18 0z" />
      <path d="M7 13c1-4 3-5 5-5s4 1 5 5" />
      <path d="M15 3l-3 5" />
    </>
  ),
  rice: (
    <>
      <path d="M3 13h18a9 9 0 0 1-18 0z" />
      <path d="M6 13a6 5 0 0 1 12 0" />
      <path d="M10 10h.01M13 8.5h.01M14.5 11h.01" />
    </>
  ),
  tomato: (
    <>
      <path d="M12 7c-4.4 0-8 2.7-8 6.5S7.6 20 12 20s8-2.7 8-6.5S16.4 7 12 7z" />
      <path d="M12 7V4M9 6l3 1 3-1" />
    </>
  ),
  bulb: (
    <>
      <path d="M12 3c0 3-5 5-5 10a5 5 0 0 0 10 0c0-5-5-7-5-10z" />
      <path d="M12 8v10" />
    </>
  ),
  potato: (
    <>
      <path d="M5 9c1-3 5-4 9-3s6 4 5 8-5 6-9 5-6-5-5-10z" />
      <path d="M9 11h.01M14 10h.01M12 15h.01M16 14h.01" />
    </>
  ),
  mushroom: (
    <>
      <path d="M4 12a8 7 0 0 1 16 0z" />
      <path d="M9 12v5a3 3 0 0 0 6 0v-5" />
    </>
  ),
  corn: (
    <>
      <path d="M12 3c3 1 4 4 4 8s-1 8-4 10c-3-2-4-6-4-10s1-7 4-8z" />
      <path d="M8.5 9h7M8 13h8M9 17h6M12 3v18" />
    </>
  ),
  pepper: (
    <>
      <path d="M12 6c-4 0-7 3-7 8s3 7 7 7 7-2 7-7-3-8-7-8z" />
      <path d="M12 6V3l2-1M9 8c-1 3-1 8 0 11M15 8c1 3 1 8 0 11" />
    </>
  ),
  jar: (
    <>
      <path d="M7 3h10v3H7z" />
      <path d="M6 6h12v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
      <path d="M9 12h6v4H9z" />
    </>
  ),
  salt: (
    <>
      <path d="M8 8h8l1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" />
      <path d="M9 8V5a3 3 0 0 1 6 0v3" />
      <path d="M10.5 14h.01M13.5 14h.01M12 17h.01" />
    </>
  ),
  oil: (
    <>
      <path d="M10 2h4v4l2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3z" />
      <path d="M9 14h6" />
    </>
  ),
  butter: (
    <>
      <path d="M3 11l3-4h12l3 4v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M3 11h18" />
    </>
  ),
  sausage: (
    <>
      <path d="M5.5 18.5a3 3 0 0 1 0-4.2l8-8a3 3 0 0 1 4.2 4.2l-8 8a3 3 0 0 1-4.2 0z" />
      <path d="M9 11l4 4" />
    </>
  ),
  chocolate: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M5 9h14M5 15h14M12 3v18" />
    </>
  ),
  baguette: (
    <g transform="rotate(-45 12 12)">
      <rect x="1" y="9" width="22" height="6" rx="3" />
      <path d="M7 9l2 6M12 9l2 6M17 9l2 6" />
    </g>
  ),
  slice: <path d="M5 21V11a3 3 0 0 1-1-5.5 4 4 0 0 1 4-3.5h8a4 4 0 0 1 4 3.5A3 3 0 0 1 19 11v10z" />,
}

const LUCIDE: Record<string, LucideIcon> = {
  apple: Apple, avocado: Avocado, bacon: Bacon, banana: Banana, bean: Bean, beef: Beef, beer: Beer,
  bottle: BottleWine, broccoli: Broccoli, cake: CakeSlice, cupcake: Cupcake, candy: Candy, carrot: Carrot,
  cheese: Cheese, cherry: Cherry, citrus: Citrus, coffee: Coffee, cookie: Cookie, croissant: Croissant,
  juice: CupSoda, soda: CanSoda, donut: Donut, drumstick: Drumstick, egg: Egg, fish: Fish, spice: Flame,
  water: GlassWater, grape: Grape, ham: Ham, hamburger: Hamburger, iceCream: IceCreamCone, leafy: LeafyGreen,
  spirit: Martini, milk: Milk, nut: Nut, pizza: Pizza, popcorn: Popcorn, sandwich: Sandwich, shell: Shell,
  shrimp: Shrimp, soup: Soup, sprout: Sprout, wheat: Wheat, wine: Wine, can: Can,
}

/** Pictogramme alimentaire (Lucide ou dessin maison). Rend null si la clé est inconnue. */
export function FoodIcon({ name, width = 1.7 }: Props) {
  const L = LUCIDE[name]
  if (L) return <L strokeWidth={width} aria-hidden="true" />
  const c = CUSTOM[name]
  if (!c) return null
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {c}
    </svg>
  )
}

/** Vrai si un pictogramme existe pour cette clé. */
export function hasFoodIcon(name: string): boolean {
  return Boolean(LUCIDE[name] || CUSTOM[name])
}
