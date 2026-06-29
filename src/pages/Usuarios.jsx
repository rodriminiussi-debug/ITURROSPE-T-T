import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ROLES, fmtFechaCorta } from '../lib/helpers'
import { Loading, Badge, Modal, Empty, useToast } from '../components/ui'

export default function Usuarios() {
  const navigate = useNavigate()
  const toast = useToast()
  const [usuarios, setUsuarios] = useState(null)
  const [sel, setSel] = useState(null)

  const cargar = () =>
    supabase
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setUsuarios(data || []))

  useEffect(() => {
    cargar()
  }, [])

  if (usuarios === null) return <Loading />

  const pendientes = usuarios.filter((u) => u.estado === 'pendiente')
  const otros = usuarios.filter((u) => u.estado !== 'pendiente')

  const estadoColor = (e) => (e === 'activo' ? 'hecho' : e === 'pendiente' ? 'en_espera' : 'retrabajo')

  const Fila = (u) => (
    <div key={u.id} className="card" onClick={() => setSel(u)} style={{ cursor: 'pointer' }}>
      <div className="row between">
        <div>
          <div className="bold">{u.nombre}</div>
          <div className="muted small">@{u.usuario}{u.sector ? ` · ${u.sector}` : ''}</div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end' }}>
          <Badge color={estadoColor(u.estado)}>{u.estado}</Badge>
          <span className="xs muted mt">{u.rol ? ROLES[u.rol] : 'Sin rol'}</span>
        </div>
      </div>
      <div className="xs muted mt">Alta: {fmtFechaCorta(u.created_at)}</div>
    </div>
  )

  return (
    <div>
      <button className="btn btn-ghost btn-sm mb" onClick={() => navigate('/gestion')}>← Gestión</button>
      <h2 className="page-title">👥 Usuarios</h2>

      <div className="section-title">Pendientes de aprobación {pendientes.length > 0 && <Badge color="en_espera">{pendientes.length}</Badge>}</div>
      {pendientes.length === 0 ? (
        <Empty icon="✅" title="No hay usuarios pendientes" />
      ) : (
        pendientes.map(Fila)
      )}

      <div className="section-title">Todos los usuarios</div>
      {otros.length === 0 ? <Empty icon="👤" title="Sin usuarios activos" /> : otros.map(Fila)}

      {sel && (
        <GestionUsuarioModal
          usuario={sel}
          onClose={() => setSel(null)}
          onSaved={() => {
            setSel(null)
            cargar()
            toast('Usuario actualizado', 'success')
          }}
        />
      )}
    </div>
  )
}

function GestionUsuarioModal({ usuario, onClose, onSaved }) {
  const toast = useToast()
  const [rol, setRol] = useState(usuario.rol || 'operario')
  const [sector, setSector] = useState(usuario.sector || '')
  const [estado, setEstado] = useState(usuario.estado === 'pendiente' ? 'activo' : usuario.estado)
  const [saving, setSaving] = useState(false)

  const aprobar = async () => {
    setSaving(true)
    const { error } = await supabase.rpc('aprobar_usuario', {
      p_usuario_id: usuario.id,
      p_rol: rol,
      p_sector: sector.trim() || null,
    })
    setSaving(false)
    if (error) toast(error.message, 'error')
    else onSaved()
  }

  const actualizar = async () => {
    setSaving(true)
    const { error } = await supabase.rpc('actualizar_usuario', {
      p_usuario_id: usuario.id,
      p_rol: rol,
      p_estado: estado,
      p_sector: sector.trim() || null,
    })
    setSaving(false)
    if (error) toast(error.message, 'error')
    else onSaved()
  }

  const esPendiente = usuario.estado === 'pendiente'

  return (
    <Modal title={usuario.nombre} onClose={onClose}>
      <div className="muted small mb">@{usuario.usuario}</div>

      <div className="field">
        <label className="label">Rol</label>
        <select className="select" value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="operario">Operario</option>
          <option value="calidad">Calidad</option>
          <option value="jefe">Jefe de planta</option>
        </select>
      </div>
      <div className="field">
        <label className="label">Sector (opcional)</label>
        <input className="input" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Soldadura, Mecanizado…" />
      </div>

      {!esPendiente && (
        <div className="field">
          <label className="label">Estado</label>
          <select className="select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
      )}

      {esPendiente ? (
        <button className="btn btn-primary btn-block btn-lg" disabled={saving} onClick={aprobar}>
          {saving ? 'Aprobando…' : '✓ Aprobar y activar'}
        </button>
      ) : (
        <button className="btn btn-primary btn-block" disabled={saving} onClick={actualizar}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      )}
    </Modal>
  )
}
