import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, usuarioToEmail } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // fila de public.usuarios
  const [loading, setLoading] = useState(true)

  const cargarPerfil = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('Error cargando perfil', error)
    }
    setProfile(data || null)
    return data || null
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) await cargarPerfil(data.session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess)
      if (sess?.user) {
        await cargarPerfil(sess.user.id)
      } else {
        setProfile(null)
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [cargarPerfil])

  // ---- Acciones ----
  const signIn = useCallback(async (usuario, pin) => {
    const email = usuarioToEmail(usuario)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: String(pin),
    })
    if (error) throw error
    if (data.user) await cargarPerfil(data.user.id)
    return data
  }, [cargarPerfil])

  const signUp = useCallback(async (usuario, nombre, pin) => {
    // El alta se hace vía Edge Function: crea la cuenta ya confirmada
    // (sin depender de la confirmación por email) y en estado 'pendiente'.
    const { data, error } = await supabase.functions.invoke('registrar-usuario', {
      body: { usuario, nombre, pin },
    })
    if (error) {
      // Intentar extraer el mensaje del cuerpo de la respuesta de la función
      let msg = 'No se pudo registrar'
      try {
        const body = await error.context?.json?.()
        if (body?.error) msg = body.error
      } catch {
        msg = error.message || msg
      }
      throw new Error(msg)
    }
    if (data?.error) throw new Error(data.error)

    // Iniciar sesión automáticamente para mostrar la pantalla "pendiente".
    await signIn(usuario, pin)
    return data
  }, [signIn])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user) return cargarPerfil(session.user.id)
    return null
  }, [session, cargarPerfil])

  const value = {
    session,
    user: session?.user || null,
    profile,
    loading,
    rol: profile?.rol || null,
    estado: profile?.estado || null,
    esJefe: profile?.rol === 'jefe' && profile?.estado === 'activo',
    esCalidad: profile?.rol === 'calidad' && profile?.estado === 'activo',
    esActivo: profile?.estado === 'activo',
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
