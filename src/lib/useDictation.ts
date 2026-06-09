import { useRef, useState } from 'react'

/**
 * Dictée vocale via l'API Web Speech (Chrome/Android/desktop). Sur iOS où elle
 * n'est pas dispo, `supported` est false → l'app retombe sur le micro du clavier.
 */
export function useDictation(onText: (full: string) => void) {
  const SR =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined
  const supported = !!SR
  const recRef = useRef<any>(null)
  const baseRef = useRef('')
  const [listening, setListening] = useState(false)

  function start(currentText: string) {
    if (!SR) return false
    const rec = new SR()
    rec.lang = 'fr-FR'
    rec.interimResults = true
    rec.continuous = true
    baseRef.current = currentText
    rec.onresult = (e: any) => {
      let txt = ''
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript
      const base = baseRef.current
      const sep = base && !base.endsWith('\n') ? '\n' : ''
      onText(base + sep + txt)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
      return true
    } catch {
      setListening(false)
      return false
    }
  }

  function stop() {
    recRef.current?.stop()
    setListening(false)
  }

  return { supported, listening, start, stop }
}
