import { lazy, Suspense, useState } from 'react'
import { InventoryScreen } from './screens/InventoryScreen'
import { ShoppingScreen } from './screens/ShoppingScreen'
import { ProductFormScreen } from './screens/ProductFormScreen'
import { RecipesScreen } from './screens/RecipesScreen'
import { RecipeDetailScreen } from './screens/RecipeDetailScreen'
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

/** Sous-pages empilées par-dessus l'onglet courant. */
type Route =
  | { name: 'product-form'; product: Product | null; initial?: Partial<ProductInput>; fromScan?: boolean }
  | { name: 'scan' }
  | { name: 'notifications' }
  | { name: 'stats' }
  | { name: 'budget' }
  | { name: 'waste' }
  | { name: 'recipe-detail'; recipe: Recipe }
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

  // On attend que l'auth soit résolue (évite d'afficher « local » un bref instant
  // avant la bascule en cloud) et que les données soient chargées.
  if (!auth.ready || loading) return <div className="app" />

  const push = (r: Route) => setStack((s) => [...s, r])
  const back = () => setStack((s) => s.slice(0, -1))
  const goTab = (t: Tab) => {
    setTab(t)
    setStack([])
  }
  /** Remplace la sous-page courante (ex : scan → formulaire). */
  const replace = (r: Route) => setStack((s) => [...s.slice(0, -1), r])

  const top = stack[stack.length - 1]

  if (top) {
    return <div className="app">{renderRoute(top)}</div>
  }

  return (
    <div className="app">
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
      {tab === 'shopping' && <ShoppingScreen />}
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

      <Fab onOpen={() => push({ name: 'add-menu' })} />

      <nav className="bottom-nav">
        <NavButton tab="inventory" current={tab} icon="box" label="Stock" onClick={goTab} />
        <NavButton tab="recipes" current={tab} icon="book" label="Recettes" onClick={goTab} />
        <NavButton tab="planning" current={tab} icon="calendar" label="Planning" onClick={goTab} />
        <NavButton tab="shopping" current={tab} icon="cart" label="Courses" onClick={goTab} />
        <NavButton tab="more" current={tab} icon="menu" label="Plus" onClick={goTab} />
      </nav>
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
            onTicket={() => toast('Scan de ticket — bientôt disponible')}
            onTicketEmail={() => toast('Ticket électronique — bientôt disponible')}
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
