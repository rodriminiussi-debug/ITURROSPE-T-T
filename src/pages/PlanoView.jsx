import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { getPlanoPorToken, getHistorialPlano } from '../lib/queries'
import {
  ESTADOS_PROCESO,
  avanceProceso,
  pct,
  fmtFecha,
  fmtHora,
  fmtDuracion,
  duracionMin,
  TIPOS_COMENTARIO,
  ROLES,
} from '../lib/helpers'
import { Loading, Badge, Progress, Modal, Empty, useToast } from '../components/ui'

export default function PlanoView() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { esJefe, esCalidad } = useAuth()
  const toast = useToast()

  const [plano, setPlano] = useState(undefined) // undefined=cargando, null=no existe
  const [historial, setHistorial] = useState([])
  const [tab, setTab] = useState('procesos')
  const [procesoSel, setProcesoSel] = useState(null)
  const [comentarioOpen, setComentarioOpen] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const p = await getPlanoPorToken(token)
      setPlano(p)
      if (p) {
        const h = await getHistorialPlano(
          p.id,
          p.procesos.map((x) => x.id)
        )
        setHistorial(h)
      }
    } catch (e) {
      toast(e.message || 'Error cargando plano', 'error')
      setPlano(null)
    }
  }, [token, toast])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (plano === undefined) return <Loading text="Cargando plano…" />
  if (plano === null)
    return (
      <Empty
        icon="❓"
        title="Plano no encontrado"
        hint="El código QR no corresponde a ningún plano. Verificá el código."
      />
    )

  const ot = plano.subconjunto.ot

  return (
    <div>
      <button className="btn btn-ghost btn-sm mb" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      {/* Encabezado del plano */}
      <div className="card">
        <div className="row between">
          <div>
            <div className="xs muted">PLANO</div>
            <h2 style={{ margin: 0 }}>{plano.numero_plano}</h2>
          </div>
          <Badge>{plano.cantidad_total} pieza(s)</Badge>
        </div>
        {plano.descripcion && <p className="small mt" style={{ margin: '0.5rem 0 0' }}>{plano.descripcion}</p>}
        <div className="mt small muted" style={{ lineHeight: 1.6 }}>
          <div><b>OT:</b> {ot.codigo} — {ot.producto}</div>
          <div><b>Subconjunto:</b> {plano.subconjunto.nombre}</div>
          {ot.cliente && <div><b>Cliente:</b> {ot.cliente}</div>}
        </div>
      </div>

      {/* Tabs */}
      <div className="row gap mt mb">
        <button
          className={`btn btn-sm grow ${tab === 'procesos' ? 'btn-primary' : ''}`}
          onClick={() => setTab('procesos')}
        >
          Procesos
        </button>
        <button
          className={`btn btn-sm grow ${tab === 'historial' ? 'btn-primary' : ''}`}
          onClick={() => setTab('historial')}
        >
          Historial
        </button>
      </div>

      {tab === 'procesos' ? (
        <>
          {plano.procesos.length === 0 ? (
            <Empty icon="🧩" title="Sin procesos" hint="Este plano no tiene ruta de procesos cargada." />
          ) : (
            plano.procesos.map((pp) => (
              <ProcesoCard key={pp.id} pp={pp} onClick={() => setProcesoSel(pp)} />
            ))
          )}
        </>
      ) : (
        <Historial eventos={historial} esJefe={esJefe} onChange={cargar} />
      )}

      {/* Comentarios calidad/jefe */}
      {(esCalidad || esJefe) && (
        <button className="btn btn-dark btn-block mt-lg" onClick={() => setComentarioOpen(true)}>
          💬 Agregar comentario / no conformidad
        </button>
      )}

      {procesoSel && (
        <RegistroModal
          pp={procesoSel}
          onClose={() => setProcesoSel(null)}
          onSaved={() => {
            setProcesoSel(null)
            cargar()
          }}
        />
      )}

      {comentarioOpen && (
        <ComentarioModal
          planoId={plano.id}
          onClose={() => setComentarioOpen(false)}
          onSaved={() => {
            setComentarioOpen(false)
            cargar()
          }}
        />
      )}
    </div>
  )
}

function ProcesoCard({ pp, onClick }) {
  const est = ESTADOS_PROCESO[pp.estado]
  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="row between mb">
        <div className="bold">{pp.proceso.nombre}</div>
        <Badge color={est.color}>{est.label}</Badge>
      </div>
      <Progress value={avanceProceso(pp)} />
      <div className="row between mt" style={{ fontSize: '0.85rem' }}>
        <span className="muted">
          {pp.cantidad_completada}/{pp.cantidad_requerida} piezas
        </span>
        <span className="bold">{pct(avanceProceso(pp))}</span>
      </div>
    </div>
  )
}

// ----------------- Modal de registro de avance / defecto -----------------
function RegistroModal({ pp, onClose, onSaved }) {
  const toast = useToast()
  const tieneMetodos = pp.proceso.metodos && pp.proceso.metodos.length > 0
  const [metodo, setMetodo] = useState(tieneMetodos ? pp.proceso.metodos[0] : '')
  const [inicio, setInicio] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [terminoTodas, setTerminoTodas] = useState(false)
  const [obs, setObs] = useState('')
  const [modo, setModo] = useState('avance') // avance | defecto
  const [cantDef, setCantDef] = useState('')
  const [saving, setSaving] = useState(false)

  const restante = Math.max(0, pp.cantidad_requerida - pp.cantidad_completada)

  const iniciar = () => setInicio(new Date().toISOString())

  const guardarAvance = async () => {
    let cant = parseInt(cantidad, 10)
    if (terminoTodas) cant = restante
    if (!cant || cant <= 0) return toast('Ingresá la cantidad realizada', 'error')

    setSaving(true)
    try {
      const { error } = await supabase.rpc('registrar_parte', {
        p_plano_proceso_id: pp.id,
        p_cantidad: cant,
        p_metodo: metodo || null,
        p_hora_inicio: inicio,
        p_hora_fin: new Date().toISOString(),
        p_observaciones: obs || null,
        p_es_defecto: false,
        p_cantidad_defectuosa: null,
      })
      if (error) throw error
      toast('Avance registrado ✓', 'success')
      onSaved()
    } catch (e) {
      toast(e.message || 'No se pudo registrar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const guardarDefecto = async () => {
    const cant = parseInt(cantDef, 10)
    if (!cant || cant <= 0) return toast('Ingresá la cantidad afectada', 'error')
    if (!obs.trim()) return toast('Describí el defecto en observaciones', 'error')
    setSaving(true)
    try {
      const { error } = await supabase.rpc('registrar_parte', {
        p_plano_proceso_id: pp.id,
        p_cantidad: 0,
        p_metodo: metodo || null,
        p_hora_inicio: null,
        p_hora_fin: new Date().toISOString(),
        p_observaciones: obs,
        p_es_defecto: true,
        p_cantidad_defectuosa: cant,
      })
      if (error) throw error
      toast('Defecto reportado — proceso en Retrabajo', 'success')
      onSaved()
    } catch (e) {
      toast(e.message || 'No se pudo reportar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={pp.proceso.nombre} onClose={onClose}>
      <div className="row between mb">
        <Badge color={ESTADOS_PROCESO[pp.estado].color}>{ESTADOS_PROCESO[pp.estado].label}</Badge>
        <span className="small muted">
          {pp.cantidad_completada}/{pp.cantidad_requerida} · faltan {restante}
        </span>
      </div>

      <div className="row gap mb">
        <button
          className={`btn btn-sm grow ${modo === 'avance' ? 'btn-primary' : ''}`}
          onClick={() => setModo('avance')}
        >
          Registrar avance
        </button>
        <button
          className={`btn btn-sm grow ${modo === 'defecto' ? 'btn-danger' : ''}`}
          onClick={() => setModo('defecto')}
        >
          Reportar defecto
        </button>
      </div>

      {tieneMetodos && (
        <div className="field">
          <label className="label">Método</label>
          <select className="select" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {pp.proceso.metodos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {modo === 'avance' ? (
        <>
          <div className="field">
            <label className="label">Inicio de la tanda</label>
            {inicio ? (
              <div className="row between">
                <span className="bold">🟢 Iniciado {fmtHora(inicio)}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setInicio(null)}>
                  Reiniciar
                </button>
              </div>
            ) : (
              <button className="btn btn-block" onClick={iniciar}>
                ▶ Iniciar (registra la hora)
              </button>
            )}
          </div>

          <div className="field">
            <label className="label">Cantidad realizada en esta sesión</label>
            <input
              className="input"
              inputMode="numeric"
              disabled={terminoTodas}
              value={terminoTodas ? restante : cantidad}
              onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
            />
          </div>

          <label className="row gap-sm mb" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={terminoTodas}
              onChange={(e) => setTerminoTodas(e.target.checked)}
              style={{ width: 22, height: 22 }}
            />
            <span>Terminé todas las piezas restantes ({restante})</span>
          </label>

          <div className="field">
            <label className="label">Observaciones (opcional)</label>
            <textarea
              className="input"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Notas de la tanda…"
            />
          </div>

          <button className="btn btn-primary btn-block btn-lg" disabled={saving} onClick={guardarAvance}>
            {saving ? 'Guardando…' : '✓ Finalizar y registrar'}
          </button>
        </>
      ) : (
        <>
          <div className="field">
            <label className="label">Cantidad afectada / defectuosa</label>
            <input
              className="input"
              inputMode="numeric"
              value={cantDef}
              onChange={(e) => setCantDef(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
            />
          </div>
          <div className="field">
            <label className="label">Descripción del defecto</label>
            <textarea
              className="input"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Qué pasó y por qué requiere retrabajo…"
            />
          </div>
          <button className="btn btn-danger btn-block btn-lg" disabled={saving} onClick={guardarDefecto}>
            {saving ? 'Guardando…' : '⚠ Reportar defecto / retrabajo'}
          </button>
        </>
      )}
    </Modal>
  )
}

// ----------------- Modal de comentario (calidad/jefe) -----------------
function ComentarioModal({ planoId, onClose, onSaved }) {
  const toast = useToast()
  const [tipo, setTipo] = useState('comentario')
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    if (!texto.trim()) return toast('Escribí el comentario', 'error')
    setSaving(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const { error } = await supabase.from('comentarios').insert({
        plano_id: planoId,
        usuario_id: u.user.id,
        tipo,
        texto: texto.trim(),
      })
      if (error) throw error
      toast('Comentario agregado ✓', 'success')
      onSaved()
    } catch (e) {
      toast(e.message || 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Comentario de calidad" onClose={onClose}>
      <div className="field">
        <label className="label">Tipo</label>
        <select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {Object.entries(TIPOS_COMENTARIO).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label">Texto</label>
        <textarea className="input" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-block" disabled={saving} onClick={guardar}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </Modal>
  )
}

// ----------------- Timeline de historial -----------------
function Historial({ eventos, esJefe, onChange }) {
  const toast = useToast()

  const anular = async (id) => {
    if (!confirm('¿Anular este registro? Queda traza de quién lo anuló.')) return
    const { error } = await supabase.rpc('anular_parte', { p_parte_id: id })
    if (error) toast(error.message, 'error')
    else {
      toast('Registro anulado', 'success')
      onChange()
    }
  }
  const resolver = async (id) => {
    const { error } = await supabase.rpc('resolver_defecto', { p_parte_id: id })
    if (error) toast(error.message, 'error')
    else {
      toast('Defecto resuelto', 'success')
      onChange()
    }
  }

  if (!eventos.length)
    return <Empty icon="📜" title="Sin movimientos" hint="Todavía no hay registros para este plano." />

  return (
    <div className="timeline mt">
      {eventos.map((ev) => {
        if (ev.kind === 'comentario') {
          const c = ev.data
          return (
            <div key={'c' + c.id} className="tl-item comentario">
              <div className="row between">
                <Badge color={TIPOS_COMENTARIO[c.tipo]?.color}>{TIPOS_COMENTARIO[c.tipo]?.label}</Badge>
                <span className="xs muted">{fmtFecha(c.created_at)}</span>
              </div>
              <div className="small mt">{c.texto}</div>
              <div className="xs muted mt">
                {c.usuario?.nombre} · {ROLES[c.usuario?.rol] || ''}
              </div>
            </div>
          )
        }
        const p = ev.data
        const defecto = ev.kind === 'defecto'
        const dur = duracionMin(p.hora_inicio, p.hora_fin)
        return (
          <div key={'p' + p.id} className={`tl-item ${defecto ? 'defecto' : ''}`}>
            <div className="row between">
              <span className="bold">
                {p.plano_proceso?.proceso?.nombre}
                {p.metodo ? ` · ${p.metodo}` : ''}
              </span>
              <span className="xs muted">{fmtFecha(p.created_at)}</span>
            </div>
            {p.anulado ? (
              <div className="small danger-text">Registro anulado</div>
            ) : defecto ? (
              <div className="small danger-text">
                ⚠ Defecto: {p.cantidad_defectuosa > 0 ? `${p.cantidad_defectuosa} pieza(s)` : 'resuelto'}
              </div>
            ) : (
              <div className="small">✓ {p.cantidad_realizada} pieza(s)</div>
            )}
            {p.observaciones && <div className="small muted mt">“{p.observaciones}”</div>}
            <div className="xs muted mt row gap" style={{ flexWrap: 'wrap' }}>
              <span>👤 {p.usuario?.nombre}</span>
              {p.hora_inicio && <span>🕐 {fmtHora(p.hora_inicio)}–{fmtHora(p.hora_fin)}</span>}
              {dur != null && <span>⏱ {fmtDuracion(dur)}</span>}
            </div>
            {esJefe && !p.anulado && (
              <div className="row gap mt">
                {defecto && p.cantidad_defectuosa > 0 && (
                  <button className="btn btn-sm" onClick={() => resolver(p.id)}>
                    Marcar resuelto
                  </button>
                )}
                <button className="btn btn-sm btn-ghost danger-text" onClick={() => anular(p.id)}>
                  Anular
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
