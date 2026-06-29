import { useState } from 'react'
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Logo from '../components/Logo'

export default function Login() {
  const { signIn, user, esActivo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      </form>

      <p className="center muted small mt">
        ¿No tenés cuenta? <Link to="/registro">Registrate</Link>
      </p>
    </div>
  )
}
