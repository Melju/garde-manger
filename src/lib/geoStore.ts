import { getStores } from './stores'
import { normalize } from './productIcon'

export interface NearbyStore {
  /** Nom à enregistrer (celui de ta liste si reconnu, sinon le nom OpenStreetMap). */
  name: string
  /** Distance approximative en mètres. */
  distance: number
}

/** Erreur lisible pour l'utilisateur. */
export class GeoError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new GeoError(msg)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

function position(): Promise<GeolocationPosition> {
  const p = new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new GeoError('Géolocalisation indisponible sur cet appareil'))
    navigator.geolocation.getCurrentPosition(resolve, (e) => {
      if (e.code === 1) reject(new GeoError('Position refusée : autorise-la dans les réglages du navigateur'))
      else if (e.code === 3) reject(new GeoError('Position trop longue à obtenir, réessaie'))
      else reject(new GeoError('Position introuvable (GPS ou réseau indisponible)'))
    }, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 120000,
    })
  })
  // Garde-fou : si l'autorisation reste sans réponse, on ne reste pas bloqué.
  return withTimeout(p, 25000, "Pas de réponse de la position : accepte l'autorisation ou réessaie")
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

async function overpass(query: string): Promise<{ elements?: any[] }> {
  let lastErr: unknown = null
  for (const url of ENDPOINTS) {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 9000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        signal: ctl.signal,
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return (await res.json()) as { elements?: any[] }
    } catch (e) {
      lastErr = e
    } finally {
      clearTimeout(t)
    }
  }
  void lastErr
  throw new GeoError('Service de recherche des magasins injoignable, réessaie plus tard')
}

function meters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

/** Supermarchés proches (OpenStreetMap), du plus proche au plus loin. */
export async function detectNearbyStores(radius = 200): Promise<NearbyStore[]> {
  const pos = await position()
  const { latitude: lat, longitude: lon } = pos.coords
  const query = `[out:json][timeout:10];nwr(around:${radius},${lat},${lon})[shop~"^(supermarket|convenience|hypermarket|department_store|wholesale)$"];out tags center 20;`
  const json = await overpass(query)
  const known = getStores()
  const out: NearbyStore[] = []
  for (const el of json.elements ?? []) {
    const raw: string = el.tags?.brand || el.tags?.name || ''
    if (!raw) continue
    const c = el.center ?? { lat: el.lat, lon: el.lon }
    if (c?.lat == null) continue
    const n = normalize(raw)
    const match = known.find((s) => n.includes(normalize(s)) || normalize(s).includes(n))
    const name = match ?? raw
    out.push({ name, distance: meters(lat, lon, c.lat, c.lon) })
  }
  // Un même magasin peut sortir plusieurs fois : on garde le plus proche.
  const best = new Map<string, NearbyStore>()
  for (const s of out.sort((a, b) => a.distance - b.distance)) if (!best.has(s.name)) best.set(s.name, s)
  return [...best.values()]
}
