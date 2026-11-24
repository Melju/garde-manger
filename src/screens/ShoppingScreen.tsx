import { useEffect, useMemo, useState } from 'react'
import { openVoice } from '../components/VoiceAssistant'
import { useStore } from '../data/store'
import { detectNearbyStores, type NearbyStore } from '../lib/geoStore'
import { addStore, getCurrentStore, getStores, habitsFor, isUsualAt, recordPurchases, setCurrentStore } from '../lib/stores'
import { LowStockSheet, lowStockCandidates, type LowCandidate } from '../components/LowStockSheet'
import { euros, pricesByStore, priceKey, usePriceObs } from '../lib/prices'
import { useBasketEstimate } from '../lib/costs'
import { kioskEnabled } from '../lib/kiosk'
import { useToast } from '../components/Toast'
import { Icon, categoryIcon } from '../components/Icon'
import { categoryColor } from '../lib/categoryColors'
import { chosenIconSlug, productImageSlug, productImageUrl } from '../lib/productImage'
import { QuantityWheel } from '../components/QuantityWheel'
import { CartSheet } from '../components/CartSheet'
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
    undoAddedProducts,
    restoreShoppingItems,
    addShoppingBatch,
    removeShoppingItems,
    settings,
    cloudMode,
  } = useStore()
  // Affichage de la liste : lignes ou grille d'illustrations (mémorisé sur l'appareil).
  const [shopView, setShopView] = useState<'list' | 'grid'>(() => {
    try {
      return localStorage.getItem('miamm.shopView') === 'grid' ? 'grid' : 'list'
    } catch {
      return 'list'
    }
  })
  function toggleShopView() {
    const v = shopView === 'grid' ? 'list' : 'grid'
    setShopView(v)
    try {
      localStorage.setItem('miamm.shopView', v)
    } catch {
      /* stockage indisponible */
    }
  }
  // Panier (tampon) : les articles cochés, rangés au stock en une fois au retour.
  const cart = shopping.filter((it) => it.checked)
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [bump, setBump] = useState(0)
  const [cartSheet, setCartSheet] = useState(false)
  const [cartAt, setCartAt] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('miamm.cartAt')) || 0
    } catch {
      return 0
    }
  })
  /** Coche : l'article se coche, glisse hors de la liste puis rejoint le panier (avec un Annuler). */
  function tick(id: string) {
    const it = shopping.find((x) => x.id === id)
    if (!it || leaving.has(id)) return
    if (!it.checked) {
      setLeaving((s) => new Set(s).add(id))
      setTimeout(() => {
        void toggleShoppingItem(id)
        setLeaving((s) => {
          const n = new Set(s)
          n.delete(id)
          return n
        })
        setBump((b) => b + 1)
      }, 380)
      toast(`${it.name} est dans le panier`, { label: 'Annuler', onClick: () => void toggleShoppingItem(id) })
    } else {
      void toggleShoppingItem(id)
      toast(`${it.name} remis dans la liste`)
    }
    const now = Date.now()
    setCartAt(now)
    try {
      localStorage.setItem('miamm.cartAt', String(now))
    } catch {
      /* stockage indisponible */
    }
  }
  // On propose de ranger quand tout est pris, ou quand le panier attend depuis plus de 20 minutes (retour de courses).
  /** Illustration d'un article : celle du produit en stock s'il y en a une choisie, sinon devinée du nom. */
  function shopImage(name: string): string | null {
    const inStock = products.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())
    return chosenIconSlug(inStock?.imageUrl) ?? productImageSlug(name)
  }
  const [lowPick, setLowPick] = useState<LowCandidate[] | null>(null)
  const priceObs = usePriceObs()
  const basket = useBasketEstimate(shopping, priceObs, products, cloudMode)
  const [basketOpen, setBasketOpen] = useState(false)
  // Pour chaque article : magasins comparables (au moins 2 prix relevés).
  const priceInfo = useMemo(() => {
    const m = new Map<string, ReturnType<typeof pricesByStore>>()
    for (const it of shopping) {
      const list = pricesByStore(priceObs, it.name)
      if (list.length > 1) m.set(it.id, list)
    }
    return m
  }, [shopping, priceObs])
  const cheapestSummary = useMemo(() => {
    const count = new Map<string, number>()
    for (const it of shopping) {
      const list = priceInfo.get(it.id)
      if (!list || it.checked) continue
      count.set(list[0].store, (count.get(list[0].store) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1])
  }, [shopping, priceInfo])
  const toast = useToast()

  const [name, setName] = useState('')
  const [quick, setQuick] = useState('')
  const [quickFocus, setQuickFocus] = useState(false)
  const [qty, setQty] = useState(1)
  const [browseAll, setBrowseAll] = useState(false)
  const [store, setStore] = useState(getCurrentStore())
  const [pickingStore, setPickingStore] = useState(false)
  const [newStore, setNewStore] = useState('')
  const [storeTick, setStoreTick] = useState(0)
  const [nearby, setNearby] = useState<NearbyStore[] | null>(null)
  const [locating, setLocating] = useState(false)
  const [locMsg, setLocMsg] = useState('')
  async function locate(auto = false) {
    if (locating) return
    setLocating(true)
    setLocMsg('')
    setNearby(null)
    try {
      const found = await detectNearbyStores()
      if (found.length === 0) {
        setLocMsg('Aucun magasin trouvé à moins de 200 m. Choisis-le dans la liste.')
      } else if (auto && found[0].name === store) {
        /* déjà le bon magasin */
      } else {
        setNearby(found.slice(0, 4))
      }
    } catch (e) {
      setLocMsg(e instanceof Error && e.message ? e.message : 'Position indisponible')
    } finally {
      setLocating(false)
    }
  }
  // À l'ouverture de l'écran, on cherche le magasin tout seul (au plus une fois toutes les 10 minutes).
  useEffect(() => {
    // Tablette fixe à la maison : pas de recherche du magasin (ni demande de localisation).
    if (kioskEnabled()) return
    let last = 0
    try {
      last = Number(sessionStorage.getItem('miamm.geo.last') ?? 0)
    } catch {
      /* ignore */
    }
    if (Date.now() - last < 10 * 60 * 1000) return
    try {
      sessionStorage.setItem('miamm.geo.last', String(Date.now()))
    } catch {
      /* ignore */
    }
    void locate(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function chooseStore(n: string) {
    setCurrentStore(n)
    setStore(n)
    setPickingStore(false)
    setNewStore('')
  }

  const remaining = shopping.filter((it) => !it.checked).length
  // On propose de ranger quand tout est pris, ou quand le panier attend depuis plus de 20 minutes (retour de courses).
  const offerStow = cart.length > 0 && (remaining === 0 || Date.now() - cartAt > 20 * 60_000)

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

  // Stock actuel d'un article (somme des produits du même nom), undefined s'il n'est pas en stock.
  const stockOf = (nm: string): number | undefined => {
    const k = nm.trim().toLowerCase()
    const found = products.filter((p) => p.name.trim().toLowerCase() === k)
    return found.length ? found.reduce((t, p) => t + p.quantity, 0) : undefined
  }
  // Fréquence d'achat : le plus haut compteur entre l'apprentissage global et les habitudes du magasin.
  const freqOf = (nm: string) => Math.max(lookup.get(nm.trim().toLowerCase())?.count ?? 0, store ? isUsualAt(store, nm) : 0)

  // Les plus souvent achetés qui manquent (absents du stock ou presque) et pas encore dans la liste.
  const usual = useMemo(() => {
    const inList = new Set(shopping.map((it) => it.name.trim().toLowerCase()))
    const seen = new Set<string>()
    const out: { name: string; category: Category; unit: string; qty?: number; count: number; stock?: number }[] = []
    const consider = (h: { name: string; category: Category; unit: string; qty?: number; count: number }) => {
      const k = h.name.trim().toLowerCase()
      if (!k || seen.has(k) || inList.has(k)) return
      const st = stockOf(h.name)
      if (st !== undefined && st > 1) return
      seen.add(k)
      out.push({ ...h, stock: st })
    }
    if (store) habitsFor(store).forEach(consider)
    catalog.filter((it) => it.count >= 2).forEach(consider)
    return out.sort((a, b) => b.count - a.count).slice(0, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, shopping, products, catalog, storeTick])

  const typed = name.trim().toLowerCase()

  // Brouillon courant : unité + catégorie devinées depuis l'article.
  const match = typed ? lookup.get(typed) : undefined
  const draftCategory: Category = match?.category ?? (typed ? guessCategoryFromName(name) : 'autre')
  // Les conserves s'achètent à l'unité (boîtes), jamais au poids.
  const rawUnit =
    draftCategory === 'conserves' ? '' : (match?.unit ?? (typed ? guessUnitFromName(name) : ''))
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
      if (it.checked) continue // les articles cochés vont dans « Dans le panier »
      const arr = map.get(it.category) ?? []
      arr.push(it)
      map.set(it.category, arr)
    }
    // Dans chaque rayon, les articles les plus souvent achetés passent en premier.
    for (const arr of map.values()) arr.sort((a, b) => freqOf(b.name) - freqOf(a.name))
    return CATEGORIES.map((c) => ({ category: c.id, items: map.get(c.id) ?? [] })).filter(
      (g) => g.items.length > 0,
    )
  }, [shopping, store, storeTick, lookup])

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

  // Ajout éclair depuis le champ en haut de liste : catégorie et unité devinées, quantité par défaut.
  async function quickAdd(raw?: string) {
    const trimmed = (raw ?? quick).trim()
    if (!trimmed) return
    const known = lookup.get(trimmed.toLowerCase())
    const category: Category = known?.category ?? guessCategoryFromName(trimmed)
    const unitRaw = category === 'conserves' ? '' : (known?.unit ?? guessUnitFromName(trimmed))
    const sc = buyScale(unitRaw)
    await addShoppingItem({
      name: known?.name ?? trimmed,
      category,
      quantity: known?.qty ?? sc.defaultValue,
      unit: sc.baseUnit || undefined,
      source: 'manuel',
    })
    await recordShopItem(known?.name ?? trimmed, category, unitRaw, known?.qty ?? sc.defaultValue)
    setQuick('')
  }
  // Champ vide et actif : ce qu'on achète le plus souvent (et pas déjà sur la liste).
  // Dès 2 lettres : les articles connus qui correspondent.
  const quickSuggestions = useMemo(() => {
    const q = quick.trim().toLowerCase()
    const inList = new Set(shopping.filter((it) => !it.checked).map((it) => it.name.toLowerCase()))
    if (!q) {
      if (!quickFocus) return []
      // Fréquence = achats appris (liste de courses) + passages dans l'historique du stock.
      const hist = new Map<string, number>()
      for (const h of history) {
        const m = h.label.match(/^(.*?)\s(ajouté|consommé)/)
        if (m) hist.set(m[1].trim().toLowerCase(), (hist.get(m[1].trim().toLowerCase()) ?? 0) + 1)
      }
      return catalog
        .map((it) => ({ it, score: it.count * 3 + (hist.get(it.name.toLowerCase()) ?? 0) }))
        .filter((x) => x.score > 0 && !inList.has(x.it.name.toLowerCase()))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map((x) => x.it)
    }
    if (q.length < 2) return []
    return catalog.filter((it) => it.name.toLowerCase().includes(q) && !inList.has(it.name.toLowerCase())).slice(0, 8)
  }, [catalog, quick, shopping, quickFocus, history])

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
  async function addCheckedToStock(dates: Record<string, string> = {}) {
    const checked = shopping.filter((it) => it.checked)
    if (checked.length === 0) return
    const createdIds: string[] = []
    for (const it of checked) {
      const conservation = defaultConservation(it.category)
      const byWeight = !!it.unit && ['g', 'kg', 'mL', 'L'].includes(it.unit)
      const created = await addProduct({
        name: it.name,
        category: it.category,
        conservation,
        quantity: byWeight ? 1 : it.quantity,
        size: byWeight ? formatContenance(it.quantity, it.unit!) : undefined,
        dateType: 'dlc',
        expiryDate: (it.id in dates ? dates[it.id] : estimatedExpiryISO(it.name, conservation, it.category)) || undefined,
      })
      if (created?.id) createdIds.push(created.id)
    }
    if (store) {
      recordPurchases(store, checked.map((it) => ({ name: it.name, category: it.category, unit: it.unit, quantity: it.quantity })))
      setStoreTick((t) => t + 1)
    }
    await clearCheckedShopping()
    toast(`${checked.length} article${checked.length > 1 ? 's' : ''} rangé${checked.length > 1 ? 's' : ''} dans le stock`, {
      label: 'Annuler',
      onClick: async () => {
        await undoAddedProducts(createdIds)
        await restoreShoppingItems(checked)
        toast('Annulé : les articles sont revenus dans la liste')
      },
    })
  }

  function handleGenerate() {
    const existing = new Set(shopping.map((it) => it.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()))
    const cands = lowStockCandidates(products, existing, settings.lowStockThreshold, shopCatalog)
    if (cands.length === 0) {
      toast('Aucun stock faible à ajouter')
      return
    }
    setLowPick(cands)
  }

  async function addPicked(picked: LowCandidate[]) {
    setLowPick(null)
    const ids = await addShoppingBatch(
      picked.map((c) => ({ name: c.name, category: c.category, quantity: 1, source: 'auto' as const })),
    )
    toast(`${ids.length} article${ids.length > 1 ? 's' : ''} ajouté${ids.length > 1 ? 's' : ''}`, {
      label: 'Annuler',
      onClick: () => {
        void removeShoppingItems(ids).then(() => toast('Ajout annulé'))
      },
    })
  }

  return (
    <div className="screen-fade">
      <div className="sticky-zone">
      <header className="header">
        <div className="header-left">
          <h1>Liste de courses</h1>
          <p>{remaining} article{remaining !== 1 ? 's' : ''} restant{remaining !== 1 ? 's' : ''}</p>
        </div>
        <div className="header-actions">
          {cart.length > 0 && (
            <button
              type="button"
              key={bump}
              className={`icon-btn cart-btn${bump ? ' bump' : ''}`}
              onClick={() => setCartSheet(true)}
              aria-label={`Panier : ${cart.length} article${cart.length > 1 ? 's' : ''}`}
              title="Voir le panier"
            >
              <Icon name="cart" />
              <span className="cart-badge">{cart.length}</span>
            </button>
          )}
          <button
            type="button"
            className={`icon-btn${shopView === 'grid' ? ' on' : ''}`}
            onClick={toggleShopView}
            aria-label={shopView === 'grid' ? 'Afficher en liste' : 'Afficher en grille'}
            title={shopView === 'grid' ? 'Afficher en liste' : 'Afficher en grille'}
          >
            <Icon name={shopView === 'grid' ? 'list' : 'grid'} />
          </button>
        </div>
      </header>

      <div className="shop-quick">
        <div className="search-input">
          <Icon name="plus" />
          <input
            type="text"
            aria-label="Ajouter un article"
            placeholder="Ajouter un article…"
            value={quick}
            enterKeyHint="done"
            onChange={(e) => setQuick(e.target.value)}
            onFocus={() => setQuickFocus(true)}
            onBlur={() => setTimeout(() => setQuickFocus(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void quickAdd()
            }}
          />
          {quick.trim() ? (
            <button className="shop-quick-go" onClick={() => void quickAdd()} aria-label="Ajouter">
              <Icon name="check" width={2.5} />
            </button>
          ) : (
            <button className="shop-quick-mic" onClick={() => openVoice()} aria-label="Commande vocale" title="Commande vocale">
              <Icon name="mic" />
            </button>
          )}
        </div>
        {quickSuggestions.length > 0 && (
          <>
            {!quick.trim() && <div className="shop-quick-label">Souvent achetés</div>}
            <div className={`shop-quick-sugg${quick.trim() ? '' : ' wrap'}`}>
              {quickSuggestions.map((it) => (
                <button
                  key={it.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void quickAdd(it.name)}
                >
                  <Icon name="plus" width={2.5} />
                  {it.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {offerStow && (
        <button type="button" className="stow-banner" onClick={() => setCartSheet(true)}>
          <Icon name="cart" />
          <span>
            {remaining === 0 ? 'Tout est dans le panier !' : 'De retour des courses ?'}{' '}
            <strong>
              Ranger {cart.length} article{cart.length > 1 ? 's' : ''} au stock
            </strong>
          </span>
          <Icon name="chevron" />
        </button>
      )}

      </div>

      {lowPick && <LowStockSheet candidates={lowPick} onConfirm={addPicked} onCancel={() => setLowPick(null)} />}
      <div className="store-bar">
        <button type="button" className="store-chip" onClick={handleGenerate}>
          <Icon name="sparkles" width={2} />
          Stocks faibles
        </button>
        <button type="button" className="store-chip" onClick={() => setPickingStore((v) => !v)}>
          <Icon name="cart" width={2} />
          {store || 'Magasin'}
        </button>
        <button type="button" className="store-chip" onClick={() => locate(false)} disabled={locating} aria-label="Trouver le magasin où je suis">
          {locating ? 'Recherche…' : 'Où suis-je ?'}
        </button>
      </div>
      {locating && <p className="store-msg">Recherche du magasin autour de toi…</p>}
      {locMsg && <p className="store-msg">{locMsg}</p>}
      {nearby && nearby.length > 0 && (
        <div className="store-picker">
          <div className="usual-title">Tu es chez…</div>
          <div className="store-grid">
            {nearby.map((n) => (
              <button
                key={n.name}
                type="button"
                className="store-opt"
                onClick={() => {
                  addStore(n.name)
                  chooseStore(n.name)
                  setNearby(null)
                }}
              >
                {n.name} · {n.distance} m
              </button>
            ))}
            <button type="button" className="store-opt none" onClick={() => setNearby(null)}>
              Aucun
            </button>
          </div>
        </div>
      )}
      {pickingStore && (
        <div className="store-picker">
          <div className="store-grid">
            {getStores().map((n) => (
              <button key={n} type="button" className={`store-opt${n === store ? ' active' : ''}`} onClick={() => chooseStore(n)}>
                {n}
              </button>
            ))}
            {store && (
              <button type="button" className="store-opt none" onClick={() => chooseStore('')}>
                Aucun
              </button>
            )}
          </div>
          <div className="store-new">
            <input className="form-input" placeholder="Autre magasin…" value={newStore} onChange={(e) => setNewStore(e.target.value)} />
            <button
              type="button"
              className="btn-secondary"
              disabled={!newStore.trim()}
              onClick={() => {
                addStore(newStore)
                chooseStore(newStore.trim())
              }}
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
      {usual.length > 0 && (
        <div className="usual-here">
          <div className="usual-title">Souvent achetés, à racheter</div>
          <div className="usual-list">
            {usual.map((h) => (
              <button
                key={h.name}
                type="button"
                className="usual-chip"
                onClick={() => addShoppingItem({ name: h.name, category: h.category, quantity: h.qty || 1, unit: h.unit || undefined, source: 'auto' })}
              >
                + {h.name}
                {h.stock !== undefined && <span className="usual-stock"> · {h.stock > 0 ? `${h.stock} en stock` : 'épuisé'}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {cheapestSummary.length > 0 && (
        <div className="cheapest-summary">
          <Icon name="sparkles" />
          <span>
            D'après tes tickets :{' '}
            {cheapestSummary.map(([st, n], i) => (
              <span key={st}>
                {i > 0 && ' · '}
                <strong>{st}</strong> moins cher pour {n} article{n > 1 ? 's' : ''}
              </span>
            ))}
          </span>
        </div>
      )}

      {basket.count > 0 && (basket.estimate != null || basket.stores.length > 0) && (
        <button type="button" className="basket" onClick={() => setBasketOpen((v) => !v)}>
          <div className="basket-head">
            <Icon name="cart" />
            <span>
              Panier estimé{' '}
              <strong>
                ≈ {euros(basket.stores[0]?.total ?? basket.estimate ?? 0)}
              </strong>
              {basket.stores[0] && <em> chez {basket.stores[0].store}</em>}
            </span>
            {basket.stores.length > 0 && <Icon name="chevron" />}
          </div>
          {basketOpen && basket.stores.length > 0 && (
            <div className="basket-stores">
              {basket.stores.slice(0, 5).map((st, i) => (
                <div className="basket-store" key={st.store}>
                  <span>
                    {i === 0 && '★ '}
                    {st.store}
                  </span>
                  <span>
                    {euros(st.total)}
                    <small>
                      {' '}
                      · {st.known}/{basket.count} prix réels
                    </small>
                  </span>
                </div>
              ))}
              <p className="basket-note">
                Prix de tes tickets dans chaque magasin ; à défaut, prix Open Prices ou estimation.
              </p>
            </div>
          )}
        </button>
      )}

      <div className="shopping-groups">
      {grouped.length === 0 ? (
        <div className="empty-state">
          <Icon name={cart.length ? 'check' : 'cart'} />
          <p>{cart.length ? 'Tout est dans le panier !' : 'Votre liste est vide.'}</p>
        </div>
      ) : (
        grouped.map((group) => {
          const col = categoryColor(group.category)
          const left = group.items.filter((it) => !it.checked).length
          return (
          <div className={`shopping-category${shopView === 'grid' ? ' as-grid' : ''}`} key={group.category} style={{ ['--cat-bg' as string]: col.bg, ['--cat-fg' as string]: col.fg }}>
            <div className="shop-cat-head">
              <span className="shop-cat-ico">
                <Icon name={categoryIcon(group.category)} width={2} />
              </span>
              <span className="shop-cat-name">{categoryLabel(group.category)}</span>
              <span className="shop-cat-count">{left === 0 ? '✓' : left}</span>
            </div>
            {shopView === 'grid' ? (
              <div className="shop-grid">
                {group.items.map((it) => {
                  const slug = shopImage(it.name)
                  return (
                    <div key={it.id} className={`shop-tile${it.checked || leaving.has(it.id) ? ' checked' : ''}${leaving.has(it.id) ? ' leaving' : ''}`} onClick={() => tick(it.id)} role="button" tabIndex={0}>
                      <div className="shop-tile-img">
                        {slug ? <img src={productImageUrl(slug)} alt="" loading="lazy" draggable={false} /> : <Icon name={categoryIcon(group.category)} width={1.6} />}
                      </div>
                      <div className="shop-tile-name">{it.name}</div>
                      <div className="shop-tile-qty">{qtyLabel(it.quantity, it.unit)}</div>
                      {it.checked && (
                        <div className="shop-tile-check">
                          <Icon name="check" width={3} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : group.items.map((it) => (
              <div
                key={it.id}
                className={`shopping-item${leaving.has(it.id) ? ' checked leaving' : ''}`}
                onClick={() => tick(it.id)}
              >
                <div className="checkbox">
                  <Icon name="check" width={3} />
                </div>
                <span className="shop-thumb">
                  {(() => {
                    const slug = shopImage(it.name)
                    return slug ? <img src={productImageUrl(slug)} alt="" loading="lazy" draggable={false} /> : <Icon name={categoryIcon(group.category)} width={1.8} />
                  })()}
                </span>
                <span className="shopping-name">
                  {it.name}
                  {(() => {
                    const st = stockOf(it.name)
                    return st ? <span className="shopping-stock">{st} en stock</span> : null
                  })()}
                  {(() => {
                    const list = priceInfo.get(it.id)
                    if (!list) return null
                    const best = list[0]
                    const here = store ? list.find((p) => priceKey(p.store) === priceKey(store)) : undefined
                    if (here && priceKey(here.store) === priceKey(best.store))
                      return <span className="shopping-price best">Meilleur prix ici · {euros(best.price)}</span>
                    return (
                      <span className="shopping-price">
                        Moins cher chez {best.store} · {euros(best.price)}
                        {here ? ` (ici ${euros(here.price)})` : ''}
                      </span>
                    )
                  })()}
                </span>
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
                    toast(`${it.name} retiré de la liste`, { label: 'Annuler', onClick: () => void restoreShoppingItems([it]) })
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
          )
        })
      )}
      {cart.length > 0 && (
        <button type="button" className="cart-summary" onClick={() => setCartSheet(true)}>
          <span className="cart-ico">
            <Icon name="cart" />
          </span>
          <span className="cart-title">
            <strong>Panier · {cart.length}</strong>
            <small>Ajuster ou ranger au stock</small>
          </span>
          <span className="cart-stack" aria-hidden>
            {cart.slice(0, 3).map((it) => {
              const slug = shopImage(it.name)
              const col = categoryColor(it.category)
              return (
                <span key={it.id} style={{ background: col.bg, color: col.fg }}>
                  {slug ? <img src={productImageUrl(slug)} alt="" loading="lazy" draggable={false} /> : <Icon name={categoryIcon(it.category)} width={1.8} />}
                </span>
              )
            })}
            {cart.length > 3 && <span className="cart-more">+{cart.length - 3}</span>}
          </span>
          <Icon name="chevron" className="cart-chev" />
        </button>
      )}
      </div>

      {cartSheet && (
        <CartSheet
          items={cart}
          imageOf={shopImage}
          qtyLabel={qtyLabel}
          onStep={(it, dir) => void stepQty(it, dir)}
          onBack={(it) => tick(it.id)}
          onRemove={(it) => {
            removeShoppingItem(it.id)
            toast(`${it.name} retiré des courses`, { label: 'Annuler', onClick: () => void restoreShoppingItems([it]) })
          }}
          onClear={async () => {
            const gone = cart
            setCartSheet(false)
            await clearCheckedShopping()
            toast(`${gone.length} article${gone.length > 1 ? 's' : ''} retiré${gone.length > 1 ? 's' : ''} du panier`, {
              label: 'Annuler',
              onClick: () => void restoreShoppingItems(gone),
            })
          }}
          onClose={() => setCartSheet(false)}
          onConfirm={(dates) => {
            setCartSheet(false)
            void addCheckedToStock(dates)
          }}
        />
      )}

      {/* Drawer d'ajout (déclenché par le bouton d'action de la page) */}
      {addOpen && (
        <div className="drawer-overlay" onClick={onCloseAdd}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle" />
            <div className="drawer-head">
              <div className="drawer-title">Ajouter un article</div>
              <button
                className="btn-secondary"
                style={{ width: 'auto', padding: '0 14px', height: 36 }}
                onClick={async () => {
                  if (name.trim()) await handleAdd()
                  onCloseAdd()
                }}
              >
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
