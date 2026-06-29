import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCatalogo } from '../lib/queries'
import {
  ESTADOS_PROCESO, PRIORIDADES, avanceProceso, avancePlano, pct, fmtFechaCorta,
} from '../lib/helpers'
import { Loading, Badge, Progress, Modal, Empty, useToast } from '../components/ui'

export default function OTDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [ot, setOt] = useState(undefined)
  const [catalogo, setCatalogo] = useState([])
  const [modal, setModal] = useState(null) // {tipo, ...}

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('ot')
      .select(
        `id, codigo, producto, cliente, prioridad, estado, fecha_entrega, fecha_creacion,
         subconjuntos(id, nombre, orden,
           planos(id, numero_plano, descripcion, cantidad_total, qr_token,
             plano_procesos(id, cantidad_requerida, cantidad_completada, estado, orden, prioridad,
               proceso:procesos_catalogo(id, nombre, metodos))))`
      )
      .eq('id', id)
      .maybeSingle()
    if (error) {
      toast(error.message, 'error')
      setOt(null)
      return
    }
    // ordenar
    if (data) {
      data.subconjuntos?.sort((a, b) => a.orden - b.orden)
      data.subconjuntos?.forEach((s) =>
        s.planos?.forEach((p) => p.plano_procesos?.sort((a, b) => a.orden - b.orden))
      )
    }
    setOt(data)
  }, [id, toast])

  useEffect(() => {
    cargar()
    getCatalogo().then(setCatalogo)
  }, [cargar])

  if (ot === undefined) return <Loading />
  if (ot === null) return <Empty icon="❓" title="OT no encontrada" />

  const todosProcesos = (ot.subconjuntos || []).flatMap((s) =>
    (s.planos || []).flatMap((p) => p.plano_procesos || [])
  )
  const avance = avancePlano(todosProcesos)

  const actualizarOT = async (campos) => {
    const { error } = await supabase.from('ot').update(campos).eq('id', id)
    if (error) toast(error.message, 'error')
    else {
      toast('OT actualizada', 'success')
      cargar()
    }
  }

  const setEstadoProceso = async (ppId, estado) => {
    const { error } = await supabase.rpc('set_estado_proceso', { p_pp_id: ppId, p_estado: estado })
    if (error) toast(error.message, 'error')
    else cargar()
  }

  const eliminar = async (tabla, idDel, label) => {
    if (!confirm(`¿Eliminar ${label}? Se borrarán sus registros asociados.`)) return
    const { error } = await supabase.from(tabla).delete().eq('id', idDel)
    if (error) toast(error.message, 'error')
    else {
      toast('Eliminado', 'success')
      cargar()
    }
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm mb" onClick={() => navigate('/gestion')}>
        ← Gestión
      </button>

      {/* Header OT */}
      <div className="card">
        <div className="row between">
          <div>
            <h2 style={{ margin: 0 }}>{ot.codigo}</h2>
            <div className="muted">{ot.producto}{ot.cliente ? ` · ${ot.cliente}` : ''}</div>
          </div>
          <button className="btn btn-sm" onClick={() => setModal({ tipo: 'editOT' })}>
            ✎ Editar
          </button>
        </div>
        <div className="row gap-sm mt wrap">
          <Badge color={PRIORIDADES[ot.prioridad]?.color}>Prioridad {PRIORIDADES[ot.prioridad]?.label}</Badge>
          <Badge color={ot.estado === 'finalizada' ? 'hecho' : ot.estado === 'pausada' ? 'en_espera' : 'en_curso'}>
            {ot.estado.replace('_', ' ')}
          </Badge>
          {ot.fecha_entrega && <Badge>Entrega {fmtFechaCorta(ot.fecha_entrega)}</Badge>}
        </div>
        <div className="mt">
          <Progress value={avance} />
          <div className="row between mt small">
            <span className="muted">Avance total</span>
            <span className="bold">{pct(avance)}</span>
          </div>
        </div>
        <div className="row gap mt">
          <select
            className="select"
            style={{ minHeight: 42 }}
            value={ot.prioridad}
            onChange={(e) => actualizarOT({ prioridad: e.target.value })}
          >
            <option value="alta">Prioridad Alta</option>
            <option value="media">Prioridad Media</option>
            <option value="baja">Prioridad Baja</option>
          </select>
          <select
            className="select"
            style={{ minHeight: 42 }}
            value={ot.estado}
            onChange={(e) => actualizarOT({ estado: e.target.value })}
          >
            <option value="en_curso">En curso</option>
            <option value="pausada">Pausada</option>
            <option value="finalizada">Finalizada</option>
          </select>
        </div>
      </div>

      {/* Subconjuntos */}
      <div className="row between mt-lg mb">
        <h3 style={{ margin: 0 }}>Subconjuntos</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ tipo: 'nuevoSub' })}>
          ➕ Subconjunto
        </button>
      </div>

      {(ot.subconjuntos || []).length === 0 ? (
        <Empty icon="🧩" title="Sin subconjuntos" hint="Agregá un subconjunto para empezar." />
      ) : (
        ot.subconjuntos.map((sub) => (
          <div key={sub.id} className="card">
            <div className="row between mb">
              <h4 style={{ margin: 0 }}>📦 {sub.nombre}</h4>
              <div className="row gap-sm">
                <button className="btn btn-sm" onClick={() => setModal({ tipo: 'nuevoPlano', sub })}>
                  ➕ Plano
                </button>
                <button className="btn btn-sm btn-ghost danger-text" onClick={() => eliminar('subconjuntos', sub.id, `subconjunto "${sub.nombre}"`)}>
                  🗑
                </button>
              </div>
            </div>

            {(sub.planos || []).length === 0 ? (
              <div className="muted small">Sin planos.</div>
            ) : (
              sub.planos.map((plano) => (
                <div key={plano.id} style={{ borderTop: '1px solid var(--gris-200)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                  <div className="row between">
                    <div>
                      <Link to={`/plano/${plano.qr_token}`} className="bold">📄 Plano {plano.numero_plano}</Link>
                      <div className="xs muted">{plano.descripcion || 'Sin descripción'} · {plano.cantidad_total} pieza(s)</div>
                    </div>
                    <div className="row gap-sm">
                      <button className="btn btn-sm" onClick={() => setModal({ tipo: 'editPlano', plano, sub })}>✎</button>
                      <button className="btn btn-sm" onClick={() => setModal({ tipo: 'addProceso', plano })}>➕ Proceso</button>
                    </div>
                  </div>

                  {/* Procesos del plano */}
                  {(plano.plano_procesos || []).length === 0 ? (
                    <div className="muted xs mt">Sin ruta de procesos.</div>
                  ) : (
                    <div className="mt">
                      {plano.plano_procesos.map((pp) => (
                        <div key={pp.id} className="row between" style={{ padding: '0.4rem 0' }}>
                          <div className="grow">
                            <div className="row gap-sm">
                              <span className="small bold">{pp.proceso.nombre}</span>
                              <Badge color={ESTADOS_PROCESO[pp.estado].color}>{ESTADOS_PROCESO[pp.estado].label}</Badge>
                            </div>
                            <div className="row gap-sm mt" style={{ maxWidth: 220 }}>
                              <Progress value={avanceProceso(pp)} />
                            </div>
                            <div className="xs muted">{pp.cantidad_completada}/{pp.cantidad_requerida} piezas</div>
                          </div>
                          <div className="col gap-sm" style={{ alignItems: 'flex-end' }}>
                            <div className="row gap-sm">
                              <button
                                className="btn btn-sm btn-ghost"
                                title={pp.estado === 'en_espera' ? 'Liberar' : 'Marcar en espera'}
                                onClick={() => setEstadoProceso(pp.id, pp.estado === 'en_espera' ? 'pendiente' : 'en_espera')}
                              >
                                {pp.estado === 'en_espera' ? '▶' : '⏸'}
                              </button>
                              <button className="btn btn-sm" onClick={() => setModal({ tipo: 'editProceso', pp })}>✎</button>
                              <button className="btn btn-sm btn-ghost danger-text" onClick={() => eliminar('plano_procesos', pp.id, `proceso ${pp.proceso.nombre}`)}>🗑</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button className="btn btn-sm btn-ghost danger-text mt" onClick={() => eliminar('planos', plano.id, `plano ${plano.numero_plano}`)}>
                    🗑 Eliminar plano
                  </button>
                </div>
              ))
            )}
          </div>
        ))
      )}

      {/* Modales */}
      {modal?.tipo === 'editOT' && (
        <EditOTModal ot={ot} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />
      )}
      {modal?.tipo === 'nuevoSub' && (
        <NuevoSubModal otId={ot.id} orden={(ot.subconjuntos?.length || 0)} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />
      )}
      {modal?.tipo === 'nuevoPlano' && (
        <PlanoModal sub={modal.sub} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />
      )}
      {modal?.tipo === 'editPlano' && (
        <PlanoModal sub={modal.sub} plano={modal.plano} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />
      )}
      {modal?.tipo === 'addProceso' && (
        <ProcesoModal plano={modal.plano} catalogo={catalogo} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />
      )}
      {modal?.tipo === 'editProceso' && (
        <ProcesoModal pp={modal.pp} catalogo={catalogo} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />
      )}
    </div>
  )
}

function EditOTModal({ ot, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({
    codigo: ot.codigo, producto: ot.producto, cliente: ot.cliente || '',
    fecha_entrega: ot.fecha_entrega || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const guardar = async () => {
    setSaving(true)
    const { error } = await supabase.from('ot').update({
      codigo: f.codigo.trim(), producto: f.producto.trim(),
      cliente: f.cliente.trim() || null, fecha_entrega: f.fecha_entrega || null,
    }).eq('id', ot.id)
    setSaving(false)
    if (error) toast(error.message, 'error')
    else onSaved()
  }
  return (
    <Modal title="Editar OT" onClose={onClose}>
      <div className="field"><label className="label">Código</label><input className="input" value={f.codigo} onChange={set('codigo')} /></div>
      <div className="field"><label className="label">Producto</label><input className="input" value={f.producto} onChange={set('producto')} /></div>
      <div className="field"><label className="label">Cliente</label><input className="input" value={f.cliente} onChange={set('cliente')} /></div>
      <div className="field"><label className="label">Fecha entrega</label><input className="input" type="date" value={f.fecha_entrega} onChange={set('fecha_entrega')} /></div>
      <button className="btn btn-primary btn-block" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : 'Guardar'}</button>
    </Modal>
  )
}

function NuevoSubModal({ otId, orden, onClose, onSaved }) {
  const toast = useToast()
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const guardar = async () => {
    if (!nombre.trim()) return toast('Ingresá el nombre', 'error')
    setSaving(true)
    const { error } = await supabase.from('subconjuntos').insert({ ot_id: otId, nombre: nombre.trim(), orden })
    setSaving(false)
    if (error) toast(error.message, 'error')
    else onSaved()
  }
  return (
    <Modal title="Nuevo subconjunto" onClose={onClose}>
      <div className="field">
        <label className="label">Nombre</label>
        <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cilindros, Tablero eléctrico…" />
      </div>
      <button className="btn btn-primary btn-block" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : 'Agregar'}</button>
    </Modal>
  )
}

function PlanoModal({ sub, plano, onClose, onSaved }) {
  const toast = useToast()
  const editando = !!plano
  const [f, setF] = useState({
    numero_plano: plano?.numero_plano || '',
    descripcion: plano?.descripcion || '',
    cantidad_total: plano?.cantidad_total || 1,
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const guardar = async () => {
    if (!f.numero_plano.trim()) return toast('Ingresá el número de plano', 'error')
    setSaving(true)
    const payload = {
      numero_plano: f.numero_plano.trim(),
      descripcion: f.descripcion.trim() || null,
      cantidad_total: parseInt(f.cantidad_total, 10) || 1,
    }
    const r = editando
      ? await supabase.from('planos').update(payload).eq('id', plano.id)
      : await supabase.from('planos').insert({ ...payload, subconjunto_id: sub.id })
    const error = r.error
    setSaving(false)
    if (error) toast(error.message, 'error')
    else onSaved()
  }
  return (
    <Modal title={editando ? 'Editar plano' : 'Nuevo plano'} onClose={onClose}>
      <div className="field"><label className="label">Número de plano</label><input className="input" value={f.numero_plano} onChange={set('numero_plano')} placeholder="00001" /></div>
      <div className="field"><label className="label">Descripción</label><input className="input" value={f.descripcion} onChange={set('descripcion')} /></div>
      <div className="field"><label className="label">Cantidad de piezas</label><input className="input" inputMode="numeric" value={f.cantidad_total} onChange={set('cantidad_total')} /></div>
      <button className="btn btn-primary btn-block" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : editando ? 'Guardar' : 'Agregar plano'}</button>
    </Modal>
  )
}

function ProcesoModal({ plano, pp, catalogo, onClose, onSaved }) {
  const toast = useToast()
  const editando = !!pp
  const [catId, setCatId] = useState(pp?.proceso?.id || catalogo[0]?.id || '')
  const [cantidad, setCantidad] = useState(pp?.cantidad_requerida ?? plano?.cantidad_total ?? 1)
  const [prioridad, setPrioridad] = useState(pp?.prioridad || 'media')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    if (!catId) return toast('Elegí un proceso', 'error')
    setSaving(true)
    let error
    if (editando) {
      const r = await supabase
        .from('plano_procesos')
        .update({
          proceso_catalogo_id: catId,
          cantidad_requerida: parseInt(cantidad, 10) || 1,
          prioridad,
        })
        .eq('id', pp.id)
      error = r.error
      if (!error) await supabase.rpc('set_estado_proceso', { p_pp_id: pp.id, p_estado: 'pendiente' })
    } else {
      const orden = plano.plano_procesos?.length || 0
      const r = await supabase.from('plano_procesos').insert({
        plano_id: plano.id,
        proceso_catalogo_id: catId,
        cantidad_requerida: parseInt(cantidad, 10) || 1,
        prioridad,
        orden,
      })
      error = r.error
    }
    setSaving(false)
    if (error) toast(error.message, 'error')
    else onSaved()
  }

  return (
    <Modal title={editando ? 'Editar proceso' : 'Agregar proceso a la ruta'} onClose={onClose}>
      <div className="field">
        <label className="label">Proceso</label>
        <select className="select" value={catId} onChange={(e) => setCatId(e.target.value)}>
          {catalogo.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label">Cantidad requerida</label>
        <input className="input" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="field">
        <label className="label">Prioridad</label>
        <select className="select" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
      </div>
      <button className="btn btn-primary btn-block" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : 'Guardar'}</button>
    </Modal>
  )
}
