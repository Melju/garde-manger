import { useEffect, useMemo, useState } from 'react'
import { openVoice } from '../components/VoiceAssistant'
import { useStore } from '../data/store'
import { detectNearbyStores, type NearbyStore } from '../lib/geoStore'
import { addStore, getCurrentStore, getStores, habitsFor, isUsualAt, recordPurchases, setCurrentStore } from '../lib/stores'
import { LowStockSheet, lowStockCandidates, type LowCandidate } from '../components/LowStockSheet'
import { euros, pricesByStore, priceKey, usePriceObs } from '../lib/prices'
import { kioskEnabled } from '../lib/kiosk'
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
    addShoppingBatch,
    removeShoppingItems,
    settings,
  } = useStore()
  const [lowPick, setLowPick] = useState<LowCandidate[] | null>(null)
  const priceObs = usePriceObs()
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
    if (store) {
      recordPurchases(store, checked.map((it) => ({ name: it.name, category: it.category, unit: it.unit, quantity: it.quantity })))
      setStoreTick((t) => t + 1)
    }
    await clearCheckedShopping()
    toast(`${checked.length} article${checked.length > 1 ? 's' : ''} rangé${checked.length > 1 ? 's' : ''} dans le stock`)
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
        <div className="header-actions" />
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

      {shopping.some((it) => it.checked) && (
        <div className="btn-row" style={{ margin: '0 0 14px' }}>
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

      <div className="shopping-groups">
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
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        ))
      )}
      </div>

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
