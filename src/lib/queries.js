import { supabase } from './supabase'

// Trae el plano completo (con OT, subconjunto, procesos y catálogo) por token QR.
export async function getPlanoPorToken(token) {
  const { data: plano, error } = await supabase
    .from('planos')
    .select(
      `id, numero_plano, descripcion, cantidad_total, qr_token,
       subconjunto:subconjuntos!inner(id, nombre, ot:ot!inner(id, codigo, producto, cliente, prioridad, fecha_entrega, estado))`
    )
    .eq('qr_token', token)
    .maybeSingle()
  if (error) throw error
  if (!plano) return null
  return enriquecerPlano(plano)
}

export async function getPlanoPorId(planoId) {
  const { data: plano, error } = await supabase
    .from('planos')
    .select(
      `id, numero_plano, descripcion, cantidad_total, qr_token,
       subconjunto:subconjuntos!inner(id, nombre, ot:ot!inner(id, codigo, producto, cliente, prioridad, fecha_entrega, estado))`
    )
    .eq('id', planoId)
    .maybeSingle()
  if (error) throw error
  if (!plano) return null
  return enriquecerPlano(plano)
}

async function enriquecerPlano(plano) {
  const { data: procesos, error } = await supabase
    .from('plano_procesos')
    .select(
      `id, cantidad_requerida, cantidad_completada, estado, orden, prioridad,
       proceso:procesos_catalogo(id, nombre, metodos)`
    )
    .eq('plano_id', plano.id)
    .order('orden', { ascending: true })
  if (error) throw error
  return { ...plano, procesos: procesos || [] }
}

// Historial cronológico de un plano: partes de trabajo + comentarios.
export async function getHistorialPlano(planoId, procesoIds) {
  const ids = procesoIds && procesoIds.length ? procesoIds : ['00000000-0000-0000-0000-000000000000']

  const [partesRes, comentariosRes] = await Promise.all([
    supabase
      .from('partes_trabajo')
      .select(
        `id, cantidad_realizada, metodo, hora_inicio, hora_fin, observaciones,
         es_defecto, cantidad_defectuosa, anulado, created_at, plano_proceso_id,
         usuario:usuarios(nombre, usuario),
         plano_proceso:plano_procesos(proceso:procesos_catalogo(nombre))`
      )
      .in('plano_proceso_id', ids)
      .order('created_at', { ascending: false }),
    supabase
      .from('comentarios')
      .select(`id, tipo, texto, created_at, usuario:usuarios(nombre, usuario, rol)`)
      .eq('plano_id', planoId)
      .order('created_at', { ascending: false }),
  ])
  if (partesRes.error) throw partesRes.error
  if (comentariosRes.error) throw comentariosRes.error

  const eventos = [
    ...(partesRes.data || []).map((p) => ({
      kind: p.es_defecto ? 'defecto' : 'parte',
      ts: p.created_at,
      data: p,
    })),
    ...(comentariosRes.data || []).map((c) => ({
      kind: 'comentario',
      ts: c.created_at,
      data: c,
    })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts))

  return eventos
}

// Lista de OTs con sus planos/procesos para calcular avance.
export async function getOTsConAvance() {
  const { data, error } = await supabase
    .from('ot')
    .select(
      `id, codigo, producto, cliente, prioridad, estado, fecha_entrega, fecha_creacion,
       subconjuntos(id, nombre,
         planos(id, numero_plano,
           plano_procesos(id, cantidad_requerida, cantidad_completada, estado)))`
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Todos los procesos del plano con su catálogo y OT (para dashboard / cuellos de botella).
export async function getProcesosGlobal() {
  const { data, error } = await supabase
    .from('plano_procesos')
    .select(
      `id, cantidad_requerida, cantidad_completada, estado,
       proceso:procesos_catalogo(nombre),
       plano:planos!inner(numero_plano, subconjunto:subconjuntos!inner(ot:ot!inner(id, codigo)))`
    )
  if (error) throw error
  return data || []
}

// Partes de trabajo (para tiempos, throughput y defectos). Opcional: desde fecha.
export async function getPartesGlobal() {
  const { data, error } = await supabase
    .from('partes_trabajo')
    .select(
      `id, cantidad_realizada, hora_inicio, hora_fin, es_defecto, cantidad_defectuosa,
       anulado, created_at,
       proceso:plano_procesos!inner(proceso:procesos_catalogo(nombre))`
    )
    .eq('anulado', false)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getCatalogo() {
  const { data, error } = await supabase
    .from('procesos_catalogo')
    .select('*')
    .order('orden')
  if (error) throw error
  return data || []
}
