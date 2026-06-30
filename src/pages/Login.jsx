import { useState } from 'react'
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Modal } from '../components/ui'
import Logo from '../components/Logo'

export default function Login() {
  const { signIn, user, esActivo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  // Si ya hay sesión activa, ir a destino
  if (user && esActivo) {
    const dest = location.state?.from?.pathname || '/'
    return <Navigate to={dest} />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!usuario.trim()) return setError('Ingresá tu usuario')
    if (!/^\d{6}$/.test(pin)) return setError('El PIN debe tener 6 dígitos')
    setLoading(true)
    try {
      await signIn(usuario, pin)
      const dest = location.state?.from?.pathname || '/'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(
        err?.message?.includes('Invalid')
          ? 'Usuario o PIN incorrectos'
          : err.message || 'No se pudo iniciar sesión'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content" style={{ maxWidth: 420, margin: '0 auto', paddingTop: '8vh' }}>
      <div className="center mb-lg">
        <Logo size={84} />
        <h1 style={{ marginTop: '1rem', marginBottom: 0 }}>Producción Iturrospe</h1>
        <p className="muted">Trazabilidad de planta</p>
      </div>

      <form className="card" onSubmit={onSubmit}>
        <div className="field">
          <label className="label">Usuario</label>
          <input
            className="input"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="ej. jperez"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">PIN (6 dígitos)</label>
          <input
            className="input"
            inputMode="numeric"
            pattern="\d*"
            maxLength={6}
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ letterSpacing: '0.4em', fontSize: '1.4rem', textAlign: 'center' }}
          />
        </div>

        {error && <div className="danger-text small mb">{error}</div>}

        <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-block btn-sm mt"
          onClick={() => setResetOpen(true)}
        >
          ¿Olvidaste tu PIN?
        </button>
      </form>

      <p className="center muted small mt">
        ¿No tenés cuenta? <Link to="/registro">Registrate</Link>
      </p>

      {resetOpen && (
        <ResetPinModal usuarioInicial={usuario} onClose={() => setResetOpen(false)} />
      )}
    </div>
  )
}

// Olvido de PIN: deja una solicitud para que el jefe asigne un PIN nuevo.
function ResetPinModal({ usuarioInicial, onClose }) {
  const { solicitarResetPin } = useAuth()
  const [usuario, setUsuario] = useState(usuarioInicial || '')
  const [estado, setEstado] = useState('') // '' | 'enviando' | 'ok' | error
  const [msg, setMsg] = useState('')

  const enviar = async () => {
    if (!/^[a-z0-9._-]{3,}$/.test(usuario.trim().toLowerCase())) {
      setEstado('error')
      setMsg('Ingresá tu usuario')
      return
    }
    setEstado('enviando')
    setMsg('')
    try {
      await solicitarResetPin(usuario)
      setEstado('ok')
    } catch (e) {
      setEstado('error')
      setMsg(e.message || 'No se pudo enviar la solicitud')
    }
  }

  return (
    <Modal title="¿Olvidaste tu PIN?" onClose={onClose}>
      {estado === 'ok' ? (
        <>
          <p className="mb">
            ✅ Listo. Avisale al <span className="bold">jefe de planta</span>: él te va a
            asignar un PIN nuevo desde su cuenta.
          </p>
          <button className="btn btn-primary btn-block" onClick={onClose}>Entendido</button>
        </>
      ) : (
        <>
          <p className="muted small mb">
            Ingresá tu usuario y enviá la solicitud. El jefe te asignará un PIN nuevo
            (no se usa email).
          </p>
          <div className="field">
            <label className="label">Usuario</label>
            <input
              className="input"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="ej. jperez"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </div>
          {estado === 'error' && <div className="danger-text small mb">{msg}</div>}
          <button
            className="btn btn-primary btn-block btn-lg"
            disabled={estado === 'enviando'}
            onClick={enviar}
          >
            {estado === 'enviando' ? 'Enviando…' : 'Solicitar PIN nuevo'}
          </button>
        </>
      )}
    </Modal>
  )
}
