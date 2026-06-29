import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { supabaseConfigured } from './lib/supabase'
import { ToastProvider, Loading } from './components/ui'
import Layout from './components/Layout'
import SetupNotice from './components/SetupNotice'

import Login from './pages/Login'
import Registro from './pages/Registro'
import Pendiente from './pages/Pendiente'
import Home from './pages/Home'

// Páginas pesadas (cámara, gráficos, excel, qr) cargadas bajo demanda.
const Escanear = lazy(() => import('./pages/Escanear'))
const PlanoView = lazy(() => import('./pages/PlanoView'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Gestion = lazy(() => import('./pages/Gestion'))
const OTDetalle = lazy(() => import('./pages/OTDetalle'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Importar = lazy(() => import('./pages/Importar'))
const Etiquetas = lazy(() => import('./pages/Etiquetas'))

// Requiere sesión + cuenta activa. Si está pendiente/inactivo -> /pendiente.
function Privado({ children, rol }) {
  const { user, profile, loading, esActivo } = useAuth()
  const location = useLocation()

  if (loading) return <Loading text="Iniciando…" />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!profile || !esActivo) return <Navigate to="/pendiente" replace />
  if (rol && profile.rol !== rol && !(Array.isArray(rol) && rol.includes(profile.rol))) {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  if (!supabaseConfigured) return <SetupNotice />

  return (
    <ToastProvider>
      <Suspense fallback={<Loading />}>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/pendiente" element={<Pendiente />} />

        {/* Deep link de plano (pide login y redirige acá) */}
        <Route
          path="/plano/:token"
          element={
            <Privado>
              <Layout>
                <PlanoView />
              </Layout>
            </Privado>
          }
        />

        {/* App principal */}
        <Route
          path="/"
          element={
            <Privado>
              <Layout>
                <Home />
              </Layout>
            </Privado>
          }
        />
        <Route
          path="/escanear"
          element={
            <Privado>
              <Layout>
                <Escanear />
              </Layout>
            </Privado>
          }
        />

        {/* Dashboard: jefe o calidad */}
        <Route
          path="/dashboard"
          element={
            <Privado rol={['jefe', 'calidad']}>
              <Layout>
                <Dashboard />
              </Layout>
            </Privado>
          }
        />

        {/* Gestión: solo jefe */}
        <Route
          path="/gestion"
          element={
            <Privado rol="jefe">
              <Layout>
                <Gestion />
              </Layout>
            </Privado>
          }
        />
        <Route
          path="/gestion/ot/:id"
          element={
            <Privado rol="jefe">
              <Layout>
                <OTDetalle />
              </Layout>
            </Privado>
          }
        />
        <Route
          path="/gestion/usuarios"
          element={
            <Privado rol="jefe">
              <Layout>
                <Usuarios />
              </Layout>
            </Privado>
          }
        />
        <Route
          path="/gestion/importar"
          element={
            <Privado rol="jefe">
              <Layout>
                <Importar />
              </Layout>
            </Privado>
          }
        />
        <Route
          path="/gestion/etiquetas"
          element={
            <Privado rol="jefe">
              <Layout>
                <Etiquetas />
              </Layout>
            </Privado>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </ToastProvider>
  )
}
