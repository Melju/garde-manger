import { lazy, Suspense, useState } from 'react'
import { InventoryScreen } from './screens/InventoryScreen'
import { ShoppingScreen } from './screens/ShoppingScreen'
import { ProductFormScreen } from './screens/ProductFormScreen'
import { RecipesScreen } from './screens/RecipesScreen'
import { RecipeDetailScreen } from './screens/RecipeDetailScreen'
import { RecipeFormScreen } from './screens/RecipeFormScreen'
import { NotificationsScreen } from './screens/NotificationsScreen'
import { PlanningScreen } from './screens/PlanningScreen'
import { StatsScreen } from './screens/StatsScreen'
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
  | { name: 'ticket-scan' }
  | { name: 'bulk-add' }
  | { name: 'notifications' }
  | { name: 'stats' }
  | { name: 'budget' }
  | { name: 'waste' }
  | { name: 'recipe-detail'; recipe: Recipe }
  | { name: 'recipe-form' }
  | { name: 'family' }
  | { name: 'member-edit'; member: FamilyMember | null }
  | { name: 'settings' }
  | { name: 'account' }
  | { name: 'add-menu' }

export function App() {
  const { loading } = useStore()
  const auth = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('inventory')
  const [stack, setStack] = useState<Route[]>([])
  const [shopAddOpen, setShopAddOpen] = useState(false)

  // On attend que l'auth soit résolue (évite d'afficher « local » un bref instant
  // avant la bascule en cloud) et que les données soient chargées.
  if (!auth.ready || loading)
    return (
      <div className="splash">
        <div className="splash-logo">Miamm</div>
        <div className="splash-spin" />
      </div>
    )

  const push = (r: Route) => setStack((s) => [...s, r])
  const back = () => setStack((s) => s.slice(0, -1))
  const goTab = (t: Tab) => {
    setTab(t)
    setStack([])
  }
  /** Remplace la sous-page courante (ex : scan → formulaire). */
  const replace = (r: Route) => setStack((s) => [...s.slice(0, -1), r])

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
        <div className="sidebar-logo">Miamm</div>
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

      <main className={`app${!top && add ? ' with-fab' : ''}`}>
        {top ? (
          renderRoute(top)
        ) : (
          <>
            {tab === 'inventory' && (
              <InventoryScreen
                onEdit={(product) => push({ name: 'product-form', product })}
                onOpenStats={() => push({ name: 'stats' })}
                onOpenNotifications={() => push({ name: 'notifications' })}
                onOpenBudget={() => push({ name: 'budget' })}
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
          </>
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
            onSaved={route.fromScan ? () => replace({ name: 'scan' }) : back}
          />
        )
      case 'scan':
        return (
          <Suspense fallback={<div className="scan-screen" />}>
            <ScanScreen
              onResult={(initial) => replace({ name: 'product-form', product: null, initial, fromScan: true })}
              onClose={back}
            />
          </Suspense>
        )
      case 'ticket-scan':
        return <TicketScanScreen onClose={back} onAdded={() => goTab('inventory')} />
      case 'bulk-add':
        return <BulkAddScreen onClose={back} onAdded={() => goTab('inventory')} />
      case 'notifications':
        return <NotificationsScreen onBack={back} />
      case 'stats':
        return <StatsScreen onBack={back} onOpenWaste={() => push({ name: 'waste' })} />
      case 'budget':
        return <BudgetScreen onBack={back} />
      case 'waste':
        return <WasteScreen onBack={back} />
      case 'recipe-detail':
        return (
          <RecipeDetailScreen
            recipe={route.recipe}
            onBack={back}
            onGoShopping={() => goTab('shopping')}
          />
        )
      case 'recipe-form':
        return (
          <RecipeFormScreen
            onClose={back}
            onSaved={(recipe) => replace({ name: 'recipe-detail', recipe })}
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
            onBarcode={() => replace({ name: 'scan' })}
            onManual={() => replace({ name: 'product-form', product: null })}
            onBulk={() => replace({ name: 'bulk-add' })}
            onTicket={() => replace({ name: 'ticket-scan' })}
            onTicketEmail={() => toast('Ticket par email — bientôt disponible')}
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
