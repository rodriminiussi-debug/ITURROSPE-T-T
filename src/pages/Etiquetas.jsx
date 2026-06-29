import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { planoUrl } from '../lib/helpers'
import { Loading, Empty, useToast } from '../components/ui'
import Logo from '../components/Logo'

export default function Etiquetas() {
  const navigate = useNavigate()
  const toast = useToast()
  const [ots, setOts] = useState(null)
  const [otSel, setOtSel] = useState('')
  const [planos, setPlanos] = useState([])
  const [qrs, setQrs] = useState({})
  const [cargandoPlanos, setCargandoPlanos] = useState(false)

  useEffect(() => {
    supabase
      .from('ot')
      .select('id, codigo, producto')
      .order('created_at', { ascending: false })
      .then(({ data }) => setOts(data || []))
  }, [])

  useEffect(() => {
    if (!otSel) {
      setPlanos([])
      return
    }
    setCargandoPlanos(true)
    supabase
      .from('planos')
      .select(
        `id, numero_plano, descripcion, cantidad_total, qr_token,
         subconjunto:subconjuntos!inner(nombre, ot:ot!inner(id, codigo, producto))`
      )
      .eq('subconjunto.ot_id', otSel)
      .then(async ({ data, error }) => {
        if (error) {
          toast(error.message, 'error')
          setPlanos([])
        } else {
          const lista = data || []
          setPlanos(lista)
          // Generar QRs
          const map = {}
          for (const p of lista) {
            map[p.id] = await QRCode.toDataURL(planoUrl(p.qr_token), {
              margin: 1,
              width: 240,
              errorCorrectionLevel: 'M',
            })
          }
          setQrs(map)
        }
        setCargandoPlanos(false)
      })
  }, [otSel, toast])

  if (ots === null) return <Loading />

  const otInfo = ots.find((o) => o.id === otSel)

  return (
    <div>
      <div className="no-print">
        <button className="btn btn-ghost btn-sm mb" onClick={() => navigate('/gestion')}>← Gestión</button>
        <h2 className="page-title">🏷️ QR / Etiquetas</h2>

        <div className="card">
          <label className="label">Seleccioná una OT</label>
          <select className="select" value={otSel} onChange={(e) => setOtSel(e.target.value)}>
            <option value="">— Elegir OT —</option>
            {ots.map((o) => (
              <option key={o.id} value={o.id}>{o.codigo} — {o.producto}</option>
            ))}
          </select>

          {planos.length > 0 && (
            <button className="btn btn-primary btn-block mt" onClick={() => window.print()}>
              🖨️ Imprimir / Guardar PDF
            </button>
          )}
          <p className="xs muted mt">
            Tip: en el diálogo de impresión elegí “Guardar como PDF” para exportar. Pegá cada
            etiqueta en su plano físico.
          </p>
        </div>
      </div>

      {cargandoPlanos ? (
        <Loading text="Generando QR…" />
      ) : otSel && planos.length === 0 ? (
        <Empty icon="📄" title="La OT no tiene planos" />
      ) : (
        otSel && (
          <div>
            <div className="row gap-sm mb no-print">
              <Logo size={24} />
              <span className="bold">Etiquetas — {otInfo?.codigo}</span>
            </div>
            <div className="label-grid">
              {planos.map((p) => (
                <div key={p.id} className="etiqueta">
                  {qrs[p.id] && <img src={qrs[p.id]} alt={`QR ${p.numero_plano}`} />}
                  <div className="info">
                    <div className="np">Plano {p.numero_plano}</div>
                    <div><b>{p.subconjunto.ot.codigo}</b> · {p.subconjunto.ot.producto}</div>
                    <div>Subconj.: {p.subconjunto.nombre}</div>
                    <div>Cant.: {p.cantidad_total}</div>
                    {p.descripcion && <div style={{ color: '#555' }}>{p.descripcion}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
