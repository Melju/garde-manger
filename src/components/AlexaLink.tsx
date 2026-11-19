import { useEffect, useState } from 'react'
import { supabase } from '../data/supabaseClient'
import { useToast } from './Toast'

/**
 * Association de la skill Alexa « Miam miam » : on dit « Alexa, demande à Miam miam de m'associer »,
 * Alexa donne un code à 6 chiffres, qu'on saisit ici. Ensuite l'Echo agit sur le foyer, au nom de ce membre.
 */
export function AlexaLink() {
  const toast = useToast()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [links, setLinks] = useState<{ alexa_user: string; created_at: string }[]>([])

  const load = async () => {
    if (!supabase) return
    const { data } = await supabase.from('alexa_links').select('alexa_user,created_at').order('created_at')
    setLinks((data as any[]) ?? [])
  }
  useEffect(() => {
    void load()
  }, [])

  if (!supabase) return <div className="setting-desc">Connecte-toi pour associer Alexa.</div>

  async function link() {
    const c = code.replace(/\D/g, '')
    if (c.length !== 6 || busy) return
    setBusy(true)
    const { data, error } = await supabase!.rpc('alexa_link', { p_code: c })
    setBusy(false)
    if (error) return toast(error.message)
    if (!data) return toast('Code inconnu ou expiré : redemande-le à Alexa')
    setCode('')
    toast('Alexa est associée à ton foyer')
    void load()
  }

  async function unlink(id: string) {
    await supabase!.from('alexa_links').delete().eq('alexa_user', id)
    void load()
    toast('Alexa dissociée')
  }

  return (
    <div className="alexa-link">
      <p className="setting-desc">
        Dis « Alexa, demande à Miam miam de m’associer », puis saisis le code à 6 chiffres qu’elle te donne.
      </p>
      <div className="alexa-row">
        <input
          className="form-input"
          inputMode="numeric"
          placeholder="Code à 6 chiffres"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void link()}
        />
        <button className="btn-primary" disabled={code.replace(/\D/g, '').length !== 6 || busy} onClick={() => void link()}>
          {busy ? '…' : 'Associer'}
        </button>
      </div>
      {links.map((l, i) => (
        <div className="alexa-linked" key={l.alexa_user}>
          <span>
            Echo associé{links.length > 1 ? ` n°${i + 1}` : ''} · depuis le {new Date(l.created_at).toLocaleDateString('fr-FR')}
          </span>
          <button type="button" className="btn-secondary" onClick={() => void unlink(l.alexa_user)}>
            Dissocier
          </button>
        </div>
      ))}
    </div>
  )
}
