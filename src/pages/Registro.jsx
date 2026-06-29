import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Logo from '../components/Logo'

export default function Registro() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nombre: '', usuario: '', pin: '', pin2: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setPin = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, '').slice(0, 6) }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.nombre.trim()) return setError('Ingresá tu nombre')
    if (!/^[a-z0-9._-]{3,}$/i.test(form.usuario.trim()))
      return setError('Usuario inválido (mín. 3 caracteres, sin espacios)')
    if (!/^\d{6}$/.test(form.pin)) return setError('El PIN debe tener 6 dígitos')
    if (form.pin !== form.pin2) return setError('Los PIN no coinciden')

    setLoading(true)
    try {
      await signUp(form.usuario, form.nombre, form.pin)
      navigate('/pendiente', { replace: true })
    } catch (err) {
      setError(
        err?.message?.includes('already registered') || err?.message?.includes('exists')
          ? 'Ese usuario ya existe'
          : err.message || 'No se pudo registrar'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content" style={{ maxWidth: 420, margin: '0 auto', paddingTop: '5vh' }}>
      <div className="center mb-lg">
        <Logo size={64} />
        <h1 style={{ marginTop: '0.75rem' }}>Crear cuenta</h1>
        <p className="muted small">
          Tu cuenta quedará <b>pendiente</b> hasta que el jefe de planta la apruebe.
        </p>
      </div>

      <form className="card" onSubmit={onSubmit}>
        <div className="field">
          <label className="label">Nombre completo</label>
          <input className="input" value={form.nombre} onChange={set('nombre')} placeholder="Juan Pérez" />
        </div>
        <div className="field">
          <label className="label">Usuario</label>
          <input
            className="input"
            autoCapitalize="none"
            autoCorrect="off"
            value={form.usuario}
            onChange={set('usuario')}
            placeholder="jperez"
          />
        </div>
        <div className="field">
          <label className="label">PIN (6 dígitos)</label>
          <input
            className="input"
            inputMode="numeric"
            maxLength={6}
            value={form.pin}
            onChange={setPin('pin')}
            placeholder="••••••"
            style={{ letterSpacing: '0.4em', textAlign: 'center' }}
          />
        </div>
        <div className="field">
          <label className="label">Repetir PIN</label>
          <input
            className="input"
            inputMode="numeric"
            maxLength={6}
            value={form.pin2}
            onChange={setPin('pin2')}
            placeholder="••••••"
            style={{ letterSpacing: '0.4em', textAlign: 'center' }}
          />
        </div>

        {error && <div className="danger-text small mb">{error}</div>}

        <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
          {loading ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="center muted small mt">
        ¿Ya tenés cuenta? <Link to="/login">Ingresá</Link>
      </p>
    </div>
  )
}
