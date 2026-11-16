import { useConfirm } from './components/Confirm'
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { InventoryScreen } from './screens/InventoryScreen'
import { ShoppingScreen } from './screens/ShoppingScreen'
import { ProductFormScreen } from './screens/ProductFormScreen'
import { RecipesScreen } from './screens/RecipesScreen'
import { RecipeDetailScreen } from './screens/RecipeDetailScreen'
import { RecipeFormScreen } from './screens/RecipeFormScreen'
import { NotificationsScreen } from './screens/NotificationsScreen'
import { PlanningScreen } from './screens/PlanningScreen'
import { StatsScreen } from './screens/StatsScreen'
import { ConsumptionScreen } from './screens/ConsumptionScreen'
import { BudgetScreen } from './screens/BudgetScreen'
import { WasteScreen } from './screens/WasteScreen'
import { FamilyScreen } from './screens/FamilyScreen'
import { MemberEditScreen } from './screens/MemberEditScreen'
import { MoreScreen } from './screens/MoreScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { AccountScreen } from './screens/AccountScreen'
import { AddMenuScreen } from './screens/AddMenuScreen'
import { TicketScanScreen } from './screens/TicketScanScreen'
import { BulkAddScreen } from './screens/BulkAddScreen'
import { Icon } from './components/Icon'
import { Fab } from './components/Fab'
import { useToast } from './components/Toast'
import { useStore } from './data/store'
import { useAuth } from './data/auth'
import { SharedRecipeScreen } from './screens/SharedRecipeScreen'
import { InstallPrompt } from './components/InstallPrompt'
import { lookupBarcode } from './lib/openfoodfacts'
import { recallProduct } from './lib/productMemory'
import { supabase } from './data/supabaseClient'
import { splitSize, consumeFraction, remainingLabel } from './lib/contenance'
import { UpdateBanner } from './components/UpdateBanner'
import { ScanConsumeSheet, type ConsumeChoice } from './components/ScanConsumeSheet'
import type { FamilyMember, Product, ProductInput, Recipe } from './types'

// Chargé à la demande : la bibliothèque de scan (ZXing) est lourde.
const ScanScreen = lazy(() =>
  import('./screens/ScanScreen').then((m) => ({ default: m.ScanScreen })),
)

type Tab = 'inventory' | 'recipes' | 'planning' | 'shopping' | 'more'

const NAV: { tab: Tab; icon: 'box' | 'book' | 'calendar' | 'cart' | 'menu'; label: string }[] = [
  { tab: 'inventory', icon: 'box', label: 'Stock' },
  { tab: 'recipes', icon: 'book', label: 'Recettes' },
  { tab: 'planning', icon: 'calendar', label: 'Planning' },
  { tab: 'shopping', icon: 'cart', label: 'Courses' },
  { tab: 'more', icon: 'menu', label: 'Plus' },
]

/** Sous-pages empilées par-dessus l'onglet courant. */
type Route =
  | { name: 'product-form'; product: Product | null; initial?: Partial<ProductInput>; fromScan?: boolean }
  | { name: 'scan' }
  | { name: 'scan-consume' }
  | { name: 'ticket-scan'; mode?: 'photo' | 'file' }
  | { name: 'bulk-add' }
  | { name: 'notifications' }
  | { name: 'stats' }
  | { name: 'consumption' }
  | { name: 'budget' }
  | { name: 'waste' }
  | { name: 'recipe-detail'; recipe: Recipe }
  | { name: 'recipe-form'; recipe?: Recipe }
  | { name: 'shared-recipe'; token: string }
  | { name: 'family' }
  | { name: 'member-edit'; member: FamilyMember | null }
  | { name: 'settings' }
  | { name: 'account' }
  | { name: 'add-menu' }

export function App() {
  const { loading, products, adjustQuantity, addProduct, updateProduct } = useStore()
  const [pendingConsume, setPendingConsume] = useState<Product | null>(null)
  const pendingRef = useRef(false)
  const askConfirm = useConfirm()
  const auth = useAuth()
  const toast = useToast()

  // Ajout par scan : un produit déjà en stock (même code-barres) demande juste « combien ? ».
  function findKnownByBarcode(barcode: string) {
    return products.find((x) => x.barcode && x.barcode === barcode) ?? null
  }
  async function addKnown(p: Product, n: number, expiries: string[]) {
    // Regroupe les articles par date : même date que le produit (ou vide) = +quantité, sinon nouveau lot.
    const groups = new Map<string, number>()
    for (const e of expiries) {
      const k = !e || e === p.expiryDate ? '' : e
      groups.set(k, (groups.get(k) ?? 0) + 1)
    }
    const same = groups.get('') ?? 0
    if (same > 0) await adjustQuantity(p.id, same)
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p
    const full = splitSize(p.size).full
    for (const [date, count] of groups) {
      if (!date) continue
      await addProduct({ ...rest, size: full ?? p.size, quantity: count, expiryDate: date })
    }
    toast(groups.size > 1 ? `${p.name} : +${n} (dates différentes)` : `${p.name} : +${n}`)
    logScanAdded(p.name, n)
  }
  // Produit scanné mais plus en stock : on reprend sa dernière fiche (sans péremption).
  function recallForScan(barcode: string) {
    return recallProduct(barcode)
  }

  // Retrait par scan : décrémente le produit correspondant au code-barres.
  async function consumeByBarcode(barcode: string) {
    if (pendingRef.current) return // une feuille de choix est déjà ouverte
    const p = products.find((x) => x.barcode && x.barcode === barcode)
    if (!p) {
      // Produit inconnu : on propose de l'ajouter (bascule vers le mode ajout).
      if (await askConfirm({ title: "Ce produit n'est pas dans ton stock", message: 'Veux-tu l\'ajouter ?', confirmLabel: 'Ajouter' })) {
        const res = await lookupBarcode(barcode)
        push({ name: 'product-form', product: null, initial: res.prefill })
      }
      return
    }
    // On ne retire plus directement : l'utilisateur choisit la quantité (le scan suivant attend).
    pendingRef.current = true
    setPendingConsume(p)
  }

  async function confirmConsume(c: ConsumeChoice) {
    const p = pendingConsume
    pendingRef.current = false
    setPendingConsume(null)
    if (!p) return
    if (c.kind === 'units') {
      const n = Math.min(c.n, p.quantity)
      await adjustQuantity(p.id, -n)
      const left = p.quantity - n
      toast(left > 0 ? `${p.name} : reste ×${left}` : `${p.name} retiré du stock`)
      setConsumeLog((log) => {
        const ex = log.find((e) => e.id === p.id)
        if (ex) return log.map((e) => (e.id === p.id ? { ...e, count: e.count + n } : e))
        return [{ id: p.id, name: p.name, count: n }, ...log]
      })
      return
    }
    // Une partie d'un paquet : la contenance de ce paquet diminue.
    const newSize = p.size ? consumeFraction(p.size, c.f) : null
    if (newSize === null) {
      await adjustQuantity(p.id, -1)
      toast(`${p.name} : paquet terminé`)
      return
    }
    if (p.quantity > 1) {
      // Un paquet entamé parmi plusieurs pleins : il devient un lot à part.
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = p as Product & { createdAt?: string; updatedAt?: string }
      await updateProduct(p.id, { quantity: p.quantity - 1 })
      await addProduct({ ...rest, quantity: 1, size: newSize })
    } else {
      await updateProduct(p.id, { size: newSize })
    }
    toast(`${p.name} : ${remainingLabel(newSize)} restant`)
  }

  // Annule un retrait scanné (remet +1 au stock).
  async function undoConsume(id: string) {
    await adjustQuantity(id, +1)
    setConsumeLog((log) =>
      log.flatMap((e) => (e.id === id ? (e.count > 1 ? [{ ...e, count: e.count - 1 }] : []) : [e])),
    )
    toast('Retrait annulé (+1)')
  }
  const [tab, setTab] = useState<Tab>('inventory')
  const [stack, setStack] = useState<Route[]>([])
  const [shopAddOpen, setShopAddOpen] = useState(false)
  // Produits ajoutés pendant une session de scan en série (pour « Terminé »).
  const [scanAdded, setScanAdded] = useState<{ name: string; count: number }[]>([])
  const logScanAdded = (name: string, n: number) =>
    setScanAdded((log) => {
      const ex = log.find((e) => e.name === name)
      return ex ? log.map((e) => (e.name === name ? { ...e, count: e.count + n } : e)) : [...log, { name, count: n }]
    })
  const [consumeLog, setConsumeLog] = useState<{ id: string; name: string; count: number }[]>([])

  // Défilement : les hooks doivent rester avant le return anticipé ci-dessous.
  const scrollSaved = useRef<number[]>([])
  const prevDepth = useRef(0)
  useLayoutEffect(() => {
    const d = stack.length
    if (d > prevDepth.current) window.scrollTo(0, 0)
    else if (d < prevDepth.current) window.scrollTo(0, scrollSaved.current[d] ?? 0)
    prevDepth.current = d
  }, [stack.length])

  // Lien de recette partagée (?r=jeton) : on mémorise le jeton, puis on ouvre l'aperçu une fois connecté.
  useEffect(() => {
    try {
      const u = new URL(window.location.href)
      const r = u.searchParams.get('r')
      if (r && /^[a-z0-9]{8,32}$/i.test(r)) {
        localStorage.setItem('miamm.pendingshare', r)
        u.searchParams.delete('r')
        window.history.replaceState({}, '', u.pathname + u.search + u.hash)
      }
    } catch {
      /* ignore */
    }
  }, [])
  useEffect(() => {
    if (!auth.ready || loading || !auth.householdId) return
    try {
      const t = localStorage.getItem('miamm.pendingshare')
      if (t) {
        localStorage.removeItem('miamm.pendingshare')
        setStack([{ name: 'shared-recipe', token: t }])
      }
    } catch {
      /* ignore */
    }
  }, [auth.ready, auth.householdId, loading])

  // Invitation à rejoindre un autre foyer (envoyée par un membre) : on propose de la rejoindre.
  useEffect(() => {
    if (!auth.ready || !auth.user || !supabase) return
    let stop = false
    const skipKey = 'miamm.inviteLater'
    void (async () => {
      const { data } = await supabase!.rpc('pending_household_invite')
      const inv = data as { household_id: string; household: string; inviter: string } | null
      if (stop || !inv?.household_id) return
      try {
        if (sessionStorage.getItem(skipKey) === inv.household_id) return
      } catch {
        /* ignore */
      }
      const ok = await askConfirm({
        title: `Rejoindre le garde-manger « ${inv.household} » ?`,
        message: `${inv.inviter || 'Un membre'} t'invite dans son foyer pour partager le même stock et les mêmes courses.${
          auth.householdId ? " Tu quitteras ton foyer actuel (ses données y restent, tu n'y auras plus accès)." : ''
        }`,
        confirmLabel: 'Rejoindre',
        cancelLabel: 'Plus tard',
      })
      if (ok) {
        const { error } = await supabase!.rpc('answer_household_invite', { p_household: inv.household_id, p_accept: true })
        if (error) toast(error.message)
        else {
          await auth.refreshHousehold()
          toast(`Bienvenue dans « ${inv.household} »`)
        }
      } else {
        try {
          sessionStorage.setItem(skipKey, inv.household_id)
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      stop = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.ready, auth.user?.id, auth.householdId])

  // On attend que l'auth soit résolue (évite d'afficher « local » un bref instant
  // avant la bascule en cloud) et que les données soient chargées.
  if (!auth.ready || loading)
    return (
      <div className="splash">
        <img className="splash-logo-img" src={`${import.meta.env.BASE_URL}logo.webp`} alt="Miam miam" />
        <div className="splash-spin" />
      </div>
    )

  // Défilement : une sous-page s'ouvre toujours tout en haut, et la page d'origine retrouve sa position au retour.
  const push = (r: Route) => {
    scrollSaved.current[stack.length] = window.scrollY
    setStack((s) => [...s, r])
  }
  const back = () => setStack((s) => s.slice(0, -1))
  const goTab = (t: Tab) => {
    scrollSaved.current = []
    setTab(t)
    setStack([])
  }
  /** Remplace la sous-page courante (ex : scan → formulaire). */
  const replace = (r: Route) => {
    window.scrollTo(0, 0)
    setStack((s) => [...s.slice(0, -1), r])
  }

  const top = stack[stack.length - 1]

  // Action d'ajout contextuelle par page (barre du bas en mobile, bouton sidebar en bureau).
  const addAction: Partial<Record<Tab, { label: string; run: () => void }>> = {
    inventory: { label: 'Ajouter un produit', run: () => push({ name: 'add-menu' }) },
    recipes: { label: 'Nouvelle recette', run: () => push({ name: 'recipe-form' }) },
    shopping: { label: 'Ajouter un article', run: () => setShopAddOpen(true) },
  }
  const add = addAction[tab]

  return (
    <div className="shell">
      {/* Barre latérale (bureau uniquement, masquée en mobile via CSS) */}
      <aside className="sidebar">
        <div className="sidebar-logo"><img src={`${import.meta.env.BASE_URL}logo.webp`} alt="Miam miam" /></div>
        <nav className="sidebar-nav">
          {NAV.map((n) => (
            <button
              key={n.tab}
              className={`sidebar-item${!top && tab === n.tab ? ' active' : ''}`}
              onClick={() => goTab(n.tab)}
            >
              <Icon name={n.icon} />
              {n.label}
            </button>
          ))}
        </nav>
        {add && (
          <button className="sidebar-add" onClick={add.run}>
            <Icon name="plus" />
            {add.label}
          </button>
        )}
      </aside>

      <UpdateBanner />
      <main className={`app${!top && add ? ' with-fab' : ''} wide`}>
        {!top && <InstallPrompt />}
        {/* Cloud configuré mais aucune session : l'app tourne sur le stockage local de cet appareil. */}
        {!top && auth.cloudEnabled && !auth.householdId && (
          <div className="local-banner" role="alert">
            <div>
              <strong>Non connecté</strong>
              <span>Tu vois uniquement les données de cet appareil, pas celles de ton foyer.</span>
            </div>
            <button onClick={() => push({ name: 'account' })}>Se connecter</button>
          </div>
        )}
        {top && renderRoute(top)}
        {/* La page d'onglet reste montée (masquée) sous une sous-page : on garde sa recherche,
            ses filtres, la pagination déjà chargée et donc la position de défilement au retour. */}
        {(
          <div className="tab-host" hidden={Boolean(top)}>
            {tab === 'inventory' && (
              <InventoryScreen
                onEdit={(product) => push({ name: 'product-form', product })}
                onOpenStats={() => push({ name: 'stats' })}
                onOpenNotifications={() => push({ name: 'notifications' })}
                onOpenBudget={() => push({ name: 'budget' })}
                onScanConsume={() => {
                  setConsumeLog([])
                  push({ name: 'scan-consume' })
                }}
              />
            )}
            {tab === 'recipes' && (
              <RecipesScreen
                onOpenRecipe={(recipe) => push({ name: 'recipe-detail', recipe })}
                onOpenFamily={() => push({ name: 'family' })}
              />
            )}
            {tab === 'planning' && <PlanningScreen />}
            {tab === 'shopping' && (
              <ShoppingScreen addOpen={shopAddOpen} onCloseAdd={() => setShopAddOpen(false)} />
            )}
            {tab === 'more' && (
              <MoreScreen
                onFamily={() => push({ name: 'family' })}
                onStats={() => push({ name: 'stats' })}
                onNotifications={() => push({ name: 'notifications' })}
                onWaste={() => push({ name: 'waste' })}
                onBudget={() => push({ name: 'budget' })}
                onSettings={() => push({ name: 'settings' })}
                onAccount={() => push({ name: 'account' })}
              />
            )}
          </div>
        )}
      </main>

      {/* Action contextuelle mobile (barre du bas), selon la page. */}
      {!top && add && <Fab label={add.label} onOpen={add.run} />}

      {!top && (
        <nav className="bottom-nav">
          {NAV.map((n) => (
            <NavButton key={n.tab} tab={n.tab} current={tab} icon={n.icon} label={n.label} onClick={goTab} />
          ))}
        </nav>
      )}
    </div>
  )

  function renderRoute(route: Route) {
    switch (route.name) {
      case 'product-form':
        return (
          <ProductFormScreen
            product={route.product}
            initial={route.initial}
            onClose={back}
            // Produit issu d'un scan : après enregistrement, on revient au scanner
            // pour enchaîner les codes-barres.
            onSaved={route.fromScan ? (saved) => { logScanAdded(saved.name, saved.quantity); replace({ name: 'scan' }) } : back}
          />
        )
      case 'scan':
        return (
          <Suspense fallback={<div className="scan-screen" />}>
            <ScanScreen
              added={scanAdded}
              findKnown={findKnownByBarcode}
              findMemory={recallForScan}
              onAddKnown={addKnown}
              onResult={(initial) => replace({ name: 'product-form', product: null, initial, fromScan: true })}
              onClose={() => {
                setScanAdded([])
                back()
              }}
            />
          </Suspense>
        )
      case 'scan-consume':
        return (
          <Suspense fallback={<div className="scan-screen" />}>
            <>
              <ScanScreen mode="consume" onConsume={consumeByBarcode} onClose={back} removed={consumeLog} onUndo={undoConsume} />
              {pendingConsume && (
                <ScanConsumeSheet
                  product={pendingConsume}
                  onConfirm={confirmConsume}
                  onCancel={() => {
                    pendingRef.current = false
                    setPendingConsume(null)
                  }}
                />
              )}
            </>
          </Suspense>
        )
      case 'ticket-scan':
        return <TicketScanScreen key={route.mode ?? 'photo'} mode={route.mode} onClose={back} onAdded={() => goTab('inventory')} />
      case 'bulk-add':
        return <BulkAddScreen onClose={back} onAdded={() => goTab('inventory')} />
      case 'notifications':
        return <NotificationsScreen onBack={back} />
      case 'stats':
        return <StatsScreen onBack={back} onOpenWaste={() => push({ name: 'waste' })} onOpenConsumption={() => push({ name: 'consumption' })} />
      case 'budget':
        return <BudgetScreen onBack={back} />
      case 'consumption':
        return <ConsumptionScreen onBack={back} />
      case 'waste':
        return <WasteScreen onBack={back} />
      case 'recipe-detail':
        return (
          <RecipeDetailScreen
            recipe={route.recipe}
            onBack={back}
            onGoShopping={() => goTab('shopping')}
            onEdit={(recipe) => push({ name: 'recipe-form', recipe })}
          />
        )
      case 'shared-recipe':
        return (
          <SharedRecipeScreen
            token={route.token}
            onBack={back}
            onAdded={(recipe) => setStack([{ name: 'recipe-detail', recipe }])}
          />
        )
      case 'recipe-form':
        return (
          <RecipeFormScreen
            recipe={route.recipe}
            onClose={back}
            onSaved={(recipe) => setStack([{ name: 'recipe-detail', recipe }])}
          />
        )
      case 'family':
        return (
          <FamilyScreen onBack={back} onEditMember={(member) => push({ name: 'member-edit', member })} />
        )
      case 'member-edit':
        return <MemberEditScreen member={route.member} onBack={back} />
      case 'settings':
        return <SettingsScreen onBack={back} />
      case 'account':
        return <AccountScreen onBack={back} />
      case 'add-menu':
        return (
          <AddMenuScreen
            onBack={back}
            onBarcode={() => { setScanAdded([]); replace({ name: 'scan' }) }}
            onManual={() => replace({ name: 'product-form', product: null })}
            onBulk={() => replace({ name: 'bulk-add' })}
            onTicket={() => replace({ name: 'ticket-scan' })}
            onTicketEmail={() => replace({ name: 'ticket-scan', mode: 'file' })}
          />
        )
    }
  }
}

function NavButton({
  tab,
  current,
  icon,
  label,
  onClick,
}: {
  tab: Tab
  current: Tab
  icon: 'box' | 'book' | 'calendar' | 'cart' | 'menu'
  label: string
  onClick: (t: Tab) => void
}) {
  const active = tab === current
  return (
    <button className={`nav-item${active ? ' active' : ''}`} onClick={() => onClick(tab)}>
      <Icon name={icon} width={active ? 2 : 1.5} />
      {label}
    </button>
  )
}
