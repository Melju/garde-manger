// Écrans de la skill Alexa « Miam miam » pour les Echo à écran (APL), aux couleurs de l'app.
// Pensés d'abord pour l'Echo Show 15 (1920 × 1080), et lisibles sur les écrans plus petits.
import { productImageSlug, chosenIconSlug } from '../src/lib/productImage'
import type { Product, ShoppingItem } from '../src/types'
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

export type Tile = { id?: string; name: string; sub?: string; img?: string; initial: string; tone: 'ok' | 'soon' | 'expired' }

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
    id: p.id,
    name: p.name,
    sub: [sub, qty].filter(Boolean).join(' · ') || undefined,
    img: imageFor(p.name, p.imageUrl, p.category),
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
  { key: 'urgent', label: 'À consommer vite' },
  { key: 'frigo', label: 'Frigo' },
  { key: 'congel', label: 'Congélateur' },
  { key: 'list', label: 'Courses' },
  { key: 'recipe', label: 'Idées repas' },
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
          onPress: [{ type: 'SendEvent', arguments: ['product', '${tile.id}'] }],
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
  return {
    document: page(
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
              width: '${viewport.width >= 1500 ? 440 : 300}',
              height: '${viewport.width >= 1500 ? 440 : 300}',
              borderRadius: 40,
              backgroundColor: `\${miam.tone == 'expired' ? '${C.dangerSoft}' : '${C.surface}'}`,
              borderWidth: 2,
              borderColor: C.border,
              item: {
                type: 'Container',
                width: '${viewport.width >= 1500 ? 436 : 296}',
                height: '${viewport.width >= 1500 ? 436 : 296}',
                alignItems: 'center',
                justifyContent: 'center',
                items: [
                  { type: 'Image', when: '${miam.img}', source: '${miam.img}', width: '${viewport.width >= 1500 ? 340 : 230}', height: '${viewport.width >= 1500 ? 340 : 230}', scale: 'best-fit' },
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
    ),
    data: { miam: {
        name: p.name,
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
