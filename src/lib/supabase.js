import { createClient } from '@supabase/supabase-js'

// Backend provisionado por defecto (proyecto Supabase de Producción Iturrospe).
// La anon key es pública por diseño y está protegida por RLS; sirve como
// fallback para que el deploy funcione sin configurar variables de entorno.
// Para usar otro proyecto, definí VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
const DEFAULT_URL = 'https://jznpdalrljjoxcqicrfh.supabase.co'
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6bnBkYWxybGpqb3hjcWljcmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTk0MjksImV4cCI6MjA5ODI3NTQyOX0.1P1Vyw5uHcZ7d6bOmc6ulTSGufseV9t7P2569ZLS-sM'

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

if (!supabaseConfigured) {
  // Aviso claro en consola para facilitar el setup.
  console.warn(
    '[Iturrospe] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copiá .env.example a .env y completá las credenciales de tu proyecto Supabase.'
  )
}

// Dominio sintético para el login usuario + PIN (ver sección 4).
// Nota: GoTrue rechaza TLDs no enrutables como .local, por eso se usa .com.ar.
// No se envían emails reales: el alta crea la cuenta ya confirmada vía Edge Function.
export const EMAIL_DOMAIN = 'iturrospe.com.ar'
export const usuarioToEmail = (usuario) =>
  `${String(usuario).trim().toLowerCase()}@${EMAIL_DOMAIN}`

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
)
