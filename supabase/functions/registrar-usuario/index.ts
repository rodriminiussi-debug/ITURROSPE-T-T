// Edge Function: alta de usuario (usuario + nombre + PIN).
// Crea la cuenta ya CONFIRMADA con la service role, evitando depender de la
// confirmación por email (incompatible con el esquema de email sintético + PIN).
// El trigger handle_new_user crea el perfil en estado 'pendiente'.
//
// Deploy:  supabase functions deploy registrar-usuario --no-verify-jwt
// (es un endpoint público: el alta debe poder hacerla un usuario sin sesión)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const DOMAIN = 'iturrospe.com.ar'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  let payload: { usuario?: string; nombre?: string; pin?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const usuario = String(payload.usuario || '').trim().toLowerCase()
  const nombre = String(payload.nombre || '').trim()
  const pin = String(payload.pin || '').trim()

  if (!/^[a-z0-9._-]{3,}$/.test(usuario)) return json({ error: 'Usuario inválido' }, 400)
  if (!nombre) return json({ error: 'Falta el nombre' }, 400)
  if (!/^\d{6}$/.test(pin)) return json({ error: 'El PIN debe tener 6 dígitos' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const email = `${usuario}@${DOMAIN}`

  const { error } = await admin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { usuario, nombre },
  })

  if (error) {
    const dup = /registered|exists|already/i.test(error.message)
    return json({ error: dup ? 'Ese usuario ya existe' : error.message }, dup ? 409 : 400)
  }

  return json({ ok: true })
})
