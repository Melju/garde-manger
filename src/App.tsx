import { lazy, Suspense, useState } from 'react'
import { InventoryScreen } from './screens/InventoryScreen'
import { ShoppingScreen } from './screens/ShoppingScreen'
import { ProductFormScreen } from './screens/ProductFormScreen'
import { Icon } from './components/Icon'

// Chargé à la demande : la bibliothèque de scan (ZXing) est lourde et n'est
// nécessaire que lorsque l'utilisateur ouvre le scanner.
const ScanScreen = lazy(() =>
  import('./screens/ScanScreen').then((m) => ({ default: m.ScanScreen })),
)
import { useStore } from './data/store'
import type { Product, ProductInput } from './types'

type Tab = 'inventory' | 'shopping'

/** Sous-écran affiché par-dessus les onglets. */
type Overlay =
  | { kind: 'product-form'; product: Product | null; initial?: Partial<ProductInput> }
  | { kind: 'scan' }
  | null

export function App() {
  const { loading } = useStore()
  const [tab, setTab] = useState<Tab>('inventory')
  const [overlay, setOverlay] = useState<Overlay>(null)

  if (loading) {
    return <div className="app" />
  }

  // Un sous-écran masque les onglets et la barre de navigation.
  if (overlay?.kind === 'product-form') {
    return (
      <div className="app">
        <ProductFormScreen
          product={overlay.product}
          initial={overlay.initial}
          onClose={() => setOverlay(null)}
        />
      </div>
    )
  }

  if (overlay?.kind === 'scan') {
    return (
      <div className="app">
        <Suspense fallback={<div className="scan-screen" />}>
          <ScanScreen
            onResult={(initial) => setOverlay({ kind: 'product-form', product: null, initial })}
            onClose={() => setOverlay(null)}
          />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="app">
      {tab === 'inventory' && (
        <InventoryScreen
          onAdd={() => setOverlay({ kind: 'product-form', product: null })}
          onScan={() => setOverlay({ kind: 'scan' })}
          onEdit={(product) => setOverlay({ kind: 'product-form', product })}
          onOpenShopping={() => setTab('shopping')}
        />
      )}
      {tab === 'shopping' && <ShoppingScreen />}

      <nav className="bottom-nav">
        <button
          className={`nav-item${tab === 'inventory' ? ' active' : ''}`}
          onClick={() => setTab('inventory')}
        >
          <Icon name="box" width={tab === 'inventory' ? 2 : 1.5} />
          Stock
        </button>
        <button
          className={`nav-item${tab === 'shopping' ? ' active' : ''}`}
          onClick={() => setTab('shopping')}
        >
          <Icon name="cart" width={tab === 'shopping' ? 2 : 1.5} />
          Courses
        </button>
      </nav>
    </div>
  )
}
