import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ROLES } from '../lib/helpers'
import Logo from './Logo'
import InstallPrompt from './InstallPrompt'

export default function Layout({ children }) {
  const { profile, esJefe, esCalidad, signOut } = useAuth()
  const navigate = useNavigate()

  const salir = async () => {
    await signOut()
    navigate('/login')
  }

  // Navegación según rol
  const nav = [
    { to: '/', icon: '🏠', label: 'Inicio', end: true },
    { to: '/escanear', icon: '📷', label: 'Escanear' },
  ]
  if (esJefe || esCalidad) {
    nav.push({ to: '/dashboard', icon: '📊', label: 'Tablero' })
  }
  if (esJefe) {
    nav.push({ to: '/gestion', icon: '🗂️', label: 'Gestión' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Logo size={30} />
          <span>Iturrospe</span>
        </div>
        <div className="spacer" />
        {profile && (
          <div className="row gap-sm">
            <div className="col" style={{ alignItems: 'flex-end', lineHeight: 1.1 }}>
              <span className="bold small">{profile.nombre}</span>
              <span className="xs muted">{ROLES[profile.rol] || 'Sin rol'}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={salir} title="Salir">
              ⎋
            </button>
          </div>
        )}
      </header>

      <main className="content">{children}</main>

      <nav className="bottom-nav">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <InstallPrompt />
    </div>
  )
}
