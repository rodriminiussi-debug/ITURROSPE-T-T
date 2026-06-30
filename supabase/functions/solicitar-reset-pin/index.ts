// Edge Function: solicitar reseteo de PIN (olvido de contraseña).
// Endpoint PÚBLICO (sin sesión): el operario no puede iniciar sesión porque
// olvidó el PIN, así que sólo deja una solicitud. El jefe la ve en Usuarios y
// le asigna un PIN nuevo (vía admin-usuarios, acción "reset_pin").
//
// Por seguridad responde siempre ok, sin revelar si el usuario existe.
//
// Deploy:  supabase functions deploy solicitar-reset-pin --no-verify-jwt
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

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

  let payload: { usuario?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const usuario = String(payload.usuario || '').trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,}$/.test(usuario)) return json({ error: 'Usuario inválido' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Marca la solicitud si el usuario existe. No revela si existe o no.
  await admin
    .from('usuarios')
    .update({ reset_pin_solicitado: true, reset_pin_solicitado_at: new Date().toISOString() })
    .eq('usuario', usuario)

  return json({ ok: true })
})
