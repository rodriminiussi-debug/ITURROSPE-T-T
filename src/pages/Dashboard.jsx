import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import { getOTsConAvance, getProcesosGlobal, getPartesGlobal } from '../lib/queries'
import {
  avancePlano, pct, PRIORIDADES, estadoEntrega, fmtFechaCorta, duracionMin, fmtDuracion,
} from '../lib/helpers'
import { Loading, Badge, Progress, Empty } from '../components/ui'
import { format } from 'date-fns'

const AMARILLO = '#FFC107'
const AZUL = '#1971c2'

function avanceOT(ot) {
  const procesos = (ot.subconjuntos || []).flatMap((s) =>
    (s.planos || []).flatMap((p) => p.plano_procesos || [])
  )
  return avancePlano(procesos)
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [filtroOT, setFiltroOT] = useState('')

  useEffect(() => {
    Promise.all([getOTsConAvance(), getProcesosGlobal(), getPartesGlobal()])
      .then(([ots, procesos, partes]) => setData({ ots, procesos, partes }))
      .catch(() => setData({ ots: [], procesos: [], partes: [] }))
  }, [])

  const kpis = useMemo(() => {
    if (!data) return null
    const { ots, procesos, partes } = data

    // Avance global = promedio de avance de todos los procesos
    const avGlobal = avancePlano(procesos)

    // WIP: procesos en curso
    const wip = procesos.filter((p) => p.estado === 'en_curso').length

    // OTs atrasadas / en riesgo
    let atrasadas = 0
    ots.forEach((ot) => {
      const e = estadoEntrega(ot, avanceOT(ot))
      if (e === 'atrasada' || e === 'riesgo') atrasadas++
    })

    // Defectos abiertos
    const defectos = partes.filter((p) => p.es_defecto && (p.cantidad_defectuosa || 0) > 0).length

    return { avGlobal, wip, atrasadas, defectos }
  }, [data])

  // Carga por proceso (pendiente) y cuellos de botella
  const cargaPorProceso = useMemo(() => {
    if (!data) return []
    const map = {}
    data.procesos.forEach((p) => {
      const nombre = p.proceso?.nombre || '—'
      const pend = Math.max(0, (p.cantidad_requerida || 0) - (p.cantidad_completada || 0))
      if (!map[nombre]) map[nombre] = { proceso: nombre, pendiente: 0, total: 0 }
      map[nombre].pendiente += pend
      map[nombre].total += p.cantidad_requerida || 0
    })
    return Object.values(map).sort((a, b) => b.pendiente - a.pendiente)
  }, [data])

  // Tiempos promedio por proceso
  const tiemposPorProceso = useMemo(() => {
    if (!data) return []
    const map = {}
    data.partes.forEach((p) => {
      if (p.es_defecto) return
      const d = duracionMin(p.hora_inicio, p.hora_fin)
      if (d == null) return
      const nombre = p.proceso?.proceso?.nombre || '—'
      if (!map[nombre]) map[nombre] = { proceso: nombre, sum: 0, n: 0 }
      map[nombre].sum += d
      map[nombre].n += 1
    })
    return Object.values(map)
      .map((x) => ({ proceso: x.proceso, min: Math.round(x.sum / x.n) }))
      .sort((a, b) => b.min - a.min)
  }, [data])

  // Throughput: piezas completadas por día (últimos 14 días con datos)
  const throughput = useMemo(() => {
    if (!data) return []
    const map = {}
    data.partes.forEach((p) => {
      if (p.es_defecto) return
      const dia = format(new Date(p.created_at), 'dd/MM')
      map[dia] = (map[dia] || 0) + (p.cantidad_realizada || 0)
    })
    return Object.entries(map).map(([dia, piezas]) => ({ dia, piezas })).slice(-14)
  }, [data])

  if (!data) return <Loading text="Cargando tablero…" />

  const otsFiltradas = filtroOT
    ? data.ots.filter((o) => o.id === filtroOT)
    : data.ots

  return (
    <div>
      <h2 className="page-title">📊 Tablero de planta</h2>

      {/* KPIs */}
      <div className="kpi-grid mb">
        <div className="kpi">
          <div className="v">{pct(kpis.avGlobal)}</div>
          <div className="l">Avance global</div>
        </div>
        <div className="kpi">
          <div className="v">{kpis.wip}</div>
          <div className="l">Procesos en curso (WIP)</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: kpis.atrasadas ? 'var(--rojo)' : undefined }}>
            {kpis.atrasadas}
          </div>
          <div className="l">OTs atrasadas / en riesgo</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: kpis.defectos ? 'var(--rojo)' : undefined }}>
            {kpis.defectos}
          </div>
          <div className="l">Defectos / retrabajos abiertos</div>
        </div>
      </div>

      {/* Cuellos de botella / carga por proceso */}
      <div className="card">
        <h3>🔧 Carga pendiente por proceso (cuellos de botella)</h3>
        {cargaPorProceso.length === 0 ? (
          <Empty icon="📈" title="Sin datos" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cargaPorProceso} layout="vertical" margin={{ left: 10, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="proceso" width={90} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="pendiente" fill={AMARILLO} radius={[0, 6, 6, 0]} name="Piezas pendientes" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tiempos por proceso */}
      <div className="card">
        <h3>⏱ Tiempo promedio por proceso</h3>
        {tiemposPorProceso.length === 0 ? (
          <Empty icon="⏱" title="Sin tiempos registrados" hint="Se calculan con hora inicio/fin de los partes." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tiemposPorProceso} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="proceso" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(v) => fmtDuracion(v)} />
              <Bar dataKey="min" fill={AZUL} radius={[6, 6, 0, 0]} name="Minutos prom." />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Throughput */}
      <div className="card">
        <h3>📦 Throughput (piezas/día)</h3>
        {throughput.length === 0 ? (
          <Empty icon="📦" title="Sin producción registrada" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={throughput} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="piezas" stroke={AMARILLO} strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Avance por OT */}
      <div className="row between mt-lg mb">
        <h3 style={{ margin: 0 }}>📋 Avance por OT</h3>
        <select className="select" style={{ width: 'auto', minHeight: 40 }} value={filtroOT} onChange={(e) => setFiltroOT(e.target.value)}>
          <option value="">Todas</option>
          {data.ots.map((o) => (
            <option key={o.id} value={o.id}>{o.codigo}</option>
          ))}
        </select>
      </div>

      {otsFiltradas.length === 0 ? (
        <Empty icon="🏭" title="No hay OTs" />
      ) : (
        otsFiltradas.map((ot) => {
          const av = avanceOT(ot)
          const ent = estadoEntrega(ot, av)
          return (
            <Link key={ot.id} to={`/gestion/ot/${ot.id}`} className="card" style={{ display: 'block', color: 'inherit' }}>
              <div className="row between mb">
                <div>
                  <span className="bold">{ot.codigo}</span> <span className="muted small">— {ot.producto}</span>
                </div>
                <div className="row gap-sm">
                  <Badge color={PRIORIDADES[ot.prioridad]?.color}>{PRIORIDADES[ot.prioridad]?.label}</Badge>
                  {ent === 'atrasada' && <Badge color="retrabajo">Atrasada</Badge>}
                  {ent === 'riesgo' && <Badge color="en_espera">En riesgo</Badge>}
                </div>
              </div>
              <Progress value={av} />
              <div className="row between mt small">
                <span className="muted">{ot.fecha_entrega ? `Entrega ${fmtFechaCorta(ot.fecha_entrega)}` : 'Sin fecha'}</span>
                <span className="bold">{pct(av)}</span>
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}
