import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'

// Extrae el token del contenido del QR (acepta URL /plano/{token} o token suelto).
function extraerToken(text) {
  if (!text) return null
  const t = text.trim()
  const m = t.match(/\/plano\/([A-Za-z0-9]+)/)
  if (m) return m[1]
  // token suelto (alfa-numérico)
  if (/^[A-Za-z0-9]{8,}$/.test(t)) return t
  return null
}

export default function Escanear() {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const scannerRef = useRef(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  const startedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const id = 'qr-reader'

    async function start() {
      try {
        const scanner = new Html5Qrcode(id, { verbose: false })
        scannerRef.current = scanner
        const config = { fps: 10, qrbox: { width: 240, height: 240 } }

        const onScan = (decoded) => {
          const token = extraerToken(decoded)
          if (token) {
            detener().then(() => navigate(`/plano/${token}`))
          }
        }

        await scanner.start({ facingMode: 'environment' }, config, onScan, () => {})
        startedRef.current = true
        if (cancelled) detener()
      } catch (e) {
        setError(
          'No se pudo acceder a la cámara. Revisá los permisos del navegador o usá el ingreso manual.'
        )
      }
    }

    async function detener() {
      const s = scannerRef.current
      if (s && startedRef.current) {
        try {
          await s.stop()
          await s.clear()
        } catch {
          /* noop */
        }
        startedRef.current = false
      }
    }

    start()
    return () => {
      cancelled = true
      detener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const irManual = (e) => {
    e.preventDefault()
    const token = extraerToken(manual)
    if (token) navigate(`/plano/${token}`)
    else setError('Código inválido')
  }

  return (
    <div>
      <h2 className="mb">Escanear QR</h2>
      <p className="muted small mb">Apuntá la cámara al QR pegado en el plano.</p>

      <div
        id="qr-reader"
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: 420,
          margin: '0 auto',
          borderRadius: 'var(--radio)',
          overflow: 'hidden',
          background: '#000',
        }}
      />

      {error && (
        <div className="card mt" style={{ background: 'var(--rojo-claro)' }}>
          <div className="small danger-text">{error}</div>
        </div>
      )}

      <form className="card mt-lg" onSubmit={irManual}>
        <label className="label">¿No anda la cámara? Ingresá el código del plano</label>
        <div className="row gap">
          <input
            className="input grow"
            placeholder="Código o link del QR"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button className="btn btn-primary">Ir</button>
        </div>
      </form>
    </div>
  )
}
