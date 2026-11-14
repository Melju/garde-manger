import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { ProductItem } from '../components/ProductItem'
import { CATEGORIES, type Category, type Product } from '../types'
import { remainingLabel, isBareWeightUnit, sachetsPerBox } from '../lib/contenance'
import { expiryLabel, priorityProducts, urgentCount } from '../lib/expiry'
import { budgetSummary } from '../lib/analytics'
import { addProductsToStores, getStores, storesFor } from '../lib/stores'
import { learnPlace } from '../lib/learnedPlace'

const LOCATIONS = ['Placard', 'Réfrigérateur', 'Congélateur', 'Cellier', 'Cave', 'Corbeille']
type PickMode = 'store' | 'category' | 'location'

interface InventoryScreenProps {
  onEdit: (product: Product) => void
  onOpenStats: () => void
  onOpenNotifications: () => void
  onOpenBudget: () => void
  onScanConsume: () => void
}

type Filter = 'tout' | Category

export function InventoryScreen({
  onEdit,
  onOpenStats,
  onOpenNotifications,
  onOpenBudget,
  onScanConsume,
}: InventoryScreenProps) {
  const { products, adjustQuantity, wasteProduct, updateProduct, addProduct, expenses, budget, cloudMode, offline, unreadNotifCount } = useStore()
  const spent = useMemo(() => budgetSummary(expenses, budget).spent, [expenses, budget])
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('tout')
  // Mode sélection : associer plusieurs produits à un magasin d'un coup.
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [pickedStores, setPickedStores] = useState<string[]>([])
  const [pickMode, setPickMode] = useState<PickMode>('store')
  const [pickedCat, setPickedCat] = useState<Category | null>(null)
  const [pickedLoc, setPickedLoc] = useState<string | null>(null)
  const storeChoices = useMemo(() => getStores(), [selecting])

  const priority = useMemo(() => priorityProducts(products), [products])
  const urgent = useMemo(() => urgentCount(products), [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (filter !== 'tout' && p.category !== filter) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, search, filter])

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function stopSelecting() {
    setSelecting(false)
    setPicked(new Set())
    setPickedStores([])
    setPickedCat(null)
    setPickedLoc(null)
    setPickMode('store')
  }
  const canApply =
    picked.size > 0 &&
    (pickMode === 'store' ? pickedStores.length > 0 : pickMode === 'category' ? !!pickedCat : !!pickedLoc)

  async function applyBatch() {
    const items = products.filter((p) => picked.has(p.id))
    if (!items.length || !canApply) return
    const n = items.length
    const plural = n > 1 ? 's' : ''
    if (pickMode === 'store') {
      addProductsToStores(
        items.map((p) => ({ name: p.name, category: p.category, unit: p.unit, quantity: p.quantity })),
        pickedStores,
      )
      toast(`${n} produit${plural} associé${plural} à ${pickedStores.join(', ')}`)
    } else if (pickMode === 'category' && pickedCat) {
      for (const p of items) await updateProduct(p.id, { category: pickedCat })
      toast(`${n} produit${plural} classé${plural} en ${CATEGORIES.find((c) => c.id === pickedCat)?.label}`)
    } else if (pickMode === 'location' && pickedLoc) {
      const low = pickedLoc.toLowerCase()
      const conservation = low.includes('congel') ? 'congele' : low.includes('refrig') || low.includes('réfrig') ? 'refrigere' : 'frais'
      for (const p of items) {
        await updateProduct(p.id, { location: pickedLoc, conservation })
        learnPlace(p.name, p.category, pickedLoc)
      }
      toast(`${n} produit${plural} rangé${plural} : ${pickedLoc}`)
    }
    stopSelecting()
  }

  async function handleRemoveQty(product: Product, qty: number | 'all') {
    const delta = qty === 'all' ? -product.quantity : -qty
    await adjustQuantity(product.id, delta)
    const remaining = qty === 'all' ? 0 : product.quantity - qty
    toast(remaining <= 0 ? `${product.name} retiré du stock` : `${product.name} : ×${remaining}`)
  }

  async function handleWaste(product: Product) {
    await wasteProduct(product.id)
    toast(`${product.name} marqué périmé`)
  }

  // Retire n sachets sur plusieurs boîtes : boîtes entières d'abord, la dernière entamée devient un lot à part.
  async function handleConsumeSachets(product: Product, n: number) {
    const per = sachetsPerBox(product.size)
    if (!per) return
    const remaining = product.quantity * per - n
    if (remaining <= 0) {
      await adjustQuantity(product.id, -Math.max(1, product.quantity))
      toast(`${product.name} terminé`)
      return
    }
    const full = Math.floor(remaining / per)
    const rem = remaining % per
    const partial = `${rem} sachet/${per} sachet`
    if (rem === 0) {
      await updateProduct(product.id, { quantity: full })
    } else if (full === 0) {
      await updateProduct(product.id, { quantity: 1, size: partial })
    } else {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = product
      await updateProduct(product.id, { quantity: full })
      await addProduct({ ...rest, quantity: 1, size: partial })
    }
    toast(`${product.name} : ${remaining} sachet${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`)
  }

  async function handleConsumePortion(product: Product, newSize: string | null) {
    if (newSize === null) {
      // Contenance épuisée : on retire le produit du stock (consommé).
      await adjustQuantity(product.id, -Math.max(1, product.quantity))
      toast(`${product.name} terminé`)
    } else {
      await updateProduct(product.id, isBareWeightUnit(product.size) ? { size: newSize, quantity: 1 } : { size: newSize })
      toast(`${product.name} : ${remainingLabel(newSize)} restant`)
    }
  }

  return (
    <div className="screen-fade">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">Miamm</h1>
          <p className="sub-mode">
            {products.length} produits ·{' '}
            <Icon name={offline ? 'cloud' : cloudMode ? 'cloud' : 'phone'} />
            {offline ? 'hors-ligne' : cloudMode ? 'synchronisé' : 'local'}
          </p>
        </div>
        <div className="header-actions">
          <button
            className={`icon-btn${selecting ? ' on' : ''}`}
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            aria-label="Modifier plusieurs produits (magasin, catégorie, emplacement)"
          >
            <Icon name="cart" />
          </button>
          <button className="icon-btn" onClick={onScanConsume} aria-label="Scanner un retrait">
            <Icon name="scan" />
          </button>
          <button className="icon-btn" onClick={onOpenNotifications} aria-label="Notifications">
            <Icon name="bell" />
            {unreadNotifCount > 0 && <span className="notif-badge">{unreadNotifCount}</span>}
          </button>
        </div>
      </header>

      <div className="stats-strip">
        <div className="stat-box" onClick={onOpenStats}>
          <div className="value">{products.length}</div>
          <div className="label">Produits</div>
        </div>
        <div className={`stat-box${urgent > 0 ? ' alert' : ''}`} onClick={onOpenNotifications}>
          <div className="value">{urgent}</div>
          <div className="label">Urgent</div>
        </div>
        <div className="stat-box" onClick={onOpenBudget}>
          <div className="value">{spent}€</div>
          <div className="label">Ce mois</div>
        </div>
      </div>

      {priority.length > 0 && (
        <div className="priority-section">
          <div className="priority-header">
            <Icon name="alert" />
            <h2>À consommer en priorité</h2>
          </div>
          <div className="priority-scroll">
            {priority.map((p) => (
              <div key={p.id} className="priority-card" onClick={() => onEdit(p)}>
                <div className="name">{p.name}</div>
                <div className="expiry">{expiryLabel(p)}</div>
                <div className="qty">
                  ×{p.quantity}
                  {p.unit ? ` ${p.unit}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="search-row">
        <div className="search-input">
          <Icon name="search" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-tabs">
        <button
          className={`filter-tab${filter === 'tout' ? ' active' : ''}`}
          onClick={() => setFilter('tout')}
        >
          Tout
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`filter-tab${filter === c.id ? ' active' : ''}`}
            onClick={() => setFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className={`product-list${selecting ? ' selecting' : ''}`}>
        <div className="list-header">
          <span className="list-title">
            {filter === 'tout' ? 'Tous les produits' : CATEGORIES.find((c) => c.id === filter)?.label}
          </span>
          <span className="list-count">{filtered.length} articles</span>
        </div>

        {filtered.length > 0 ? (
          <>
            {selecting ? (
              <div className="swipe-hint select-hint">
                <button type="button" onClick={() => setPicked(new Set(filtered.map((p) => p.id)))}>Tout sélectionner</button>
                <button type="button" onClick={() => setPicked(new Set())}>Aucun</button>
              </div>
            ) : (
              <div className="swipe-hint">
                <Icon name="back" />
                Glissez à gauche pour retirer · à droite si périmé
              </div>
            )}
            {filtered.map((p) =>
              selecting ? (
                <button
                  key={p.id}
                  type="button"
                  className={`select-row${picked.has(p.id) ? ' on' : ''}`}
                  onClick={() => togglePick(p.id)}
                >
                  <span className={`check-box${picked.has(p.id) ? ' on' : ''}`}>
                    {picked.has(p.id) && <Icon name="check" width={3} />}
                  </span>
                  <span className="select-name">{p.name}</span>
                  <span className="select-stores">
                    {pickMode === 'store'
                      ? storesFor(p.name).join(', ')
                      : pickMode === 'category'
                        ? CATEGORIES.find((c) => c.id === p.category)?.label
                        : p.location}
                  </span>
                </button>
              ) : (
                <ProductItem
                  key={p.id}
                  product={p}
                  onSelect={onEdit}
                  onRemoveQty={handleRemoveQty}
                  onWaste={handleWaste}
                  onConsumePortion={handleConsumePortion}
                  onConsumeSachets={handleConsumeSachets}
                />
              ),
            )}
          </>
        ) : (
          <div className="empty-state">
            <Icon name="box" />
            <p>
              {products.length === 0
                ? 'Aucun produit. Ajoutez-en un avec le bouton +.'
                : 'Aucun produit ne correspond.'}
            </p>
          </div>
        )}
      </div>

      {selecting && (
        <div className="select-bar">
          <div className="select-bar-top">
            <button type="button" className="select-close" onClick={stopSelecting} aria-label="Annuler la sélection">
              <Icon name="back" width={2.4} />
            </button>
            <div className="select-bar-title">
              {picked.size} sélectionné{picked.size > 1 ? 's' : ''}
            </div>
            <button type="button" className="select-apply" disabled={!canApply} onClick={applyBatch}>
              <Icon name="check" width={2.6} /> Appliquer
            </button>
          </div>
          <div className="select-tabs">
            {([['store', 'Magasin'], ['category', 'Catégorie'], ['location', 'Emplacement']] as [PickMode, string][]).map(([id, label]) => (
              <button key={id} type="button" className={pickMode === id ? 'on' : ''} onClick={() => setPickMode(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="select-choices">
            {pickMode === 'store' &&
              storeChoices.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`store-opt${pickedStores.includes(n) ? ' active' : ''}`}
                  onClick={() => setPickedStores((st) => (st.includes(n) ? st.filter((x) => x !== n) : [...st, n]))}
                >
                  {n}
                </button>
              ))}
            {pickMode === 'category' &&
              CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={`store-opt${pickedCat === c.id ? ' active' : ''}`} onClick={() => setPickedCat(c.id)}>
                  {c.label}
                </button>
              ))}
            {pickMode === 'location' &&
              LOCATIONS.map((l) => (
                <button key={l} type="button" className={`store-opt${pickedLoc === l ? ' active' : ''}`} onClick={() => setPickedLoc(l)}>
                  {l}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
