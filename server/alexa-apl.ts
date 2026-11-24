// Écrans de la skill Alexa « Miam miam » pour les Echo à écran (APL), aux couleurs de l'app.
// Pensés d'abord pour l'Echo Show 15 (1920 × 1080), et lisibles sur les écrans plus petits.
import { productImageSlug, chosenIconSlug } from '../src/lib/productImage'
import { medFormIcon, type MealPlan, type Product, type Recipe, type ShoppingItem } from '../src/types'
import { recipeIconSlug, recipeStock, isIngredientInStock } from '../src/lib/recipesLib'
import { countPerPack, formatContenance, isWeightProduct, portionScale } from '../src/lib/contenance'
import { daysUntilExpiry, expiryLabel, expiryStatus, priorityProducts, urgentCount } from '../src/lib/expiry'

const SITE = 'https://food.graphikeo.com'
const C = {
  bg: '#f3f8f9',
  surface: '#ffffff',
  fg: '#142226',
  muted: '#7b8588',
  border: '#dfe6e8',
  brand: '#009d9e',
  strong: '#008183',
  soft: '#d1f7f7',
  warn: '#c9861a',
  danger: '#e23439',
  dangerSoft: '#fdeeee',
}

export type Tile = { ev?: string; id?: string; name: string; sub?: string; img?: string; initial: string; tone: 'ok' | 'soon' | 'expired' }

// ---------- Données ----------

/** Comme dans l'app : icône choisie, sinon illustration devinée du nom, jamais la photo du produit (sinon : initiale). */
export function imageFor(name: string, imageUrl?: string, _category?: string): string | undefined {
  const slug = chosenIconSlug(imageUrl) ?? productImageSlug(name)
  return slug ? `${SITE}/icons-png/${slug}.png` : undefined
}

/** Même statut et même libellé que l'app (DDM, épicerie sèche, surgelés avec tolérance). */
export function productTile(p: Product): Tile {
  const st = expiryStatus(p)
  const label = expiryLabel(p)
  let sub: string | undefined
  if (st === 'expired' || st === 'urgent' || st === 'soon' || st === 'still-good') sub = label
  else if (st === 'ok' && p.expiryDate)
    sub = new Date(p.expiryDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })
  const qty = p.quantity > 1 ? `×${p.quantity}` : p.size || ''
  return {
    ev: 'product',
    id: p.id,
    name: p.name,
    sub: [sub, qty].filter(Boolean).join(' · ') || undefined,
    img: p.category === 'pharmacie' && !chosenIconSlug(p.imageUrl) ? `${SITE}/icons-png/${medFormIcon(p.medForm)}.png` : imageFor(p.name, p.imageUrl, p.category),
    initial: p.name.trim().charAt(0).toUpperCase() || '?',
    tone: st === 'expired' ? 'expired' : st === 'urgent' ? 'soon' : 'ok',
  }
}

export { urgentCount, priorityProducts }

export function nameTile(name: string, sub?: string): Tile {
  return { name, sub, img: imageFor(name), initial: name.trim().charAt(0).toUpperCase() || '?', tone: 'ok' }
}

/** Produits triés par date de péremption (les sans date à la fin). */
export function byExpiry(products: Product[]): Product[] {
  const key = (p: Product) => (expiryStatus(p) === 'none' ? Infinity : (daysUntilExpiry(p) ?? Infinity))
  return [...products].sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name))
}

/** Les produits prioritaires, comme le bloc « À consommer » de l'app. */
export function urgent(products: Product[], n = 8): Product[] {
  return priorityProducts(products).slice(0, n)
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')

/** Produits dont le nom contient un mot (4 lettres et plus) de la question. */
export function matching(products: Product[], query: string): Product[] {
  const stop = new Set(['reste', 'encore', 'combien', 'quoi', 'dans', 'avec', 'est-ce', 'quil', 'cest', 'question', 'avons', 'tout', 'tous', 'quelle', 'quelles', 'quel', 'quels'])
  const words = norm(query)
    .split(/[^a-z0-9]+/)
    .map((w) => w.replace(/s$/, ''))
    .filter((w) => w.length >= 4 && !stop.has(w))
  if (!words.length) return []
  return byExpiry(products.filter((p) => words.some((w) => norm(p.name).includes(w)))).slice(0, 12)
}

// ---------- Document ----------
const check = {
  type: 'AVG',
  version: '1.2',
  width: 24,
  height: 24,
  parameters: ['color'],
  items: [{ type: 'path', pathData: 'M5 12.5l4.5 4.5L19 7.5', stroke: '${color}', strokeWidth: 3, strokeLineCap: 'round', strokeLineJoin: 'round', fill: 'transparent' }],
}

const NAV = [
  { key: 'home', label: 'Accueil' },
  { key: 'stock', label: 'Stock' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'frigo', label: 'Frigo' },
  { key: 'congel', label: 'Congélateur' },
  { key: 'list', label: 'Courses' },
  { key: 'week', label: 'Semaine' },
  { key: 'recipes', label: 'Recettes' },
  { key: 'pharma', label: 'Pharmacie' },
]

const layouts = {
  Header: {
    parameters: ['title', 'hint'],
    item: {
      type: 'Container',
      direction: 'row',
      alignItems: 'center',
      width: '100%',
      items: [
        { type: 'Image', source: `${SITE}/logo.png`, width: 72, height: 72, scale: 'best-fit' },
        { type: 'Text', text: 'Miam miam', fontSize: 38, fontWeight: '800', color: C.strong, spacing: 18 },
        { type: 'Text', when: '${title}', text: '${title}', fontSize: 34, fontWeight: '600', color: C.fg, spacing: 28, grow: 1, maxLines: 1 },
        { type: 'Text', when: '${!title}', text: ' ', grow: 1 },
        { type: 'Text', text: '${hint}', fontSize: 24, color: C.muted, textAlign: 'right' },
      ],
    },
  },
  Tile: {
    parameters: ['tile', { name: 'w', type: 'number', default: 260 }, { name: 'h', type: 'number', default: 290 }],
    item: {
      type: 'Container',
      width: '${w}',
      height: '${h}',
      items: [
        {
          type: 'TouchWrapper',
          width: '${w - 20}',
          height: '${h - 20}',
          onPress: [{ type: 'SendEvent', arguments: ['${tile.ev}', '${tile.id}'] }],
          item: {
          type: 'Frame',
          width: '${w - 20}',
          height: '${h - 20}',
          borderRadius: 28,
          borderWidth: 2,
          backgroundColor: `\${tile.tone == 'expired' ? '${C.dangerSoft}' : '${C.surface}'}`,
          borderColor: `\${tile.tone == 'expired' ? '#f4b8b8' : '${C.border}'}`,
          item: {
            type: 'Container',
            width: '${w - 24}',
            height: '${h - 24}',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 16,
            paddingRight: 16,
            items: [
              { type: 'Image', when: '${tile.img}', source: '${tile.img}', width: '${Math.floor((h - 20) * 0.5)}', height: '${Math.floor((h - 20) * 0.5)}', scale: 'best-fit' },
              {
                type: 'Frame',
                when: '${!tile.img}',
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: C.soft,
                item: { type: 'Text', text: '${tile.initial}', width: 110, height: 110, textAlign: 'center', textAlignVertical: 'center', fontSize: 52, fontWeight: '800', color: C.strong },
              },
              { type: 'Text', text: '${tile.name}', spacing: 12, fontSize: 26, fontWeight: '700', color: C.fg, textAlign: 'center', maxLines: 2 },
              {
                type: 'Text',
                when: '${tile.sub}',
                text: '${tile.sub}',
                spacing: 4,
                fontSize: 22,
                fontWeight: '600',
                textAlign: 'center',
                maxLines: 1,
                color: `\${tile.tone == 'expired' ? '${C.danger}' : tile.tone == 'soon' ? '${C.warn}' : '${C.muted}'}`,
              },
            ],
          },
          },
        },
      ],
    },
  },
  NavBar: {
    parameters: ['current'],
    item: {
      type: 'Container',
      direction: 'row',
      width: '100%',
      height: 96,
      spacing: 16,
      justifyContent: 'center',
      data: NAV,
      item: {
        type: 'TouchWrapper',
        spacing: 14,
        onPress: [{ type: 'SendEvent', arguments: ['nav', '${data.key}'] }],
        item: {
          type: 'Frame',
          height: 80,
          borderRadius: 40,
          paddingLeft: 34,
          paddingRight: 34,
          backgroundColor: `\${data.key == current ? '${C.brand}' : '${C.surface}'}`,
          borderWidth: 2,
          borderColor: `\${data.key == current ? '${C.brand}' : '${C.border}'}`,
          item: {
            type: 'Text',
            text: '${data.label}',
            height: 76,
            textAlignVertical: 'center',
            fontSize: 28,
            fontWeight: '700',
            color: `\${data.key == current ? '#ffffff' : '${C.fg}'}`,
          },
        },
      },
    },
  },
  BigButton: {
    parameters: ['label', 'action', 'pid', 'danger'],
    item: {
      type: 'TouchWrapper',
      onPress: [{ type: 'SendEvent', arguments: ['act', '${action}', '${pid}'] }],
      item: {
        type: 'Frame',
        height: 110,
        borderRadius: 30,
        backgroundColor: `\${danger ? '${C.dangerSoft}' : '${C.brand}'}`,
        borderWidth: 2,
        borderColor: `\${danger ? '#f4b8b8' : '${C.brand}'}`,
        item: {
          type: 'Text',
          text: '${label}',
          height: 106,
          paddingLeft: 20,
          paddingRight: 20,
          textAlign: 'center',
          textAlignVertical: 'center',
          fontSize: 32,
          fontWeight: '800',
          color: `\${danger ? '${C.danger}' : '#ffffff'}`,
        },
      },
    },
  },
  Chip: {
    parameters: ['label'],
    item: {
      type: 'Frame',
      backgroundColor: C.soft,
      borderRadius: 40,
      paddingLeft: 26,
      paddingRight: 26,
      paddingTop: 12,
      paddingBottom: 12,
      item: { type: 'Text', text: '${label}', fontSize: 25, fontWeight: '600', color: C.strong },
    },
  },
}

const PADX = '(viewport.width >= 1500 ? 128 : 64)'
const tileW = `\${Math.floor((viewport.width - ${PADX}) / (viewport.width >= 1500 ? 6 : viewport.width >= 1000 ? 5 : 3))}`
const tileH = '${viewport.width >= 1500 ? 290 : 230}'
const rowW = '${viewport.width >= 1500 ? 260 : 210}'

function grid(dataPath: string, extra: Record<string, unknown> = {}) {
  return {
    type: 'GridSequence',
    width: '100%',
    grow: 1,
    shrink: 1,
    spacing: 24,
    childWidth: tileW,
    childHeight: tileH,
    data: dataPath,
    item: { type: 'Tile', tile: '${data}', w: tileW, h: tileH },
    ...extra,
  }
}

function row(dataPath: string) {
  return {
    type: 'Sequence',
    scrollDirection: 'horizontal',
    width: '100%',
    height: tileH,
    spacing: 24,
    data: dataPath,
    item: { type: 'Tile', tile: '${data}', w: rowW, h: tileH },
  }
}

function page(items: unknown[], nav = '') {
  return {
    type: 'APL',
    version: '2023.3',
    theme: 'light',
    settings: { idleTimeout: 180000 },
    graphics: { check },
    layouts,
    mainTemplate: {
      parameters: ['miam'],
      item: {
        type: 'Frame',
        width: '100vw',
        height: '100vh',
        backgroundColor: C.bg,
        item: {
          type: 'Container',
          width: '100vw',
          height: '100vh',
          paddingLeft: '${viewport.width >= 1500 ? 64 : 32}',
          paddingRight: '${viewport.width >= 1500 ? 64 : 32}',
          paddingTop: '${viewport.width >= 1500 ? 44 : 24}',
          paddingBottom: 20,
          items: [
            { type: 'Container', width: '100%', grow: 1, shrink: 1, items },
            { type: 'NavBar', current: nav },
          ],
        },
      },
    },
  }
}

const hintDefault = 'Dis « Alexa, … » pour me parler'

// ---------- Écrans ----------
export function homeScreen(o: { name: string; total: number; soon: number; shop: number; urgent: Tile[] }) {
  const stat = (value: string, label: string, color: string, nav: string) => ({
    type: 'TouchWrapper',
    grow: 1,
    spacing: 24,
    onPress: [{ type: 'SendEvent', arguments: ['nav', nav] }],
    item: {
    type: 'Frame',
    backgroundColor: C.surface,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: C.border,
    item: {
      type: 'Container',
      paddingLeft: 32,
      paddingTop: 24,
      paddingBottom: 24,
      items: [
        { type: 'Text', text: value, fontSize: 68, fontWeight: '800', color },
        { type: 'Text', text: label, fontSize: 26, color: C.muted, fontWeight: '600' },
      ],
    },
    },
  })
  return {
    document: page([
      { type: 'Header', title: '', hint: '${miam.date}' },
      { type: 'Text', text: '${miam.hello}', spacing: 28, fontSize: 60, fontWeight: '800', color: C.fg },
      {
        type: 'Container',
        direction: 'row',
        spacing: 24,
        width: '100%',
        items: [
          stat('${miam.total}', 'produits en stock  ›', C.strong, 'stock'),
          stat('${miam.soon}', 'à consommer vite  ›', o.soon ? C.warn : C.strong, 'urgent'),
          stat('${miam.shop}', 'articles à acheter  ›', C.strong, 'list'),
        ],
      },
      { type: 'Text', when: '${miam.urgent.length > 0}', text: 'À consommer en priorité', spacing: 32, fontSize: 32, fontWeight: '800', color: C.fg },
      { type: 'Container', when: '${miam.urgent.length > 0}', spacing: 16, width: '100%', items: [row('${miam.urgent}')] },
      {
        type: 'Container',
        direction: 'row',
        wrap: 'wrap',
        spacing: 28,
        alignItems: 'center',
        items: [
          { type: 'Text', text: 'À dire :', fontSize: 25, color: C.muted, fontWeight: '600' },
          { type: 'Chip', spacing: 16, label: '« Alexa, ajoute du lait »' },
          { type: 'Chip', spacing: 16, label: '« Alexa, j’ai fini le beurre »' },
          { type: 'Chip', spacing: 16, label: '« Alexa, il reste des œufs ? »' },
          { type: 'Text', text: 'Touche un produit pour agir dessus.', fontSize: 25, color: C.muted, spacing: 24 },
        ],
      },
    ], 'home'),
    data: { miam: {
        hello: o.name ? `Salut ${o.name} !` : 'Salut !',
        date: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }),
        total: String(o.total),
        soon: String(o.soon),
        shop: String(o.shop),
        urgent: o.urgent,
      },
    },
  }
}

export function gridScreen(title: string, count: string, tiles: Tile[], nav = 'stock') {
  return {
    document: page([
      { type: 'Header', title: '${miam.title}', hint: '${miam.count}' },
      tiles.length
        ? { type: 'Container', spacing: 28, width: '100%', grow: 1, shrink: 1, items: [grid('${miam.tiles}')] }
        : { type: 'Text', text: 'Rien ici pour l’instant.', spacing: 60, fontSize: 40, color: C.muted, textAlign: 'center', width: '100%' },
    ], nav),
    data: { miam: { title, count, tiles } },
  }
}

export function listScreen(items: ShoppingItem[]) {
  const sorted = [...items].sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name))
  const rows = sorted.map((s) => ({
    id: s.id,
    name: s.name,
    qty: s.unit ? `${s.quantity} ${s.unit}` : s.quantity > 1 ? `×${s.quantity}` : '',
    img: imageFor(s.name, undefined, s.category) ?? '',
    initial: s.name.trim().charAt(0).toUpperCase() || '?',
    checked: s.checked,
  }))
  const left = items.filter((s) => !s.checked).length
  const listW = `\${Math.floor((viewport.width - ${PADX}) / (viewport.width >= 1500 ? 3 : 2))}`
  const inner = `\${Math.floor((viewport.width - ${PADX}) / (viewport.width >= 1500 ? 3 : 2)) - 20}`
  const rowItem = {
    type: 'Container',
    width: listW,
    height: 116,
    items: [
      {
        type: 'TouchWrapper',
        width: inner,
        height: 98,
        onPress: [{ type: 'SendEvent', arguments: ['toggle', '${data.id}'] }],
        item: {
          type: 'Frame',
          width: inner,
          height: 98,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: C.border,
          backgroundColor: `\${data.checked ? '${C.bg}' : '${C.surface}'}`,
          item: {
            type: 'Container',
            direction: 'row',
            alignItems: 'center',
            width: inner,
            height: 94,
            paddingLeft: 24,
            paddingRight: 24,
            opacity: '${data.checked ? 0.5 : 1}',
            items: [
              {
                type: 'Frame',
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: 3,
                borderColor: C.brand,
                backgroundColor: `\${data.checked ? '${C.brand}' : 'transparent'}`,
                item: { type: 'VectorGraphic', when: '${data.checked}', source: 'check', color: '#ffffff', width: 42, height: 42, scale: 'best-fit' },
              },
              { type: 'Image', when: '${data.img}', source: '${data.img}', width: 72, height: 72, scale: 'best-fit', spacing: 20 },
              {
                type: 'Frame',
                when: '${!data.img}',
                width: 72,
                height: 72,
                borderRadius: 36,
                spacing: 20,
                backgroundColor: C.soft,
                item: { type: 'Text', text: '${data.initial}', width: 72, height: 72, textAlign: 'center', textAlignVertical: 'center', fontSize: 34, fontWeight: '800', color: C.strong },
              },
              { type: 'Text', text: '${data.name}', spacing: 20, grow: 1, shrink: 1, fontSize: 30, fontWeight: '700', color: C.fg, maxLines: 1 },
              { type: 'Text', text: '${data.qty}', fontSize: 24, color: C.muted, fontWeight: '600' },
            ],
          },
        },
      },
    ],
  }
  return {
    document: page([
      { type: 'Header', title: 'Liste de courses', hint: '${miam.count}' },
      rows.length
        ? {
            type: 'GridSequence',
            spacing: 28,
            width: '100%',
            grow: 1,
            shrink: 1,
            childWidth: listW,
            childHeight: 116,
            data: '${miam.rows}',
            item: rowItem,
          }
        : { type: 'Text', text: 'La liste est vide. Dis « Alexa, ajoute du pain ».', spacing: 60, fontSize: 40, color: C.muted, textAlign: 'center', width: '100%' },
      {
        type: 'Container',
        when: '${miam.rows.length > 0}',
        direction: 'row',
        alignItems: 'center',
        spacing: 8,
        width: '100%',
        items: [
          { type: 'Text', text: 'Touche un article pour le cocher.', fontSize: 24, color: C.muted, grow: 1 },
          {
            type: 'TouchWrapper',
            when: '${miam.checked > 0}',
            onPress: [{ type: 'SendEvent', arguments: ['clear'] }],
            item: { type: 'Chip', label: '${miam.clearLabel}' },
          },
        ],
      },
    ], 'list'),
    data: { miam: {
        rows,
        count: left ? `${left} à acheter` : 'Tout est pris',
        checked: items.length - left,
        clearLabel: `Retirer les ${items.length - left} cochés`,
      },
    },
  }
}

export function doneScreen(text: string, tiles: Tile[], undoHint = true) {
  return {
    document: page([
      { type: 'Header', title: '', hint: '' },
      {
        type: 'Container',
        grow: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        items: [
          {
            type: 'Frame',
            width: 128,
            height: 128,
            borderRadius: 64,
            backgroundColor: C.brand,
            item: { type: 'VectorGraphic', source: 'check', color: '#ffffff', width: 128, height: 128, scale: 'best-fit' },
          },
          { type: 'Text', text: '${miam.text}', spacing: 28, fontSize: 44, fontWeight: '800', color: C.fg, textAlign: 'center', width: '80%', maxLines: 3 },
          {
            type: 'Container',
            when: '${miam.tiles.length > 0}',
            spacing: 36,
            direction: 'row',
            justifyContent: 'center',
            width: '100%',
            height: tileH,
            data: '${miam.tiles}',
            item: { type: 'Tile', tile: '${data}', w: rowW, h: tileH },
          },
          { type: 'Text', when: '${miam.undo}', text: 'Pour revenir en arrière : « Alexa, annule »', spacing: 28, fontSize: 25, color: C.muted },
        ],
      },
    ], ''),
    data: { miam: { text, tiles: tiles.slice(0, 6), undo: undoHint } },
  }
}

export function answerScreen(text: string, o: { tiles?: Tile[]; tilesTitle?: string; options?: string[]; title?: string; nav?: string } = {}) {
  const tiles = o.tiles ?? []
  return {
    document: page([
      { type: 'Header', title: '${miam.title}', hint: hintDefault },
      {
        type: 'Frame',
        spacing: 28,
        width: '100%',
        backgroundColor: C.surface,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: C.border,
        item: {
          type: 'Container',
          paddingLeft: 40,
          paddingRight: 40,
          paddingTop: 32,
          paddingBottom: 32,
          items: [
            { type: 'Text', text: '${miam.text}', fontSize: 36, fontWeight: '600', color: C.fg, lineHeight: 1.3, maxLines: 7 },
            {
              type: 'Container',
              when: '${miam.options.length > 0}',
              direction: 'row',
              wrap: 'wrap',
              spacing: 24,
              data: '${miam.options}',
              item: {
                type: 'TouchWrapper',
                spacing: 16,
                onPress: [{ type: 'SendEvent', arguments: ['answer', '${data}'] }],
                item: { type: 'Chip', label: '${data}' },
              },
            },
          ],
        },
      },
      { type: 'Text', when: '${miam.tiles.length > 0}', text: '${miam.tilesTitle}', spacing: 32, fontSize: 30, fontWeight: '800', color: C.fg },
      { type: 'Container', when: '${miam.tiles.length > 0}', spacing: 16, width: '100%', grow: 1, shrink: 1, items: [grid('${miam.tiles}')] },
    ], o.nav ?? ''),
    data: { miam: { text, title: o.title ?? '', tiles, tilesTitle: o.tilesTitle ?? '', options: o.options ?? [] } },
  }
}

export type UseChip = { label: string; amount: string; unit: string }

/** Quantités proposées sur la fiche : des portions du paquet entamé, puis des unités entières. */
export function useChips(p: Product): UseChip[] {
  const chips: UseChip[] = []
  const ps = isWeightProduct(p.size) ? portionScale(p.size) : null
  if (p.quantity > 1 && !countPerPack(p.size)) {
    const word = ps && !ps.count ? 'entier' : 'unité'
    for (let n = 1; n < Math.min(p.quantity, 5); n++)
      chips.push({ label: word === 'entier' ? `${n} entier${n > 1 ? 's' : ''}` : `${n} unité${n > 1 ? 's' : ''}`, amount: String(n), unit: '' })
  }
  return chips
}

/** Réglage « J'en ai utilisé » (boutons − / +, comme la roulette de l'app) : poids, volume, pièces ou sachets sur plusieurs boîtes. */
export function useSlider(p: Product): { total: number; step: number; unit: string; presets: number[] } | null {
  const pack = countPerPack(p.size)
  if (pack && p.quantity > 1) return { total: p.quantity * pack.per, step: 1, unit: pack.unit, presets: [] }
  const ps = isWeightProduct(p.size) ? portionScale(p.size) : null
  if (!ps) return null
  const total = ps.values[ps.values.length - 1]
  if (!(total > 0)) return null
  if (ps.count) return { total, step: 1, unit: ps.baseUnit, presets: [] }
  const step = ps.major >= total ? Math.max(1, Math.round(total / 10)) : ps.major
  const pr = step % 2 === 0 ? step / 2 : step
  const presets = [...new Set([0.25, 0.5, 0.75].map((f) => Math.round((total * f) / pr) * pr))].filter((v) => v > 0 && v < total)
  return { total, step, unit: ps.baseUnit, presets }
}

function sliderBlock(p: Product, sl: { total: number; step: number; unit: string; presets: number[] }) {
  const fmt = (x: string) =>
    sl.unit === 'g'
      ? `\${${x} >= 1000 ? (${x}) / 1000 + ' kg' : ${x} + ' g'}`
      : sl.unit === 'mL'
        ? `\${${x} >= 1000 ? (${x}) / 1000 + ' L' : ${x} >= 100 ? (${x}) / 10 + ' cl' : ${x} + ' mL'}`
        : `\${${x} + ' ${sl.unit}' + (${x} > 1 ? 's' : '')}`
  const set = (value: string) => [{ type: 'SetValue', componentId: 'useBox', property: 'Pos', value }]
  const round = (label: string, value: string) => ({
    type: 'TouchWrapper',
    spacing: 16,
    onPress: set(value),
    item: {
      type: 'Frame',
      width: 104,
      height: 104,
      borderRadius: 52,
      borderWidth: 3,
      borderColor: C.brand,
      backgroundColor: C.surface,
      item: { type: 'Text', text: label, width: 98, height: 98, textAlign: 'center', textAlignVertical: 'center', fontSize: 56, fontWeight: '800', color: C.strong },
    },
  })
  const presetChip = (v: number) => ({
    type: 'TouchWrapper',
    spacing: 12,
    onPress: set(String(v)),
    item: { type: 'Chip', label: fmt(String(v)) },
  })
  return {
    type: 'Container',
    id: 'useBox',
    bind: [{ name: 'Pos', type: 'number', value: sl.step }],
    direction: 'row',
    alignItems: 'center',
    width: '100%',
    spacing: 20,
    items: [
      {
        type: 'Container',
        width: 330,
        items: [
          { type: 'Text', text: 'J’en ai utilisé', fontSize: 26, fontWeight: '700', color: C.muted },
          { type: 'Text', text: fmt('Pos'), fontSize: 50, fontWeight: '800', color: C.strong },
          { type: 'Text', text: `il en restera ${fmt(`(${sl.total} - Pos)`)}`, fontSize: 24, color: C.muted },
        ],
      },
      round('−', `\${Math.max(${sl.step}, Pos - ${sl.step})}`),
      round('+', `\${Math.min(${sl.total}, Pos + ${sl.step})}`),
      ...sl.presets.map(presetChip),
      { type: 'Container', grow: 1 },
      {
        type: 'TouchWrapper',
        spacing: 20,
        onPress: [{ type: 'SendEvent', arguments: ['use', p.id, '${Pos}', sl.unit, ''] }],
        item: {
          type: 'Frame',
          height: 96,
          width: 240,
          borderRadius: 48,
          backgroundColor: C.brand,
          item: { type: 'Text', text: 'Valider', width: 240, height: 96, textAlign: 'center', textAlignVertical: 'center', fontSize: 34, fontWeight: '800', color: '#ffffff' },
        },
      },
    ],
  }
}

export function productScreen(p: Product) {
  const t = productTile(p)
  const exp = p.expiryDate
    ? new Date(p.expiryDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
    : ''
  const lines = [
    p.brand ? p.brand : '',
    p.location ? `Emplacement : ${p.location}` : '',
    `Quantité : ×${p.quantity}${p.size ? ` · ${p.size}` : ''}`,
    p.openedAt ? `Entamé le ${new Date(p.openedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })}` : '',
  ].filter(Boolean)
  const line = (text: string) => ({ type: 'Text', text, fontSize: 30, color: C.fg, spacing: 10, maxLines: 1 })
  const doc: any = page(
      [
        { type: 'Header', title: '', hint: '' },
        {
          type: 'Container',
          direction: 'row',
          spacing: 32,
          width: '100%',
          grow: 1,
          shrink: 1,
          alignItems: 'center',
          items: [
            {
              type: 'Frame',
              width: '${viewport.width >= 1500 ? 380 : 280}',
              height: '${viewport.width >= 1500 ? 380 : 280}',
              borderRadius: 40,
              backgroundColor: `\${miam.tone == 'expired' ? '${C.dangerSoft}' : '${C.surface}'}`,
              borderWidth: 2,
              borderColor: C.border,
              item: {
                type: 'Container',
                width: '${viewport.width >= 1500 ? 376 : 276}',
                height: '${viewport.width >= 1500 ? 376 : 276}',
                alignItems: 'center',
                justifyContent: 'center',
                items: [
                  { type: 'Image', when: '${miam.img}', source: '${miam.img}', width: '${viewport.width >= 1500 ? 290 : 210}', height: '${viewport.width >= 1500 ? 290 : 210}', scale: 'best-fit' },
                  { type: 'Text', when: '${!miam.img}', text: '${miam.initial}', fontSize: 160, fontWeight: '800', color: C.strong },
                ],
              },
            },
            {
              type: 'Container',
              grow: 1,
              shrink: 1,
              spacing: 48,
              items: [
                { type: 'Text', text: '${miam.name}', fontSize: 54, fontWeight: '800', color: C.fg, maxLines: 2 },
                {
                  type: 'Text',
                  when: '${miam.exp}',
                  text: '${miam.exp}',
                  spacing: 14,
                  fontSize: 32,
                  fontWeight: '700',
                  color: `\${miam.tone == 'expired' ? '${C.danger}' : miam.tone == 'soon' ? '${C.warn}' : '${C.strong}'}`,
                },
                ...lines.map(line),
              ],
            },
          ],
        },
        ...(useSlider(p) ? [sliderBlock(p, useSlider(p)!)] : []),
        {
          type: 'Container',
          when: '${miam.uses.length > 0}',
          direction: 'row',
          alignItems: 'center',
          width: '100%',
          spacing: 16,
          items: [
            { type: 'Text', text: '${miam.usesTitle}', fontSize: 30, fontWeight: '700', color: C.fg },
            {
              type: 'Container',
              direction: 'row',
              data: '${miam.uses}',
              item: {
                type: 'TouchWrapper',
                spacing: 16,
                onPress: [{ type: 'SendEvent', arguments: ['use', p.id, '${data.amount}', '${data.unit}', '${data.label}'] }],
                item: {
                  type: 'Frame',
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 3,
                  borderColor: C.brand,
                  backgroundColor: C.surface,
                  paddingLeft: 30,
                  paddingRight: 30,
                  item: { type: 'Text', text: '${data.label}', height: 74, textAlignVertical: 'center', fontSize: 30, fontWeight: '800', color: C.strong },
                },
              },
            },
          ],
        },
        {
          type: 'Container',
          direction: 'row',
          width: '100%',
          spacing: 24,
          items: [
            { type: 'BigButton', label: 'J’ai fini', action: 'finish', pid: p.id, danger: false, grow: 1 },
            { type: 'BigButton', label: p.openedAt ? 'Déjà entamé' : 'Entamé', action: 'open', pid: p.id, grow: 1, spacing: 20, danger: false },
            { type: 'BigButton', label: 'Ajouter aux courses', action: 'shop', pid: p.id, grow: 1, spacing: 20, danger: false },
            { type: 'BigButton', label: 'Jeté', action: 'waste', pid: p.id, grow: 1, spacing: 20, danger: true },
          ],
        },
      ],
      '',
    )
  return {
    document: doc,
    data: { miam: {
        name: p.name,
        uses: useChips(p),
        usesTitle: useSlider(p) ? 'Ou des paquets entiers :' : 'J’en ai utilisé :',
        img: t.img ?? '',
        initial: t.initial,
        tone: t.tone,
        exp: (() => {
          const st = expiryStatus(p)
          if (st === 'none' || !p.expiryDate) return ''
          if (st === 'expired') return `Périmé depuis le ${exp}`
          if (st === 'still-good') return `Date dépassée (${exp}), encore bon`
          return `${p.dateType === 'ddm' ? 'De préférence avant le' : 'À consommer avant le'} ${exp}`
        })(),
      },
    },
  }
}

// ---------- Semaine et recettes ----------
const DAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Les 7 jours (lundi → dimanche) de la semaine courante + offset, en ISO, à l'heure de Paris. */
export function weekDates(offset = 0): string[] {
  const today = new Date(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }) + 'T12:00:00Z')
  const dow = (today.getUTCDay() + 6) % 7
  const monday = new Date(today.getTime() - dow * 86400_000 + offset * 7 * 86400_000)
  return Array.from({ length: 7 }, (_, i) => iso(new Date(monday.getTime() + i * 86400_000)))
}

export const recipeFor = (recipes: Recipe[], meal?: string) =>
  meal ? recipes.find((r) => r.title.toLowerCase() === meal.toLowerCase()) : undefined

const recipeImg = (r: Recipe | undefined, label: string) => {
  const slug = r ? recipeIconSlug(r) : productImageSlug(label)
  return slug ? `${SITE}/icons-png/${slug}.png` : ''
}

export function weekScreen(plan: MealPlan, recipes: Recipe[], offset: number) {
  const dates = weekDates(offset)
  const todayIso = weekDates(0)[(new Date(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }) + 'T12:00:00Z').getUTCDay() + 6) % 7]
  const meal = (d: string, slot: string) => {
    const label = plan[`${d}_${slot}`] ?? ''
    const r = recipeFor(recipes, label)
    return { label: label || '—', img: label ? recipeImg(r, label) : '', rid: r?.id ?? '', empty: !label }
  }
  const days = dates.map((d) => {
    const dt = new Date(d + 'T12:00:00Z')
    return { day: DAYS[dt.getUTCDay()], date: `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`, today: d === todayIso, midi: meal(d, 'midi'), soir: meal(d, 'soir') }
  })
  const first = new Date(dates[0] + 'T12:00:00Z')
  const label = offset === 0 ? 'Cette semaine' : offset === 1 ? 'Semaine prochaine' : offset === -1 ? 'Semaine dernière' : `Semaine du ${first.getUTCDate()} ${MONTHS[first.getUTCMonth()]}`
  const colW = `\${Math.floor((viewport.width - ${PADX}) / 7)}`
  const card = (slot: 'midi' | 'soir', title: string) => ({
    type: 'TouchWrapper',
    spacing: 14,
    onPress: [{ type: 'SendEvent', arguments: ['recipe', `\${data.${slot}.rid}`] }],
    item: {
      type: 'Frame',
      width: `\${Math.floor((viewport.width - ${PADX}) / 7) - 16}`,
      height: '${viewport.height >= 1000 ? 300 : 210}',
      borderRadius: 24,
      borderWidth: 2,
      borderColor: C.border,
      backgroundColor: `\${data.${slot}.empty ? '${C.bg}' : '${C.surface}'}`,
      item: {
        type: 'Container',
        alignItems: 'center',
        paddingTop: 14,
        paddingLeft: 10,
        paddingRight: 10,
        items: [
          { type: 'Text', text: title, fontSize: 20, fontWeight: '700', color: C.muted },
          { type: 'Image', when: `\${data.${slot}.img}`, source: `\${data.${slot}.img}`, spacing: 8, width: '${viewport.height >= 1000 ? 120 : 70}', height: '${viewport.height >= 1000 ? 120 : 70}', scale: 'best-fit' },
          { type: 'Text', text: `\${data.${slot}.label}`, spacing: 8, fontSize: 24, fontWeight: '700', color: `\${data.${slot}.empty ? '${C.muted}' : '${C.fg}'}`, textAlign: 'center', maxLines: 3 },
        ],
      },
    },
  })
  return {
    document: page(
      [
        {
          type: 'Container',
          direction: 'row',
          alignItems: 'center',
          width: '100%',
          items: [
            { type: 'Image', source: `${SITE}/logo.png`, width: 72, height: 72, scale: 'best-fit' },
            { type: 'Text', text: '${miam.label}', fontSize: 38, fontWeight: '800', color: C.fg, spacing: 18, grow: 1 },
            { type: 'TouchWrapper', onPress: [{ type: 'SendEvent', arguments: ['week', '${miam.prev}'] }], item: { type: 'Chip', label: '‹ Précédente' } },
            { type: 'TouchWrapper', spacing: 16, when: '${miam.offset != 0}', onPress: [{ type: 'SendEvent', arguments: ['week', '0'] }], item: { type: 'Chip', label: 'Aujourd’hui' } },
            { type: 'TouchWrapper', spacing: 16, onPress: [{ type: 'SendEvent', arguments: ['week', '${miam.next}'] }], item: { type: 'Chip', label: 'Suivante ›' } },
          ],
        },
        {
          type: 'Container',
          direction: 'row',
          spacing: 24,
          width: '100%',
          data: '${miam.days}',
          item: {
            type: 'Container',
            width: colW,
            items: [
              {
                type: 'Frame',
                width: `\${Math.floor((viewport.width - ${PADX}) / 7) - 16}`,
                borderRadius: 20,
                backgroundColor: `\${data.today ? '${C.brand}' : 'transparent'}`,
                item: {
                  type: 'Container',
                  alignItems: 'center',
                  paddingTop: 8,
                  paddingBottom: 8,
                  items: [
                    { type: 'Text', text: '${data.day}', fontSize: 28, fontWeight: '800', color: `\${data.today ? '#ffffff' : '${C.fg}'}` },
                    { type: 'Text', text: '${data.date}', fontSize: 22, color: `\${data.today ? '#ffffff' : '${C.muted}'}` },
                  ],
                },
              },
              card('midi', 'Midi'),
              card('soir', 'Soir'),
            ],
          },
        },
      ],
      'week',
    ),
    data: { miam: { label, days, offset, prev: String(offset - 1), next: String(offset + 1) } },
  }
}

export function recipesScreen(recipes: Recipe[], products: Product[]) {
  const tiles: Tile[] = [...recipes]
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || recipeStock(b, products).missing * -1 - recipeStock(a, products).missing * -1 || a.title.localeCompare(b.title))
    .slice(0, 90)
    .map((r) => {
      const st = recipeStock(r, products)
      return {
        ev: 'recipe',
        id: r.id,
        name: r.title,
        sub: `${r.timeMin ? `${r.timeMin} min · ` : ''}${st.missing ? `${st.missing} manquant${st.missing > 1 ? 's' : ''}` : 'Tout en stock'}`,
        img: recipeImg(r, r.title) || undefined,
        initial: r.title.trim().charAt(0).toUpperCase() || '?',
        tone: 'ok' as const,
      }
    })
  const g = gridScreen('Recettes', `${recipes.length} recette${recipes.length > 1 ? 's' : ''}`, tiles, 'recipes')
  // Bouton « Idées avec mon stock » sous l'en-tête.
  ;(g.document as any).mainTemplate.item.item.items[0].items.splice(1, 0, {
    type: 'TouchWrapper',
    spacing: 16,
    onPress: [{ type: 'SendEvent', arguments: ['nav', 'recipe'] }],
    item: { type: 'Chip', label: 'Des idées avec ce que j’ai ›' },
  })
  return g
}

export function recipeScreen(r: Recipe, products: Product[]) {
  const st = recipeStock(r, products)
  const ings = r.ingredients.map((i) => ({ name: i.name, qty: i.qty ?? '', ok: isIngredientInStock(i, products) }))
  const steps = (r.steps ?? []).map((t, i) => ({ n: String(i + 1), t }))
  const meta = [r.timeMin ? `${r.timeMin} min` : '', r.servings ? `${r.servings} ${r.servingsUnit || 'personnes'}` : '', r.cuisine ?? ''].filter(Boolean).join(' · ')
  return {
    document: page(
      [
        {
          type: 'Container',
          direction: 'row',
          alignItems: 'center',
          width: '100%',
          items: [
            { type: 'Image', when: '${miam.img}', source: '${miam.img}', width: 120, height: 120, scale: 'best-fit' },
            {
              type: 'Container',
              spacing: 24,
              grow: 1,
              shrink: 1,
              items: [
                { type: 'Text', text: '${miam.title}', fontSize: 48, fontWeight: '800', color: C.fg, maxLines: 2 },
                { type: 'Text', text: '${miam.meta}', fontSize: 26, color: C.muted, spacing: 6 },
              ],
            },
            {
              type: 'TouchWrapper',
              when: '${miam.missing > 0}',
              onPress: [{ type: 'SendEvent', arguments: ['recipeShop', r.id] }],
              item: { type: 'Chip', label: '${miam.shopLabel}' },
            },
          ],
        },
        {
          type: 'Container',
          direction: 'row',
          spacing: 28,
          width: '100%',
          height: '${viewport.height - 340}',
          items: [
            {
              type: 'Frame',
              width: `\${Math.floor((viewport.width - ${PADX}) * 0.38)}`,
              height: '${viewport.height - 340}',
              borderRadius: 28,
              backgroundColor: C.surface,
              borderWidth: 2,
              borderColor: C.border,
              item: {
                type: 'ScrollView',
                width: '100%',
                height: '100%',
                item: {
                  type: 'Container',
                  paddingLeft: 28,
                  paddingRight: 28,
                  paddingTop: 22,
                  paddingBottom: 22,
                  items: [
                    { type: 'Text', text: '${miam.ingTitle}', fontSize: 28, fontWeight: '800', color: C.fg },
                    {
                      type: 'Container',
                      data: '${miam.ings}',
                      item: {
                        type: 'Container',
                        direction: 'row',
                        alignItems: 'center',
                        spacing: 12,
                        items: [
                          {
                            type: 'Frame',
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: `\${data.ok ? '${C.brand}' : '${C.dangerSoft}'}`,
                            item: { type: 'VectorGraphic', when: '${data.ok}', source: 'check', color: '#ffffff', width: 34, height: 34, scale: 'best-fit' },
                          },
                          { type: 'Text', text: '${data.name}', spacing: 14, fontSize: 26, color: C.fg, grow: 1, shrink: 1, maxLines: 2 },
                          { type: 'Text', text: '${data.qty}', fontSize: 22, color: C.muted, spacing: 10 },
                        ],
                      },
                    },
                  ],
                },
              },
            },
            {
              type: 'Frame',
              spacing: 28,
              width: `\${Math.floor((viewport.width - ${PADX}) * 0.62) - 28}`,
              height: '${viewport.height - 340}',
              borderRadius: 28,
              backgroundColor: C.surface,
              borderWidth: 2,
              borderColor: C.border,
              item: {
                type: 'ScrollView',
                width: '100%',
                height: '100%',
                item: {
                  type: 'Container',
                  paddingLeft: 28,
                  paddingRight: 28,
                  paddingTop: 22,
                  paddingBottom: 22,
                  items: [
                    { type: 'Text', text: 'Préparation', fontSize: 28, fontWeight: '800', color: C.fg },
                    { type: 'Text', when: '${miam.steps.length == 0}', text: 'Pas d’étapes pour cette recette.', fontSize: 26, color: C.muted, spacing: 12 },
                    {
                      type: 'Container',
                      data: '${miam.steps}',
                      item: {
                        type: 'Container',
                        direction: 'row',
                        spacing: 16,
                        items: [
                          {
                            type: 'Frame',
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: C.soft,
                            item: { type: 'Text', text: '${data.n}', width: 44, height: 44, textAlign: 'center', textAlignVertical: 'center', fontSize: 24, fontWeight: '800', color: C.strong },
                          },
                          { type: 'Text', text: '${data.t}', spacing: 16, fontSize: 27, color: C.fg, grow: 1, shrink: 1, lineHeight: 1.3 },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
      'recipes',
    ),
    data: {
      miam: {
        title: r.title,
        meta,
        img: recipeImg(r, r.title),
        ings,
        steps,
        missing: st.missing,
        ingTitle: `Ingrédients · ${st.inStock}/${st.total} en stock`,
        shopLabel: `Ajouter les ${st.missing} manquant${st.missing > 1 ? 's' : ''} aux courses`,
      },
    },
  }
}
