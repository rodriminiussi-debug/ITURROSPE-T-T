// Carga datos de ejemplo para probar el flujo completo de inmediato.
// Requiere: SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY.
// Uso:  npm run seed     (lee variables de .env si existe)
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Mini cargador de .env (sin dependencias)
const envPath = resolve(__dirname, '..', '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !KEY) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Configurá .env (ver .env.example).')
  process.exit(1)
}

const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const EMAIL_DOMAIN = 'iturrospe.local'

async function crearUsuario({ usuario, nombre, pin, rol, estado, sector }) {
  const email = `${usuario}@${EMAIL_DOMAIN}`
  // ¿existe?
  const { data: list } = await db.auth.admin.listUsers()
  let user = list.users.find((u) => u.email === email)
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: String(pin),
      email_confirm: true,
      user_metadata: { usuario, nombre },
    })
    if (error) throw error
    user = data.user
  }
  // El trigger handle_new_user crea la fila; la actualizamos con rol/estado.
  await db.from('usuarios').upsert({
    id: user.id, nombre, usuario, rol, estado, sector: sector || null,
  })
  console.log(`  ✓ usuario @${usuario} (${rol}/${estado})`)
  return user.id
}

async function main() {
  console.log('Sembrando datos de ejemplo…\n')

  // ---- Usuarios ----
  const jefe = await crearUsuario({ usuario: 'jperez', nombre: 'Juan Pérez', pin: '123456', rol: 'jefe', estado: 'activo', sector: 'Planta' })
  const calidad = await crearUsuario({ usuario: 'mlopez', nombre: 'María López', pin: '123456', rol: 'calidad', estado: 'activo', sector: 'Calidad' })
  const op1 = await crearUsuario({ usuario: 'rgomez', nombre: 'Ricardo Gómez', pin: '123456', rol: 'operario', estado: 'activo', sector: 'Soldadura' })
  const op2 = await crearUsuario({ usuario: 'asosa', nombre: 'Ana Sosa', pin: '123456', rol: 'operario', estado: 'activo', sector: 'Mecanizado' })
  await crearUsuario({ usuario: 'pendiente', nombre: 'Operario Pendiente', pin: '123456', rol: null, estado: 'pendiente' })

  // ---- Catálogo de procesos (ya viene por migración) ----
  const { data: catalogo } = await db.from('procesos_catalogo').select('id, nombre')
  if (!catalogo?.length) {
    console.error('No hay procesos_catalogo. Aplicá primero las migraciones (incluida 0004_seed_catalogo.sql).')
    process.exit(1)
  }
  const cat = Object.fromEntries(catalogo.map((c) => [c.nombre, c.id]))

  // Helpers de creación
  async function nuevaOT(ot) {
    const { data, error } = await db.from('ot').upsert(ot, { onConflict: 'codigo' }).select('id').single()
    if (error) throw error
    return data.id
  }
  async function nuevoSub(ot_id, nombre, orden) {
    const { data, error } = await db.from('subconjuntos').insert({ ot_id, nombre, orden }).select('id').single()
    if (error) throw error
    return data.id
  }
  async function nuevoPlano(subconjunto_id, numero_plano, descripcion, cantidad_total) {
    const { data, error } = await db.from('planos').insert({ subconjunto_id, numero_plano, descripcion, cantidad_total }).select('id, qr_token').single()
    if (error) throw error
    return data
  }
  async function nuevaRuta(plano_id, procesos) {
    // procesos: [{nombre, requerida}]
    const rows = procesos.map((p, i) => ({
      plano_id, proceso_catalogo_id: cat[p.nombre], cantidad_requerida: p.requerida, orden: i,
    }))
    const { data, error } = await db.from('plano_procesos').insert(rows).select('id, proceso_catalogo_id')
    if (error) throw error
    return data
  }
  async function registrar(p) {
    const { error } = await db.from('partes_trabajo').insert(p)
    if (error) throw error
  }

  // Limpieza de OTs de ejemplo previas (para reseed idempotente)
  await db.from('ot').delete().in('codigo', ['OT-1001', 'OT-1002'])

  // ======== OT 1: Bastidor de prensa ========
  const ot1 = await nuevaOT({
    codigo: 'OT-1001', producto: 'Bastidor de prensa hidráulica', cliente: 'Metalúrgica Sur',
    fecha_entrega: '2026-07-20', prioridad: 'alta', estado: 'en_curso',
  })
  const s1 = await nuevoSub(ot1, 'Estructura', 0)
  const s2 = await nuevoSub(ot1, 'Cilindros', 1)

  const p1 = await nuevoPlano(s1, '00001', 'Columna lateral', 10)
  const r1 = await nuevaRuta(p1.id, [
    { nombre: 'Corte', requerida: 10 },
    { nombre: 'Soldadura', requerida: 10 },
    { nombre: 'Mecanizado', requerida: 10 },
    { nombre: 'Pintura', requerida: 10 },
  ])
  const byName1 = Object.fromEntries(r1.map((x) => [Object.keys(cat).find((n) => cat[n] === x.proceso_catalogo_id), x.id]))

  // División de producción: Corte completo, Soldadura 8/10 (2 operarios), Mecanizado 6/10
  const ahora = Date.now()
  const hAtras = (h) => new Date(ahora - h * 3600 * 1000).toISOString()
  await registrar({ plano_proceso_id: byName1['Corte'], usuario_id: op2, metodo: 'Láser', cantidad_realizada: 10, hora_inicio: hAtras(30), hora_fin: hAtras(28), observaciones: 'Corte láser completo' })
  await registrar({ plano_proceso_id: byName1['Soldadura'], usuario_id: op1, cantidad_realizada: 5, hora_inicio: hAtras(26), hora_fin: hAtras(23), observaciones: 'Primera tanda' })
  await registrar({ plano_proceso_id: byName1['Soldadura'], usuario_id: op2, cantidad_realizada: 3, hora_inicio: hAtras(10), hora_fin: hAtras(8), observaciones: 'Segunda tanda (otro operario)' })
  await registrar({ plano_proceso_id: byName1['Mecanizado'], usuario_id: op2, metodo: 'Torno', cantidad_realizada: 6, hora_inicio: hAtras(7), hora_fin: hAtras(4), observaciones: 'Torneado parcial' })

  const p2 = await nuevoPlano(s1, '00002', 'Travesaño superior', 4)
  const r2 = await nuevaRuta(p2.id, [
    { nombre: 'Corte', requerida: 4 },
    { nombre: 'Plegado', requerida: 4 },
    { nombre: 'Soldadura', requerida: 4 },
  ])
  const byName2 = Object.fromEntries(r2.map((x) => [Object.keys(cat).find((n) => cat[n] === x.proceso_catalogo_id), x.id]))
  await registrar({ plano_proceso_id: byName2['Corte'], usuario_id: op1, metodo: 'Oxicorte', cantidad_realizada: 4, hora_inicio: hAtras(20), hora_fin: hAtras(19) })
  // Defecto en plegado -> retrabajo
  await registrar({ plano_proceso_id: byName2['Plegado'], usuario_id: op1, cantidad_realizada: 0, es_defecto: true, cantidad_defectuosa: 2, hora_fin: hAtras(5), observaciones: 'Ángulo de plegado fuera de tolerancia en 2 piezas' })

  const p3 = await nuevoPlano(s2, '00003', 'Camisa de cilindro', 6)
  await nuevaRuta(p3.id, [
    { nombre: 'Mecanizado', requerida: 6 },
    { nombre: 'Tratamiento Térmico', requerida: 6 },
    { nombre: 'Ajuste', requerida: 6 },
  ])

  // ======== OT 2: Tablero de comando ========
  const ot2 = await nuevaOT({
    codigo: 'OT-1002', producto: 'Tablero de comando', cliente: 'Industrias Norte',
    fecha_entrega: '2026-06-25', prioridad: 'media', estado: 'en_curso',
  })
  const s3 = await nuevoSub(ot2, 'Tablero eléctrico', 0)
  const p4 = await nuevoPlano(s3, '00010', 'Gabinete', 2)
  const r4 = await nuevaRuta(p4.id, [
    { nombre: 'Corte', requerida: 2 },
    { nombre: 'Plegado', requerida: 2 },
    { nombre: 'Pintura', requerida: 2 },
    { nombre: 'Montaje', requerida: 2 },
  ])
  const byName4 = Object.fromEntries(r4.map((x) => [Object.keys(cat).find((n) => cat[n] === x.proceso_catalogo_id), x.id]))
  await registrar({ plano_proceso_id: byName4['Corte'], usuario_id: op2, metodo: 'Láser', cantidad_realizada: 2, hora_inicio: hAtras(50), hora_fin: hAtras(49) })
  await registrar({ plano_proceso_id: byName4['Plegado'], usuario_id: op1, cantidad_realizada: 2, hora_inicio: hAtras(48), hora_fin: hAtras(47) })
  await registrar({ plano_proceso_id: byName4['Pintura'], usuario_id: op1, cantidad_realizada: 2, hora_inicio: hAtras(30), hora_fin: hAtras(28) })

  // Comentario de calidad
  await db.from('comentarios').insert({
    plano_id: p4, usuario_id: calidad, tipo: 'observacion',
    texto: 'Verificar terminación de pintura antes del montaje.',
  })

  console.log('\n✅ Datos de ejemplo cargados.')
  console.log('\nUsuarios de prueba (PIN 123456):')
  console.log('  jperez   → Jefe de planta')
  console.log('  mlopez   → Calidad')
  console.log('  rgomez   → Operario (Soldadura)')
  console.log('  asosa    → Operario (Mecanizado)')
  console.log('  pendiente→ Operario sin aprobar (para probar aprobación)')
}

main().catch((e) => {
  console.error('\n❌ Error:', e.message || e)
  process.exit(1)
})
