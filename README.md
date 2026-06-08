# Garde-Manger

Webapp de gestion de garde-manger (mobile-first) : inventaire, suivi des
péremptions / anti-gaspi, et liste de courses.

## Stack

- **React 19 + TypeScript + Vite**
- Données en **LocalStorage** via une couche d'abstraction (`Repository`)
  conçue pour être remplacée par un backend (Supabase) sans réécrire l'UI.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + build de production
```

## Architecture

```
src/
  types.ts                     Modèle de données (Product, ShoppingItem, Category)
  lib/expiry.ts                Calcul des statuts de péremption / priorité
  data/
    repository.ts              Interface Repository (contrat backend-agnostique)
    localStorageRepository.ts  Implémentation LocalStorage (+ seed au 1er lancement)
    seed.ts                    Jeu de données de démonstration
    store.tsx                  Contexte React + hook useStore (état + actions)
  components/                  Icon, Toast, ProductItem (swipe)
  screens/                     Inventory, ProductForm (ajout/édition), Shopping
  App.tsx                      Navigation par onglets + sous-écran formulaire
```

### Passer à Supabase plus tard

Créer une `SupabaseRepository implements Repository`, puis remplacer la seule
ligne d'instanciation dans `src/data/store.tsx`. Aucune autre modification de
l'UI n'est nécessaire (les méthodes du repository sont déjà asynchrones).

## Périmètre (v1)

- ✅ Inventaire : liste, recherche, filtres par catégorie
- ✅ Ajout / édition / suppression de produit
- ✅ Retrait rapide de quantité (glisser vers la gauche : −1, −2, −3, tout)
- ✅ Section « à consommer en priorité » (calcul automatique selon les dates)
- ✅ Liste de courses : ajout manuel, cases à cocher, génération depuis les stocks faibles

À venir : planning des repas, budget, recettes (IA), membres de la famille,
notifications, et synchronisation cloud.
