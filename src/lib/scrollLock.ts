/**
 * Bloque le défilement de la page tant qu'une fenêtre (feuille, confirmation, tiroir, menu +) est ouverte.
 * Un seul observateur pour toute l'appli : pas besoin d'y penser dans chaque composant.
 */
const MODAL = '.cselect-overlay, .confirm-overlay, .drawer-overlay, .fab-backdrop'

export function installScrollLock() {
  if (typeof document === 'undefined') return
  let locked = false
  let savedY = 0
  const html = document.documentElement
  const update = () => {
    const open = document.querySelector(MODAL) !== null
    if (open === locked) return
    locked = open
    if (open) {
      // Fige la page à sa position (fiable aussi sur iOS et les vieux Android).
      savedY = window.scrollY
      html.classList.add('modal-open')
      document.body.style.top = `-${savedY}px`
    } else {
      html.classList.remove('modal-open')
      document.body.style.top = ''
      window.scrollTo(0, savedY)
    }
  }
  new MutationObserver(update).observe(document.body, { childList: true, subtree: true })
  update()
}
