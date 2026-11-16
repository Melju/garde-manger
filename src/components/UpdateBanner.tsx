import { useEffect, useState } from 'react'

/** Vérifie si une version plus récente a été déployée (version.json). */
async function newerAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return false
    const v = (await r.json()) as { build?: string }
    return Boolean(v.build) && v.build !== __BUILD_ID__
  } catch {
    return false
  }
}

/**
 * Une appli installée peut rester des jours sur une vieille version.
 * - Au retour au premier plan : si une nouvelle version existe, on recharge tout de suite.
 * - Pendant l'utilisation (contrôle toutes les 10 min) : bandeau « Mettre à jour », pour ne pas couper une saisie.
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    let hiddenSince = 0
    const check = async (resume: boolean) => {
      if (!(await newerAvailable())) return
      if (resume) window.location.reload()
      else setReady(true)
    }
    const onVis = () => {
      if (document.hidden) hiddenSince = Date.now()
      // Revenu après au moins 30 s en arrière-plan : on peut recharger sans gêner.
      else void check(hiddenSince > 0 && Date.now() - hiddenSince > 30_000)
    }
    document.addEventListener('visibilitychange', onVis)
    const timer = window.setInterval(() => void check(false), 10 * 60_000)
    void check(false)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(timer)
    }
  }, [])

  if (!ready) return null
  return (
    <button className="update-banner" onClick={() => window.location.reload()}>
      Nouvelle version disponible · <strong>Mettre à jour</strong>
    </button>
  )
}
