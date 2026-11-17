import { ClearButton } from '../components/ClearButton'
import { useEasterEgg } from '../components/EasterEggs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { kioskEnabled, KIOSK_IDLE } from '../lib/kiosk'
import { defaultSort, sortProducts, SORT_OPTIONS, type InventorySort } from '../lib/inventorySort'
import { Select } from '../components/Select'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { ProductItem } from '../components/ProductItem'
import { CATEGORIES, type Category, type Product } from '../types'
import { conservationOfLocation } from '../lib/location'
import { remainingLabel, isBareWeightUnit, isWeightProduct, countPerPack, countLabel } from '../lib/contenance'
import { urgentCount } from '../lib/expiry'
import { budgetSummary } from '../lib/analytics'
import { normalize } from '../lib/productIcon'
import { splitBrand } from '../lib/brandSplit'
import { splitWeight } from '../lib/weightSplit'
import { extractPackSize } from '../lib/packSize'
import { setProductStores } from '../lib/stores'
import { addProductsToStores, getStores, storeInName, storesFor } from '../lib/stores'
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
  useEasterEgg(search)
  // Indice de glissement : animation jouée une seule fois, à la première visite.
  const [swipeHintSeen, setSwipeHintSeen] = useState(() => {
    try {
      return localStorage.getItem('miamm.swipehint.v1') === '1'
    } catch {
      return true
    }
  })
  function doneSwipeHint() {
    setSwipeHintSeen(true)
    try {
      localStorage.setItem('miamm.swipehint.v1', '1')
    } catch {
      /* ignore */
    }
  }
  // Mode sélection : associer plusieurs produits à un magasin d'un coup.
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [pickedStores, setPickedStores] = useState<string[]>([])
  const [pickMode, setPickMode] = useState<PickMode>('store')
  const [pickedCat, setPickedCat] = useState<Category | null>(null)
  const [pickedLoc, setPickedLoc] = useState<string | null>(null)
  const storeChoices = useMemo(() => getStores(), [selecting])
  const brandBusy = useRef(false)
  const weightBusy = useRef(false)
  // Une seule fois : associe aux produits déjà enregistrés le magasin cité dans leur nom (ex : « … Auchan »).
  useEffect(() => {
    const FLAG = 'miamm.brandstores.v1'
    try {
      if (!products.length || localStorage.getItem(FLAG)) return
      for (const p of products) {
        const st = storeInName(p.name)
        if (st && !storesFor(p.name).includes(st)) {
          addProductsToStores([{ name: p.name, category: p.category, quantity: p.quantity }], [st])
        }
      }
      localStorage.setItem(FLAG, '1')
    } catch {
      /* ignore */
    }
  }, [products.length > 0])
  // Une seule fois : sort la marque du nom des produits existants (champ « marque »).
  useEffect(() => {
    const FLAG = 'miamm.brandsplit.v1'
    try {
      if (!products.length || localStorage.getItem(FLAG)) return
      localStorage.setItem(FLAG, '1')
      brandBusy.current = true
      void (async () => {
        for (const p of products) {
          if (p.brand) continue
          const r = splitBrand(p.name)
          if (!r || r.name.length < 3) continue
          const shops = storesFor(p.name)
          await updateProduct(p.id, { name: r.name, brand: r.brand })
          if (shops.length) setProductStores(r.name, p.category, undefined, p.quantity, shops)
        }
      })()
    } catch {
      /* ignore */
    }
  }, [products.length > 0])

  // Une seule fois : sort le poids du nom (« … 180g ») et renseigne la contenance quand elle manque ou diffère.
  useEffect(() => {
    const FLAG = 'miamm.weightsplit.v1'
    try {
      if (!products.length || brandBusy.current || localStorage.getItem(FLAG)) return
      localStorage.setItem(FLAG, '1')
      weightBusy.current = true
      void (async () => {
        for (const p of products) {
          const r = splitWeight(p.name)
          if (!r) continue
          const partial = !!p.size && p.size.includes('/') // quantité entamée : on ne touche pas
          const patch: { name: string; size?: string } = { name: r.name }
          if (!partial && p.size !== r.size) patch.size = r.size
          const shops = storesFor(p.name)
          await updateProduct(p.id, patch)
          if (shops.length) setProductStores(r.name, p.category, undefined, p.quantity, shops)
        }
        weightBusy.current = false
      })()
    } catch {
      /* ignore */
    }
  }, [products])

  // Une seule fois : répare les contenances illisibles (« 2 x 113 gram » → « 226 g »).
  useEffect(() => {
    const FLAG = 'miamm.sizefix.v1'
    try {
      if (!products.length || brandBusy.current || weightBusy.current || !localStorage.getItem('miamm.weightsplit.v1') || localStorage.getItem(FLAG)) return
      localStorage.setItem(FLAG, '1')
      void (async () => {
        for (const p of products) {
          if (!p.size || p.size.includes('/')) continue
          if (/^[\d.,]+\s*(g|kg|mL|cl|L|pièces?|packs?|boîtes?|sachets?|pots?|tranches?)$/i.test(p.size.trim())) continue
          const fixed = extractPackSize(p.size)
          if (fixed && fixed !== p.size) await updateProduct(p.id, { size: fixed })
        }
      })()
    } catch {
      /* ignore */
    }
  }, [products])

  // En sélection, la barre d'actions prend la place du bouton « Ajouter » (évite la superposition).
  useEffect(() => {
    document.body.classList.toggle('is-selecting', selecting)
    return () => document.body.classList.remove('is-selecting')
  }, [selecting])

  const urgent = useMemo(() => urgentCount(products), [products])

  // Recherche unique : nom, marque, catégorie ou magasin (tous les mots saisis doivent correspondre quelque part).
  const [sort, setSort] = useState<InventorySort>(defaultSort)
  const filtered = useMemo(() => {
    const words = normalize(search).split(/\s+/).filter(Boolean)
    if (!words.length) return sortProducts(products, sort)
    return sortProducts(products, sort).filter((p) => {
      const hay = normalize(
        [p.name, p.brand ?? '', CATEGORIES.find((c) => c.id === p.category)?.label ?? '', ...storesFor(p.name)].join(' '),
      )
      return words.every((w) => hay.includes(w))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, selecting, sort])

  // Liste : un produit au poids/volume en plusieurs paquets (2 × 200 g) s'affiche en une ligne par paquet,
  // pour retirer des grammes sur l'un sans toucher l'autre (4 paquets max, hors boissons : un lot de
  // 6 bouteilles reste sur une ligne avec « −1, −2 »). La fiche, elle, garde le total.
  const rows = useMemo(() => {
    const list = filtered.flatMap((p) =>
      !selecting && p.quantity > 1 && p.quantity <= 4 && p.category !== 'boissons' && isWeightProduct(p.size)
        ? Array.from({ length: p.quantity }, (_, i) => ({ key: `${p.id}:${i}`, p: { ...p, quantity: 1 }, full: p as Product | undefined }))
        : [{ key: p.id, p, full: undefined as Product | undefined }],
    )
    // Lignes identiques consécutives (même nom, marque et contenance) : un groupe, replié par défaut.
    const sig = (x: Product) => `${normalize(x.name)}|${normalize(x.brand ?? '')}|${x.size ?? ''}|${x.category}`
    type Row = (typeof list)[number] & { sig: string; gIndex: number; gSize: number }
    const out: Row[] = []
    for (let i = 0; i < list.length; ) {
      let j = i + 1
      const sg = sig(list[i].p)
      while (!selecting && j < list.length && sig(list[j].p) === sg) j++
      for (let k = i; k < j; k++) out.push({ ...list[k], sig: sg, gIndex: k - i, gSize: j - i })
      i = j
    }
    return out
  }, [filtered, selecting])


  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  function toggleGroup(sg: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(sg)) next.delete(sg)
      else next.add(sg)
      return next
    })
  }
  const shown = useMemo(() => rows.filter((r) => r.gSize === 1 || r.gIndex === 0 || openGroups.has(r.sig)), [rows, openGroups])

  // Chargement progressif : on affiche 30 lignes puis 30 de plus à l'approche du bas de la liste.
  const [view, setView] = useState<'list' | 'tiles'>(() => {
    if (kioskEnabled()) return 'tiles'
    try {
      return localStorage.getItem('miamm.inventory.view') === 'tiles' ? 'tiles' : 'list'
    } catch {
      return 'list'
    }
  })
  useEffect(() => {
    const onKiosk = () => kioskEnabled() && setView('tiles')
    const onIdle = () => {
      setSearch('')
      setSort(defaultSort())
      setOpenGroups(new Set())
    }
    window.addEventListener('miamm-kiosk', onKiosk)
    window.addEventListener(KIOSK_IDLE, onIdle)
    return () => {
      window.removeEventListener('miamm-kiosk', onKiosk)
      window.removeEventListener(KIOSK_IDLE, onIdle)
    }
  }, [])
  function toggleView() {
    const next = view === 'tiles' ? 'list' : 'tiles'
    setView(next)
    try {
      localStorage.setItem('miamm.inventory.view', next)
    } catch {
      /* ignore */
    }
  }
  const PAGE = 30
  const [visible, setVisible] = useState(PAGE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => setVisible(PAGE), [search, selecting])
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || visible >= shown.length) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + PAGE)
      },
      { rootMargin: '800px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible, shown.length])

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
      const conservation = conservationOfLocation(pickedLoc)
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
    // Ligne d'un seul paquet parmi plusieurs : on ne jette que celui-là.
    const orig = products.find((p) => p.id === product.id)
    await wasteProduct(product.id, orig && orig.quantity > 1 && product.quantity === 1 ? 1 : undefined)
    toast(`${product.name} marqué périmé`)
  }

  // Retire n sachets sur plusieurs boîtes : boîtes entières d'abord, la dernière entamée devient un lot à part.
  async function handleConsumeSachets(product: Product, n: number) {
    const info = countPerPack(product.size)
    if (!info) return
    const { per, unit } = info
    const remaining = product.quantity * per - n
    if (remaining <= 0) {
      await adjustQuantity(product.id, -Math.max(1, product.quantity))
      toast(`${product.name} terminé`)
      return
    }
    const full = Math.floor(remaining / per)
    const rem = remaining % per
    const partial = `${rem} ${unit}/${per} ${unit}`
    if (rem === 0) {
      await updateProduct(product.id, { quantity: full })
    } else if (full === 0) {
      await updateProduct(product.id, { quantity: 1, size: partial })
    } else {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = product
      await updateProduct(product.id, { quantity: full })
      await addProduct({ ...rest, quantity: 1, size: partial })
    }
    toast(`${product.name} : ${countLabel(remaining, unit)} restant${remaining > 1 ? 's' : ''}`)
  }

  async function handleConsumePortion(product: Product, newSize: string | null) {
    const orig = products.find((p) => p.id === product.id)
    if (orig && orig.quantity > 1 && product.quantity === 1) {
      // Un paquet parmi plusieurs : les autres restent pleins, celui-ci devient un lot à part.
      if (newSize === null) {
        await adjustQuantity(product.id, -1)
        toast(`${product.name} terminé`)
      } else {
        const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = orig
        await updateProduct(product.id, { quantity: orig.quantity - 1 })
        await addProduct({ ...rest, quantity: 1, size: newSize })
        toast(`${product.name} : ${remainingLabel(newSize)} restant`)
      }
      return
    }
    if (newSize === null) {
      // Contenance épuisée : on retire le produit du stock (consommé).
      await adjustQuantity(product.id, -Math.max(1, product.quantity))
      toast(`${product.name} terminé`)
    } else {
      await updateProduct(product.id, isBareWeightUnit(product.size) ? { size: newSize, quantity: 1 } : { size: newSize })
      toast(`${product.name} : ${remainingLabel(newSize)} restant`)
    }
  }

  const syncLabel = offline ? 'Hors-ligne' : cloudMode ? 'Synchronisé' : 'Local (non synchronisé)'

  const statsBoxes = (
          <>
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
      </>
  )

  return (
    <div className="screen-fade">
      <div className="sticky-zone">
      <header className="header">
        <div className="header-left">
          <div className="stats-strip stats-desktop">{statsBoxes}</div>
          <h1 className="logo"><img src={`${import.meta.env.BASE_URL}logo.webp`} alt="Miam miam" /></h1>
        </div>
        <div className="header-actions">
          <span className={`sync-ico${offline ? ' off' : ''}`} role="img" aria-label={syncLabel} title={syncLabel}>
            <Icon name={cloudMode && !offline ? 'cloud' : 'phone'} />
          </span>
          <button
            className="icon-btn view-toggle"
            onClick={toggleView}
            aria-label={view === 'tiles' ? 'Affichage en liste' : 'Affichage en tuiles'}
            title={view === 'tiles' ? 'Affichage en liste' : 'Affichage en tuiles'}
          >
            <Icon name={view === 'tiles' ? 'list' : 'grid'} />
          </button>
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

      <div className="search-row">
        <div className="search-input">
          <Icon name="search" />
          <div className="search-field">
            <input
              type="text"
              aria-label="Rechercher"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {!search && (
              <div className="search-hint" aria-hidden="true">
                <span>Rechercher un produit…</span>
                <span>Rechercher une marque…</span>
                <span>Rechercher une catégorie…</span>
                <span>Rechercher un magasin…</span>
              </div>
            )}
          </div>
          {search && <ClearButton onClick={() => setSearch('')} />}
        </div>
        <Select
          className="sort-select"
          ariaLabel="Trier le stock"
          title="Trier par"
          value={sort}
          onChange={(v) => setSort(v as InventorySort)}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          renderTrigger={(label) => (
            <>
              <Icon name="sliders" />
              <span className="sort-label">{label}</span>
            </>
          )}
        />
      </div>

      </div>

      <div className="stats-strip stats-mobile">{statsBoxes}</div>

      {search.trim() && (
        <div className="list-header list-header-outer">
          <span className="list-count">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className={`product-list${selecting ? ' selecting' : ''}${view === 'tiles' ? ' tiles' : ''}`}>

        {filtered.length > 0 ? (
          <>
            {selecting ? (
              <div className="swipe-hint select-hint">
                <button type="button" onClick={() => setPicked(new Set(filtered.map((p) => p.id)))}>Tout sélectionner</button>
                <button type="button" onClick={() => setPicked(new Set())}>Aucun</button>
              </div>
            ) : null}
            {shown.slice(0, visible).map(({ key, p, full, sig, gSize, gIndex }, idx) =>
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
                  key={key}
                  product={p}
                  detail={full}
                  groupPos={gSize > 1 && openGroups.has(sig) ? (gIndex === 0 ? 'first' : gIndex === gSize - 1 ? 'last' : 'middle') : undefined}
                  groupCount={gIndex === 0 ? gSize : undefined}
                  noSwipe={view === 'tiles'}
                  groupOpen={openGroups.has(sig)}
                  onToggleGroup={() => toggleGroup(sig)}
                  onSelect={onEdit}
                  onRemoveQty={handleRemoveQty}
                  onWaste={handleWaste}
                  onConsumePortion={handleConsumePortion}
                  onConsumeSachets={handleConsumeSachets}
                  demo={!swipeHintSeen && idx === 0 && !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches}
                  onDemoDone={doneSwipeHint}
                />
              ),
            )}
            {visible < shown.length && <div ref={sentinelRef} className="list-sentinel" aria-hidden />}
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
