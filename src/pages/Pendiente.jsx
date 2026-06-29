import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Logo from '../components/Logo'

export default function Pendiente() {
  const { user, profile, esActivo, signOut, refreshProfile, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (esActivo) return <Navigate to="/" replace />

  const inactivo = profile?.estado === 'inactivo'

  const salir = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="content" style={{ maxWidth: 420, margin: '0 auto', paddingTop: '12vh' }}>
      <div className="center">
        <Logo size={72} />
        <h1 style={{ marginTop: '1rem' }}>{inactivo ? 'Cuenta inactiva' : 'Cuenta pendiente'}</h1>
        <div style={{ fontSize: '3rem', margin: '1rem 0' }}>{inactivo ? '🚫' : '⏳'}</div>
        <p className="muted">
          {inactivo ? (
            <>Tu cuenta fue desactivada. Contactá al jefe de planta.</>
          ) : (
            <>
              Hola <b>{profile?.nombre}</b>. Tu cuenta está esperando la aprobación del
              jefe de planta. Una vez aprobada y con un rol asignado, vas a poder operar.
            </>
          )}
        </p>

        <div className="col gap mt-lg">
          <button className="btn btn-primary btn-block" onClick={refreshProfile}>
            🔄 Ya me aprobaron — Reintentar
          </button>
          <button className="btn btn-ghost btn-block" onClick={salir}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
