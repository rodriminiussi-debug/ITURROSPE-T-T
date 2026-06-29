import { format, differenceInMinutes, isBefore, isToday, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

export const ESTADOS_PROCESO = {
  pendiente: { label: 'Pendiente', color: 'pendiente' },
  en_curso: { label: 'En curso', color: 'en_curso' },
  hecho: { label: 'Hecho', color: 'hecho' },
  en_espera: { label: 'En espera', color: 'en_espera' },
  retrabajo: { label: 'Retrabajo', color: 'retrabajo' },
}

export const PRIORIDADES = {
  alta: { label: 'Alta', color: 'alta' },
  media: { label: 'Media', color: 'media' },
  baja: { label: 'Baja', color: 'baja' },
}

export const TIPOS_COMENTARIO = {
  comentario: { label: 'Comentario', color: 'comentario' },
  observacion: { label: 'Observación', color: 'observacion' },
  no_conformidad: { label: 'No conformidad', color: 'no_conformidad' },
}

export const ROLES = {
  operario: 'Operario',
  calidad: 'Calidad',
  jefe: 'Jefe de planta',
}

export function fmtFecha(d) {
  if (!d) return '—'
  try {
    return format(new Date(d), "dd/MM/yy HH:mm", { locale: es })
  } catch {
    return '—'
  }
}

export function fmtFechaCorta(d) {
  if (!d) return '—'
  try {
    return format(new Date(d), 'dd/MM/yyyy', { locale: es })
  } catch {
    return '—'
  }
}

export function fmtHora(d) {
  if (!d) return '—'
  try {
    return format(new Date(d), 'HH:mm', { locale: es })
  } catch {
    return '—'
  }
}

export function duracionMin(inicio, fin) {
  if (!inicio || !fin) return null
  return Math.max(0, differenceInMinutes(new Date(fin), new Date(inicio)))
}

export function fmtDuracion(min) {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// Calcula el avance (0..1) de un proceso del plano
export function avanceProceso(pp) {
  if (!pp || !pp.cantidad_requerida) return 0
  return Math.min(1, (pp.cantidad_completada || 0) / pp.cantidad_requerida)
}

// Avance de un plano = promedio del avance de sus procesos
export function avancePlano(procesos) {
  if (!procesos || procesos.length === 0) return 0
  const s = procesos.reduce((acc, pp) => acc + avanceProceso(pp), 0)
  return s / procesos.length
}

// Detecta OT atrasada o en riesgo (entrega vencida o dentro de 3 días sin completar)
export function estadoEntrega(ot, avance) {
  if (!ot?.fecha_entrega) return 'sin_fecha'
  if (avance >= 1 || ot.estado === 'finalizada') return 'ok'
  const fecha = new Date(ot.fecha_entrega)
  if (isBefore(fecha, new Date()) && !isToday(fecha)) return 'atrasada'
  if (isBefore(fecha, addDays(new Date(), 3))) return 'riesgo'
  return 'ok'
}

export function pct(n) {
  return `${Math.round((n || 0) * 100)}%`
}

// Genera el deep-link absoluto del plano a partir del token
export function planoUrl(token) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/plano/${token}`
}
