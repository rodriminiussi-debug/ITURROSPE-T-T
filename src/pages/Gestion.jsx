import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getOTsConAvance } from '../lib/queries'
import { avancePlano, pct, PRIORIDADES, fmtFechaCorta, estadoEntrega } from '../lib/helpers'
import { Loading, Badge, Progress, Modal, Empty, useToast } from '../components/ui'

function avanceOT(ot) {
  const procesos = (ot.subconjuntos || []).flatMap((s) =>
    (s.planos || []).flatMap((p) => p.plano_procesos || [])
  )
  return avancePlano(procesos)
}

export default function Gestion() {
  const navigate = useNavigate()
  const toast = useToast()
  const [ots, setOts] = useState(null)
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [orden, setOrden] = useState('reciente')
  const [filtro, setFiltro] = useState('todas')

  const cargar = () => getOTsConAvance().then(setOts).catch(() => setOts([]))
  useEffect(() => {
    cargar()
  }, [])

  let lista = [...(ots || [])]
  if (filtro === 'activas') lista = lista.filter((o) => o.estado !== 'finalizada')
  if (filtro === 'finalizadas') lista = lista.filter((o) => o.estado === 'finalizada')
  if (orden === 'prioridad') {
    const peso = { alta: 0, media: 1, baja: 2 }
    lista.sort((a, b) => peso[a.prioridad] - peso[b.prioridad])
  } else if (orden === 'entrega') {
    lista.sort((a, b) => new Date(a.fecha_entrega || '2999') - new Date(b.fecha_entrega || '2999'))
  }

  return (
    <div>
      <h2 className="page-title">🗂️ Gestión</h2>

      {/* Accesos */}
      <div className="kpi-grid mb">
        <Link to="/gestion/importar" className="kpi center" style={{ color: 'inherit' }}>
          <div style={{ fontSize: '1.8rem' }}>📥</div>
          <div className="l bold">Importar Excel</div>
        </Link>
        <Link to="/gestion/etiquetas" className="kpi center" style={{ color: 'inherit' }}>
          <div style={{ fontSize: '1.8rem' }}>🏷️</div>
          <div className="l bold">QR / Etiquetas</div>
        </Link>
        <Link to="/gestion/usuarios" className="kpi center" style={{ color: 'inherit' }}>
          <div style={{ fontSize: '1.8rem' }}>👥</div>
          <div className="l bold">Usuarios</div>
        </Link>
        <button className="kpi center" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setNuevaOpen(true)}>
          <div style={{ fontSize: '1.8rem' }}>➕</div>
          <div className="l bold">Nueva OT</div>
        </button>
      </div>

      <div className="row gap mb">
        <select className="select" style={{ minHeight: 42 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todas">Todas</option>
          <option value="activas">Activas</option>
          <option value="finalizadas">Finalizadas</option>
        </select>
        <select className="select" style={{ minHeight: 42 }} value={orden} onChange={(e) => setOrden(e.target.value)}>
          <option value="reciente">Más recientes</option>
          <option value="prioridad">Por prioridad</option>
          <option value="entrega">Por entrega</option>
        </select>
      </div>

      {ots === null ? (
        <Loading />
      ) : lista.length === 0 ? (
        <Empty icon="🏭" title="Sin órdenes de trabajo" hint="Creá una OT o importá desde Excel." />
      ) : (
        lista.map((ot) => {
          const av = avanceOT(ot)
          const ent = estadoEntrega(ot, av)
          const nPlanos = (ot.subconjuntos || []).reduce((a, s) => a + (s.planos?.length || 0), 0)
          return (
            <Link key={ot.id} to={`/gestion/ot/${ot.id}`} className="card" style={{ display: 'block', color: 'inherit' }}>
              <div className="row between mb">
                <div>
                  <span className="bold">{ot.codigo}</span>{' '}
                  <span className="muted small">— {ot.producto}</span>
                </div>
                <div className="row gap-sm">
                  <Badge color={PRIORIDADES[ot.prioridad]?.color}>{PRIORIDADES[ot.prioridad]?.label}</Badge>
                  {ot.estado === 'finalizada' && <Badge color="hecho">Finalizada</Badge>}
                  {ent === 'atrasada' && ot.estado !== 'finalizada' && <Badge color="retrabajo">Atrasada</Badge>}
                </div>
              </div>
              <Progress value={av} />
              <div className="row between mt small">
                <span className="muted">{nPlanos} plano(s){ot.cliente ? ` · ${ot.cliente}` : ''}</span>
                <span className="bold">{pct(av)}</span>
              </div>
              {ot.fecha_entrega && <div className="xs muted mt">Entrega: {fmtFechaCorta(ot.fecha_entrega)}</div>}
            </Link>
          )
        })
      )}

      {nuevaOpen && (
        <NuevaOTModal
          onClose={() => setNuevaOpen(false)}
          onSaved={(id) => {
            setNuevaOpen(false)
            toast('OT creada ✓', 'success')
            navigate(`/gestion/ot/${id}`)
          }}
        />
      )}
    </div>
  )
}

function NuevaOTModal({ onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({
    codigo: '', producto: '', cliente: '', fecha_entrega: '', prioridad: 'media',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const guardar = async () => {
    if (!f.codigo.trim() || !f.producto.trim()) return toast('Código y producto son obligatorios', 'error')
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('ot')
        .insert({
          codigo: f.codigo.trim(),
          producto: f.producto.trim(),
          cliente: f.cliente.trim() || null,
          fecha_entrega: f.fecha_entrega || null,
          prioridad: f.prioridad,
        })
        .select('id')
        .single()
      if (error) throw error
      onSaved(data.id)
    } catch (e) {
      toast(e.message?.includes('duplicate') ? 'Ya existe una OT con ese código' : e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Nueva OT" onClose={onClose}>
      <div className="field">
        <label className="label">Código *</label>
        <input className="input" value={f.codigo} onChange={set('codigo')} placeholder="OT-1234" />
      </div>
      <div className="field">
        <label className="label">Producto *</label>
        <input className="input" value={f.producto} onChange={set('producto')} />
      </div>
      <div className="field">
        <label className="label">Cliente</label>
        <input className="input" value={f.cliente} onChange={set('cliente')} />
      </div>
      <div className="row gap">
        <div className="field grow">
          <label className="label">Fecha entrega</label>
          <input className="input" type="date" value={f.fecha_entrega} onChange={set('fecha_entrega')} />
        </div>
        <div className="field grow">
          <label className="label">Prioridad</label>
          <select className="select" value={f.prioridad} onChange={set('prioridad')}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
      </div>
      <button className="btn btn-primary btn-block" disabled={saving} onClick={guardar}>
        {saving ? 'Creando…' : 'Crear OT'}
      </button>
    </Modal>
  )
}
