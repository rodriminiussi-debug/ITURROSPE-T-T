import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getOTsConAvance } from '../lib/queries'
import { avancePlano, pct, PRIORIDADES, estadoEntrega, fmtFechaCorta } from '../lib/helpers'
import { Loading, Badge, Progress, Empty } from '../components/ui'

function avanceOT(ot) {
  const procesos = (ot.subconjuntos || []).flatMap((s) =>
    (s.planos || []).flatMap((p) => p.plano_procesos || [])
  )
  return avancePlano(procesos)
}

export default function Home() {
  const { profile, esJefe, esCalidad } = useAuth()
  const navigate = useNavigate()
  const [ots, setOts] = useState(null)

  useEffect(() => {
    getOTsConAvance()
      .then(setOts)
      .catch(() => setOts([]))
  }, [])

  const activas = (ots || []).filter((o) => o.estado !== 'finalizada')

  return (
    <div>
      <div className="mb-lg">
        <h2 style={{ marginBottom: 2 }}>Hola, {profile?.nombre?.split(' ')[0]} 👋</h2>
        <p className="muted small">Escaneá el QR de un plano para registrar el avance.</p>
      </div>

      <button
        className="btn btn-primary btn-block"
        style={{ minHeight: 88, fontSize: '1.3rem', flexDirection: 'column', gap: 4 }}
        onClick={() => navigate('/escanear')}
      >
        <span style={{ fontSize: '2rem' }}>📷</span>
        Escanear QR de plano
      </button>

      {(esJefe || esCalidad) && (
        <div className="row gap mt">
          <Link to="/dashboard" className="btn btn-dark grow">
            📊 Tablero
          </Link>
          {esJefe && (
            <Link to="/gestion" className="btn btn-dark grow">
              🗂️ Gestión
            </Link>
          )}
        </div>
      )}

      <div className="section-title">Órdenes de trabajo activas</div>

      {ots === null ? (
        <Loading />
      ) : activas.length === 0 ? (
        <Empty icon="🏭" title="No hay OTs activas" hint={esJefe ? 'Creá o importá una OT desde Gestión.' : ''} />
      ) : (
        activas.map((ot) => {
          const av = avanceOT(ot)
          const ent = estadoEntrega(ot, av)
          const nPlanos = (ot.subconjuntos || []).reduce((a, s) => a + (s.planos?.length || 0), 0)
          return (
            <div key={ot.id} className="card" onClick={() => esJefe && navigate(`/gestion/ot/${ot.id}`)} style={{ cursor: esJefe ? 'pointer' : 'default' }}>
              <div className="row between mb">
                <div>
                  <div className="bold">{ot.codigo}</div>
                  <div className="muted small">{ot.producto}</div>
                </div>
                <div className="col" style={{ alignItems: 'flex-end' }}>
                  <Badge color={PRIORIDADES[ot.prioridad]?.color}>{PRIORIDADES[ot.prioridad]?.label}</Badge>
                  {ent === 'atrasada' && <span className="xs danger-text bold mt">⚠ Atrasada</span>}
                  {ent === 'riesgo' && <span className="xs bold mt" style={{ color: 'var(--naranja)' }}>⏰ En riesgo</span>}
                </div>
              </div>
              <Progress value={av} />
              <div className="row between mt" style={{ fontSize: '0.8rem' }}>
                <span className="muted">{nPlanos} plano(s)</span>
                <span className="bold">{pct(av)}</span>
              </div>
              {ot.fecha_entrega && (
                <div className="xs muted mt">Entrega: {fmtFechaCorta(ot.fecha_entrega)}</div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
