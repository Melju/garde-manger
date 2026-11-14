import { getStores } from './stores'
import { normalize } from './productIcon'

export interface NearbyStore {
  /** Nom à enregistrer (celui de ta liste si reconnu, sinon le nom OpenStreetMap). */
  name: string
  /** Distance approximative en mètres. */
  distance: number
}

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation indisponible'))
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000,
    })
  })
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
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  })
  if (!res.ok) throw new Error('Service de localisation indisponible')
  const json = (await res.json()) as { elements?: any[] }
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
