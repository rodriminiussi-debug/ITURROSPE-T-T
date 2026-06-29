import { useEffect, useState } from 'react'

// Botón/aviso "Instalar app" (Android/desktop via beforeinstallprompt).
// En iOS muestra instrucciones de "Agregar a pantalla de inicio".
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [visible, setVisible] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    if (standalone) return

    const dismissed = localStorage.getItem('install-dismissed')

    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
      if (!dismissed) setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS no soporta beforeinstallprompt
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    if (isIos && !dismissed) {
      setIosHint(true)
      setVisible(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const instalar = async () => {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setVisible(false)
  }

  const cerrar = () => {
    setVisible(false)
    localStorage.setItem('install-dismissed', '1')
  }

  if (!visible) return null

  return (
    <div className="install-banner">
      <div style={{ fontSize: '1.6rem' }}>📲</div>
      <div className="grow">
        <div className="bold">Instalá Producción Iturrospe</div>
        <div className="xs" style={{ opacity: 0.85 }}>
          {iosHint
            ? 'Tocá Compartir y luego "Agregar a pantalla de inicio".'
            : 'Agregala a tu pantalla de inicio para abrirla como app.'}
        </div>
      </div>
      {!iosHint && (
        <button className="btn btn-primary btn-sm" onClick={instalar}>
          Instalar
        </button>
      )}
      <button className="btn btn-ghost btn-sm" style={{ color: '#fff' }} onClick={cerrar}>
        ✕
      </button>
    </div>
  )
}
