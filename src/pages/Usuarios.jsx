import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ROLES, fmtFechaCorta } from '../lib/helpers'
import { Loading, Badge, Modal, Empty, useToast } from '../components/ui'

export default function Usuarios() {
  const navigate = useNavigate()
  const toast = useToast()
  const [usuarios, setUsuarios] = useState(null)
  const [sel, setSel] = useState(null)
  const [nuevoOpen, setNuevoOpen] = useState(false)

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

      <button className="btn btn-primary btn-block mb-lg" onClick={() => setNuevoOpen(true)}>
        ➕ Nuevo usuario
      </button>

      <div className="section-title">Pendientes de aprobación {pendientes.length > 0 && <Badge color="en_espera">{pendientes.length}</Badge>}</div>
      {pendientes.length === 0 ? (
        <Empty icon="✅" title="No hay usuarios pendientes" />
      ) : (
        pendientes.map(Fila)
      )}

      <div className="section-title">Todos los usuarios</div>
      {otros.length === 0 ? <Empty icon="👤" title="Sin usuarios activos" /> : otros.map(Fila)}

      {nuevoOpen && (
        <NuevoUsuarioModal
          onClose={() => setNuevoOpen(false)}
          onSaved={() => {
            setNuevoOpen(false)
            cargar()
            toast('Usuario creado ✓', 'success')
          }}
        />
      )}

      {sel && (
        <GestionUsuarioModal
          usuario={sel}
          onClose={() => setSel(null)}
          onSaved={(msg) => {
            setSel(null)
            cargar()
            toast(msg || 'Usuario actualizado', 'success')
          }}
        />
      )}
    </div>
  )
}

function NuevoUsuarioModal({ onClose, onSaved }) {
  const toast = useToast()
  const { crearUsuario } = useAuth()
  const [f, setF] = useState({ nombre: '', usuario: '', pin: '', pin2: '', rol: 'operario', sector: '' })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const guardar = async () => {
    if (!f.nombre.trim()) return toast('Ingresá el nombre', 'error')
    if (!/^[a-z0-9._-]{3,}$/.test(f.usuario.trim().toLowerCase()))
      return toast('Usuario inválido (mín. 3, sin espacios)', 'error')
    if (!/^\d{6}$/.test(f.pin)) return toast('El PIN debe tener 6 dígitos', 'error')
    if (f.pin !== f.pin2) return toast('Los PIN no coinciden', 'error')
    setSaving(true)
    try {
      await crearUsuario({
        usuario: f.usuario.trim().toLowerCase(),
        nombre: f.nombre.trim(),
        pin: f.pin,
        rol: f.rol,
        sector: f.sector.trim(),
      })
      onSaved()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Nuevo usuario" onClose={onClose}>
      <p className="muted small mb">Se crea sin email, con usuario y PIN. Queda autorizado y activo.</p>

      <div className="field">
        <label className="label">Nombre</label>
        <input className="input" value={f.nombre} onChange={set('nombre')} placeholder="Juan Pérez" />
      </div>
      <div className="field">
        <label className="label">Usuario</label>
        <input className="input" value={f.usuario} onChange={set('usuario')} placeholder="jperez" autoCapitalize="none" autoCorrect="off" />
      </div>
      <div className="row gap">
        <div className="field grow">
          <label className="label">PIN (6 dígitos)</label>
          <input className="input" value={f.pin} onChange={set('pin')} inputMode="numeric" maxLength={6} placeholder="••••••" />
        </div>
        <div className="field grow">
          <label className="label">Repetir PIN</label>
          <input className="input" value={f.pin2} onChange={set('pin2')} inputMode="numeric" maxLength={6} placeholder="••••••" />
        </div>
      </div>
      <div className="field">
        <label className="label">Rol</label>
        <select className="select" value={f.rol} onChange={set('rol')}>
          <option value="operario">Operario</option>
          <option value="calidad">Calidad</option>
          <option value="jefe">Jefe de planta</option>
        </select>
      </div>
      <div className="field">
        <label className="label">Sector (opcional)</label>
        <input className="input" value={f.sector} onChange={set('sector')} placeholder="Soldadura, Mecanizado…" />
      </div>

      <button className="btn btn-primary btn-block btn-lg" disabled={saving} onClick={guardar}>
        {saving ? 'Creando…' : 'Crear usuario'}
      </button>
    </Modal>
  )
}

function GestionUsuarioModal({ usuario, onClose, onSaved }) {
  const toast = useToast()
  const { profile, eliminarUsuario } = useAuth()
  const [rol, setRol] = useState(usuario.rol || 'operario')
  const [sector, setSector] = useState(usuario.sector || '')
  const [estado, setEstado] = useState(usuario.estado === 'pendiente' ? 'activo' : usuario.estado)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const esYoMismo = profile?.id === usuario.id

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

  if (confirmDel) {
    return (
      <EliminarUsuarioModal
        usuario={usuario}
        onClose={() => setConfirmDel(false)}
        onDeleted={() => onSaved('Usuario eliminado')}
        eliminarUsuario={eliminarUsuario}
      />
    )
  }

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

      {!esYoMismo && (
        <button className="btn btn-danger btn-block mt" onClick={() => setConfirmDel(true)}>
          🗑 Eliminar usuario
        </button>
      )}
    </Modal>
  )
}

// Confirmación con clave de seguridad: el jefe reingresa su PROPIO PIN.
function EliminarUsuarioModal({ usuario, onClose, onDeleted, eliminarUsuario }) {
  const toast = useToast()
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)

  const eliminar = async () => {
    if (!/^\d{6}$/.test(pin)) return toast('Ingresá tu PIN de seguridad (6 dígitos)', 'error')
    setSaving(true)
    try {
      await eliminarUsuario(usuario.id, pin)
      onDeleted()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Eliminar usuario" onClose={onClose}>
      <p className="mb">
        Vas a eliminar definitivamente a <span className="bold">{usuario.nombre}</span>{' '}
        <span className="muted">(@{usuario.usuario})</span>. Esta acción no se puede deshacer.
      </p>
      <p className="muted small mb-lg">
        Para confirmar, ingresá <span className="bold">tu PIN de jefe</span> como clave de seguridad.
      </p>

      <div className="field">
        <label className="label">Tu PIN de seguridad</label>
        <input
          className="input"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          maxLength={6}
          placeholder="••••••"
          autoFocus
        />
      </div>

      <button className="btn btn-danger btn-block btn-lg" disabled={saving} onClick={eliminar}>
        {saving ? 'Eliminando…' : 'Eliminar definitivamente'}
      </button>
      <button className="btn btn-ghost btn-block mt" disabled={saving} onClick={onClose}>
        Cancelar
      </button>
    </Modal>
  )
}
