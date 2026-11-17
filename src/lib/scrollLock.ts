/**
 * Bloque le défilement de la page tant qu'une fenêtre (feuille, confirmation, tiroir, menu +) est ouverte.
 * Un seul observateur pour toute l'appli : pas besoin d'y penser dans chaque composant.
 *
 * On se contente de `overflow: hidden` (+ overscroll-behavior) : figer le body en `position: fixed`
 * faisait disparaître le contenu derrière la fenêtre sur des tablettes Android (fond gris uni
 * quand la page était défilée).
 */
const MODAL = '.cselect-overlay, .confirm-overlay, .drawer-overlay, .fab-backdrop'

export function installScrollLock() {
  if (typeof document === 'undefined') return
  let locked = false
  const html = document.documentElement
  const update = () => {
    const open = document.querySelector(MODAL) !== null
    if (open === locked) return
    locked = open
    html.classList.toggle('modal-open', open)
  }
  new MutationObserver(update).observe(document.body, { childList: true, subtree: true })
  update()
}
