import { createContext, useContext, useEffect, useState } from 'react'
import { phase3Preview } from '../config/phase3Preview'

const PwaContext = createContext(null)
function standalone() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone,
  )
}
export function Phase3PwaProvider({ children }) {
  const [installed, setInstalled] = useState(standalone)
  const [prompt, setPrompt] = useState(null)
  const [message, setMessage] = useState('')
  const [worker, setWorker] = useState('preparing')
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (!phase3Preview.allowed) return
    let active = true
    const nodes = [
      Object.assign(document.createElement('link'), {
        rel: 'manifest',
        href: '/manifest.webmanifest',
      }),
      Object.assign(document.createElement('link'), {
        rel: 'apple-touch-icon',
        href: '/icons/endo-preview-180.png',
      }),
      Object.assign(document.createElement('meta'), {
        name: 'theme-color',
        content: '#1c75bc',
      }),
      Object.assign(document.createElement('meta'), {
        name: 'apple-mobile-web-app-title',
        content: 'Endo + Prévia',
      }),
    ]
    document.head.append(...nodes)
    function beforeInstall(event) {
      if (typeof event.prompt !== 'function') return
      event.preventDefault()
      setPrompt(event)
    }
    function installedEvent() {
      setInstalled(true)
      setPrompt(null)
      setMessage('Prévia instalada neste aparelho.')
    }
    const display = window.matchMedia?.('(display-mode: standalone)')
    function displayChanged() {
      setInstalled(standalone())
    }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', installedEvent)
    display?.addEventListener('change', displayChanged)
    if (window.isSecureContext && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/phase3-sw.js', { scope: '/', updateViaCache: 'none' })
        .then(() => {
          if (active) setWorker('ready')
        })
        .catch(() => {
          if (active) setWorker('unavailable')
        })
    } else setWorker('unavailable')
    return () => {
      active = false
      nodes.forEach((node) => node.remove())
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', installedEvent)
      display?.removeEventListener('change', displayChanged)
    }
  }, [])
  async function install() {
    if (!prompt || pending) return
    setPending(true)
    setMessage('')
    const event = prompt
    setPrompt(null)
    try {
      await event.prompt()
      const choice = await event.userChoice
      setMessage(
        choice?.outcome === 'accepted'
          ? 'Solicitação aceita. Aguarde a conclusão pelo navegador.'
          : 'Instalação não concluída. Você pode tentar pelo menu do navegador.',
      )
    } catch {
      setMessage(
        'Não foi possível abrir a instalação. Siga as orientações abaixo.',
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <PwaContext.Provider
      value={{
        installed,
        canInstall: Boolean(prompt),
        install,
        message,
        pending,
        worker,
      }}
    >
      {children}
    </PwaContext.Provider>
  )
}
export function usePhase3Pwa() {
  return useContext(PwaContext)
}
