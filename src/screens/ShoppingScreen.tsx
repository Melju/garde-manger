import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { QuantityWheel } from '../components/QuantityWheel'
import { CATEGORIES, categoryLabel, defaultConservation, type Category, type ShoppingItem } from '../types'
import { buyScale, formatContenance, parseContenance } from '../lib/contenance'
import { guessCategoryFromName, guessUnitFromName } from '../lib/categoryGuess'
import { estimatedExpiryISO } from '../lib/shelfLife'

interface KnownItem {
  name: string
  category: Category
  unit: string
  qty?: number
  count: number
}

interface ShoppingScreenProps {
  addOpen: boolean
  onCloseAdd: () => void
}

export function ShoppingScreen({ addOpen, onCloseAdd }: ShoppingScreenProps) {
  const {
    shopping,
    products,
    history,
    shopCatalog,
    recordShopItem,
    addProduct,
    addShoppingItem,
    updateShoppingItem,
    toggleShoppingItem,
    removeShoppingItem,
    clearCheckedShopping,
  } = useStore()
  const toast = useToast()

  const [name, setName] = useState('')
  const [qty, setQty] = useState(1)
  const [browseAll, setBrowseAll] = useState(false)

  const remaining = shopping.filter((it) => !it.checked).length

  // Connaissance des articles : produits + historique + apprentissage (localStorage).
  // `lookup` sert à deviner unité/catégorie ; `catalog` (trié par fréquence) à l'affichage.
  const { lookup, catalog } = useMemo(() => {
    const map = new Map<string, KnownItem>()
    for (const p of products) {
      const k = p.name.trim().toLowerCase()
      if (k && !map.has(k)) {
        map.set(k, { name: p.name.trim(), category: p.category, unit: parseContenance(p.size)?.unit ?? '', count: 0 })
      }
    }
    for (const h of history) {
      if (h.kind === 'prepare') continue
      const m = h.label.match(/^(.*?)\s(ajouté|consommé|jeté)/)
      if (!m) continue
      const nm = m[1].trim()
      const k = nm.toLowerCase()
      if (k && !map.has(k)) map.set(k, { name: nm, category: 'autre', unit: '', count: 0 })
    }
    // L'apprentissage prime (catégorie/unité/quantité mémorisées + fréquence).
    for (const e of shopCatalog) {
      map.set(e.name.trim().toLowerCase(), {
        name: e.name,
        category: e.category,
        unit: e.unit,
        qty: e.qty,
        count: e.count,
      })
    }
    const inList = new Set(shopping.map((it) => it.name.trim().toLowerCase()))
    const catalog = [...map.values()]
      .filter((it) => !inList.has(it.name.toLowerCase()))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    return { lookup: map, catalog }
  }, [products, history, shopping, shopCatalog])

  const typed = name.trim().toLowerCase()

  // Brouillon courant : unité + catégorie devinées depuis l'article.
  const match = typed ? lookup.get(typed) : undefined
  const draftCategory: Category = match?.category ?? (typed ? guessCategoryFromName(name) : 'autre')
  const rawUnit = match?.unit ?? (typed ? guessUnitFromName(name) : '')
  const scale = useMemo(() => buyScale(rawUnit), [rawUnit])

  // La roulette s'adapte : on recale la quantité par défaut quand l'unité change.
  useEffect(() => {
    setQty(scale.defaultValue)
  }, [scale.baseUnit])

  const suggestions = useMemo(() => {
    if (!typed) return []
    return catalog.filter((it) => it.name.toLowerCase().includes(typed)).slice(0, 6)
  }, [catalog, typed])

  const grouped = useMemo(() => {
    const map = new Map<Category, ShoppingItem[]>()
    for (const it of shopping) {
      const arr = map.get(it.category) ?? []
      arr.push(it)
      map.set(it.category, arr)
    }
    return CATEGORIES.map((c) => ({ category: c.id, items: map.get(c.id) ?? [] })).filter(
      (g) => g.items.length > 0,
    )
  }, [shopping])

  function qtyLabel(quantity: number, unit?: string) {
    return unit ? formatContenance(quantity, unit) : `×${quantity}`
  }

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    await addShoppingItem({
      name: trimmed,
      category: draftCategory,
      quantity: qty,
      unit: scale.baseUnit || undefined,
      source: 'manuel',
    })
    await recordShopItem(trimmed, draftCategory, rawUnit, qty)
    setName('')
    toast(`${trimmed} · ${qtyLabel(qty, scale.baseUnit || undefined)}`)
  }

  // Toucher une suggestion remplit le champ : la roulette s'adapte, puis on
  // choisit la quantité et on valide avec « + ». (Pas d'ajout direct.)
  function pickItem(item: KnownItem) {
    setName(item.name)
  }

  // Ajuste la quantité d'un article déjà dans la liste (corriger une erreur).
  async function stepQty(it: ShoppingItem, dir: 1 | -1) {
    const s = buyScale(it.unit)
    let idx = s.values.indexOf(it.quantity)
    if (idx < 0) idx = 0
    const ni = Math.max(0, Math.min(s.values.length - 1, idx + dir))
    await updateShoppingItem(it.id, { quantity: s.values[ni] })
  }

  // Cocher = acheté → ranger les articles cochés dans le stock (cycle courses → garde-manger).
  async function addCheckedToStock() {
    const checked = shopping.filter((it) => it.checked)
    if (checked.length === 0) return
    for (const it of checked) {
      const conservation = defaultConservation(it.category)
      const byWeight = !!it.unit && ['g', 'kg', 'mL', 'L'].includes(it.unit)
      await addProduct({
        name: it.name,
        category: it.category,
        conservation,
        quantity: byWeight ? 1 : it.quantity,
        size: byWeight ? formatContenance(it.quantity, it.unit!) : undefined,
        dateType: 'dlc',
        expiryDate: estimatedExpiryISO(it.name, conservation, it.category) || undefined,
      })
    }
    await clearCheckedShopping()
    toast(`${checked.length} article${checked.length > 1 ? 's' : ''} rangé${checked.length > 1 ? 's' : ''} dans le stock`)
  }

  async function handleGenerate() {
    const existing = new Set(shopping.map((it) => it.name.toLowerCase()))
    const low = products.filter((p) => p.quantity <= 1 && !existing.has(p.name.toLowerCase()))
    if (low.length === 0) {
      toast('Aucun stock faible à ajouter')
      return
    }
    for (const p of low) {
      await addShoppingItem({ name: p.name, category: p.category, quantity: 1, source: 'auto' })
    }
    toast(`${low.length} article${low.length > 1 ? 's' : ''} ajouté${low.length > 1 ? 's' : ''}`)
  }

  return (
    <div className="screen-fade">
      <header className="header">
        <div className="header-left">
          <h1>Liste de courses</h1>
          <p>{remaining} article{remaining !== 1 ? 's' : ''} restant{remaining !== 1 ? 's' : ''}</p>
        </div>
        <div className="header-actions" />
      </header>

      {shopping.some((it) => it.checked) && (
        <div className="btn-row" style={{ margin: '0 20px 14px' }}>
          <button
            className="btn-secondary"
            onClick={async () => {
              await clearCheckedShopping()
              toast('Articles cochés effacés')
            }}
          >
            Effacer cochés
          </button>
          <button className="btn-primary" onClick={addCheckedToStock}>
            Ranger au stock ({shopping.filter((it) => it.checked).length})
          </button>
        </div>
      )}

      <button className="generate-list-btn" onClick={handleGenerate}>
        <Icon name="sparkles" />
        Générer depuis les stocks faibles
      </button>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <Icon name="cart" />
          <p>Votre liste est vide.</p>
        </div>
      ) : (
        grouped.map((group) => (
          <div className="shopping-category" key={group.category}>
            <div className="shopping-category-title">{categoryLabel(group.category)}</div>
            {group.items.map((it) => (
              <div
                key={it.id}
                className={`shopping-item${it.checked ? ' checked' : ''}`}
                onClick={() => toggleShoppingItem(it.id)}
              >
                <div className="checkbox">
                  <Icon name="check" width={3} />
                </div>
                <span className="shopping-name">{it.name}</span>
                <div className="shop-step" onClick={(e) => e.stopPropagation()}>
                  <button aria-label="Diminuer" onClick={() => stepQty(it, -1)}>−</button>
                  <span className="shop-step-val">{qtyLabel(it.quantity, it.unit)}</span>
                  <button aria-label="Augmenter" onClick={() => stepQty(it, 1)}>+</button>
                </div>
                {it.source === 'auto' && <span className="shopping-source">auto</span>}
                <button
                  className="shopping-delete"
                  aria-label="Retirer"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeShoppingItem(it.id)
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Drawer d'ajout (déclenché par le bouton d'action de la page) */}
      {addOpen && (
        <div className="drawer-overlay" onClick={onCloseAdd}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle" />
            <div className="drawer-head">
              <div className="drawer-title">Ajouter un article</div>
              <button className="btn-secondary" style={{ width: 'auto', padding: '0 14px', height: 36 }} onClick={onCloseAdd}>
                Terminé
              </button>
            </div>
            <div className="drawer-body">
              <div className="search-input" style={{ marginBottom: 14 }}>
                <input
                  id="shop-add"
                  type="text"
                  placeholder="Ajouter un article..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd()
                  }}
                />
                {name.trim() && <span className="add-cat-hint">{categoryLabel(draftCategory)}</span>}
                <button className="icon-btn" onClick={handleAdd} aria-label="Ajouter" style={{ width: 36, height: 36 }} disabled={!name.trim()}>
                  <Icon name="plus" />
                </button>
              </div>

              <div className="qty-row" style={{ padding: 0, marginBottom: 14 }}>
                <span className="qty-row-label">Quantité</span>
                <QuantityWheel values={scale.values} value={qty} onChange={setQty} format={scale.format} />
              </div>

              {suggestions.length > 0 && (
                <div className="suggest-list" style={{ padding: 0, marginBottom: 14 }}>
                  {suggestions.map((it) => (
                    <button key={it.name} className="suggest-row" onClick={() => pickItem(it)}>
                      <Icon name="plus" width={2} />
                      <span className="suggest-name">{it.name}</span>
                      <span className="suggest-cat">{categoryLabel(it.category)}</span>
                    </button>
                  ))}
                </div>
              )}

              {!typed && catalog.length > 0 && (
                <div className="browse" style={{ padding: 0 }}>
                  <button className="browse-toggle" onClick={() => setBrowseAll((b) => !b)}>
                    <Icon name="cart" width={2} />
                    Déjà achetés ({catalog.length})
                    <Icon name="chevron" width={2} className={browseAll ? 'rot' : ''} />
                  </button>
                  {browseAll && (
                    <div className="quick-add-chips">
                      {catalog.slice(0, 40).map((it) => (
                        <button key={it.name} className="quick-chip" onClick={() => pickItem(it)}>
                          <Icon name="plus" width={2.4} />
                          {it.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
