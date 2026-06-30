// Edge Function: gestión de usuarios por el JEFE DE PLANTA.
// Permite crear usuarios (usuario + nombre + PIN) ya autorizados y eliminarlos.
// A diferencia de `registrar-usuario` (alta pública con aprobación posterior),
// esta función EXIGE sesión: el llamador debe ser un jefe de planta activo.
//
// Acciones (POST { action, ... }):
//   - "crear":     { usuario, nombre, pin, rol, sector? }  -> alta directa y activa
//   - "reset_pin": { usuario_id, nuevo_pin }               -> asigna un PIN nuevo
//   - "eliminar":  { usuario_id, pin }                     -> baja definitiva
//                  (el `pin` es el del PROPIO jefe: clave de seguridad / reautenticación)
//
// Deploy:  supabase functions deploy admin-usuarios
// (SIN --no-verify-jwt: la plataforma valida el JWT; además revalidamos el rol.)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const DOMAIN = 'iturrospe.com.ar'
const ROLES = ['operario', 'calidad', 'jefe']
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

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ---- Identificar y autorizar al llamador (debe ser jefe activo) ----
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'No autorizado' }, 401)

  const { data: caller, error: callerErr } = await admin.auth.getUser(jwt)
  if (callerErr || !caller.user) return json({ error: 'Sesión inválida' }, 401)

  const { data: perfil } = await admin
    .from('usuarios')
    .select('rol, estado')
    .eq('id', caller.user.id)
    .maybeSingle()

  if (!perfil || perfil.rol !== 'jefe' || perfil.estado !== 'activo') {
    return json({ error: 'Solo el jefe de planta puede gestionar usuarios' }, 403)
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const action = String(payload.action || '')

  // ================================================================
  // CREAR usuario (alta directa, ya autorizado/activo)
  // ================================================================
  if (action === 'crear') {
    const usuario = String(payload.usuario || '').trim().toLowerCase()
    const nombre = String(payload.nombre || '').trim()
    const pin = String(payload.pin || '').trim()
    const rol = String(payload.rol || '').trim()
    const sector = String(payload.sector || '').trim() || null

    if (!/^[a-z0-9._-]{3,}$/.test(usuario)) return json({ error: 'Usuario inválido (mín. 3, letras/números/._-)' }, 400)
    if (!nombre) return json({ error: 'Falta el nombre' }, 400)
    if (!/^\d{6}$/.test(pin)) return json({ error: 'El PIN debe tener 6 dígitos' }, 400)
    if (!ROLES.includes(rol)) return json({ error: 'Rol inválido' }, 400)

    const email = `${usuario}@${DOMAIN}`
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { usuario, nombre },
    })
    if (error) {
      const dup = /registered|exists|already/i.test(error.message)
      return json({ error: dup ? 'Ese usuario ya existe' : error.message }, dup ? 409 : 400)
    }

    // El trigger handle_new_user crea el perfil en 'pendiente'; al venir el alta
    // de un jefe lo dejamos directamente activo con su rol/sector.
    const { error: upErr } = await admin
      .from('usuarios')
      .update({ rol, estado: 'activo', sector, nombre })
      .eq('id', created.user!.id)
    if (upErr) {
      // Rollback del auth user para no dejar una cuenta huérfana.
      await admin.auth.admin.deleteUser(created.user!.id)
      return json({ error: upErr.message }, 400)
    }

    return json({ ok: true })
  }

  // ================================================================
  // RESET PIN (el jefe asigna un PIN nuevo a quien lo olvidó)
  // ================================================================
  if (action === 'reset_pin') {
    const usuarioId = String(payload.usuario_id || '')
    const nuevoPin = String(payload.nuevo_pin || '').trim()

    if (!usuarioId) return json({ error: 'Falta el usuario' }, 400)
    if (!/^\d{6}$/.test(nuevoPin)) return json({ error: 'El PIN nuevo debe tener 6 dígitos' }, 400)

    const { error: pwErr } = await admin.auth.admin.updateUserById(usuarioId, { password: nuevoPin })
    if (pwErr) return json({ error: pwErr.message }, 400)

    // Limpia la marca de solicitud de reseteo.
    await admin
      .from('usuarios')
      .update({ reset_pin_solicitado: false, reset_pin_solicitado_at: null })
      .eq('id', usuarioId)

    return json({ ok: true })
  }

  // ================================================================
  // ELIMINAR usuario (baja definitiva, con clave de seguridad)
  // ================================================================
  if (action === 'eliminar') {
    const usuarioId = String(payload.usuario_id || '')
    const pin = String(payload.pin || '').trim()

    if (!usuarioId) return json({ error: 'Falta el usuario a eliminar' }, 400)
    if (usuarioId === caller.user.id) return json({ error: 'No podés eliminar tu propia cuenta' }, 400)
    if (!/^\d{6}$/.test(pin)) return json({ error: 'Ingresá tu PIN de seguridad (6 dígitos)' }, 400)

    // Clave de seguridad: el jefe reconfirma con su PROPIO PIN.
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: pinErr } = await anon.auth.signInWithPassword({
      email: caller.user.email!,
      password: pin,
    })
    if (pinErr) return json({ error: 'PIN de seguridad incorrecto' }, 403)

    // Trazabilidad: no se borra a quien tenga partes o comentarios cargados.
    const [partesRes, comentRes] = await Promise.all([
      admin.from('partes_trabajo').select('id', { count: 'exact', head: true }).eq('usuario_id', usuarioId),
      admin.from('comentarios').select('id', { count: 'exact', head: true }).eq('usuario_id', usuarioId),
    ])
    if ((partesRes.count || 0) > 0 || (comentRes.count || 0) > 0) {
      return json(
        { error: 'No se puede eliminar: el usuario tiene partes o comentarios registrados. Inactivalo para conservar la trazabilidad.' },
        409,
      )
    }

    // Borra auth.users -> cascada a public.usuarios (FK on delete cascade).
    const { error: delErr } = await admin.auth.admin.deleteUser(usuarioId)
    if (delErr) {
      const fk = /foreign key|violates|referenced/i.test(delErr.message)
      return json(
        { error: fk ? 'No se puede eliminar: el usuario tiene historial asociado. Inactivalo en su lugar.' : delErr.message },
        fk ? 409 : 400,
      )
    }

    return json({ ok: true })
  }

  return json({ error: 'Acción no soportada' }, 400)
})
