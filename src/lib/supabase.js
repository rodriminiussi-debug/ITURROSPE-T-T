import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

if (!supabaseConfigured) {
  // Aviso claro en consola para facilitar el setup.
  console.warn(
    '[Iturrospe] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copiá .env.example a .env y completá las credenciales de tu proyecto Supabase.'
  )
}

// Dominio sintético para el login usuario + PIN (ver sección 4).
export const EMAIL_DOMAIN = 'iturrospe.local'
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
