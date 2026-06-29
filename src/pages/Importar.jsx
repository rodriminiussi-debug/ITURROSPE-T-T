import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { getCatalogo } from '../lib/queries'
import { Modal, Empty, useToast } from '../components/ui'

const COLUMNAS = [
  'OT_codigo', 'Producto', 'Cliente', 'Fecha_entrega', 'Prioridad',
  'Subconjunto', 'Plano_numero', 'Plano_descripcion', 'Cantidad', 'Procesos',
]

const PRIORIDAD_MAP = { alta: 'alta', media: 'media', baja: 'baja' }

export default function Importar() {
  const navigate = useNavigate()
  const toast = useToast()
  const [filas, setFilas] = useState(null)
  const [errores, setErrores] = useState([])
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const descargarPlantilla = () => {
    const ejemplo = [
      {
        OT_codigo: 'OT-1234', Producto: 'Bomba centrífuga', Cliente: 'ACME SA',
        Fecha_entrega: '2026-08-15', Prioridad: 'Alta', Subconjunto: 'Cuerpo',
        Plano_numero: '00001', Plano_descripcion: 'Carcasa principal', Cantidad: 4,
        Procesos: 'Corte,Mecanizado,Soldadura,Pintura',
      },
      {
        OT_codigo: 'OT-1234', Producto: 'Bomba centrífuga', Cliente: 'ACME SA',
        Fecha_entrega: '2026-08-15', Prioridad: 'Alta', Subconjunto: 'Cuerpo',
        Plano_numero: '00002', Plano_descripcion: 'Tapa', Cantidad: 8,
        Procesos: 'Corte,Plegado,Pintura',
      },
    ]
    const ws = XLSX.utils.json_to_sheet(ejemplo, { header: COLUMNAS })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Estructura')
    XLSX.writeFile(wb, 'plantilla_iturrospe.xlsx')
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResultado(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' })

      const errs = []
      const parsed = json.map((r, i) => {
        const fila = {
          OT_codigo: String(r.OT_codigo || '').trim(),
          Producto: String(r.Producto || '').trim(),
          Cliente: String(r.Cliente || '').trim(),
          Fecha_entrega: r.Fecha_entrega ? String(r.Fecha_entrega).trim() : '',
          Prioridad: PRIORIDAD_MAP[String(r.Prioridad || '').trim().toLowerCase()] || 'media',
          Subconjunto: String(r.Subconjunto || '').trim(),
          Plano_numero: String(r.Plano_numero || '').trim(),
          Plano_descripcion: String(r.Plano_descripcion || '').trim(),
          Cantidad: parseInt(r.Cantidad, 10) || 1,
          Procesos: String(r.Procesos || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }
        if (!fila.OT_codigo) errs.push(`Fila ${i + 2}: falta OT_codigo`)
        if (!fila.Producto) errs.push(`Fila ${i + 2}: falta Producto`)
        if (!fila.Subconjunto) errs.push(`Fila ${i + 2}: falta Subconjunto`)
        if (!fila.Plano_numero) errs.push(`Fila ${i + 2}: falta Plano_numero`)
        return fila
      })
      setFilas(parsed)
      setErrores(errs)
    } catch (err) {
      toast('No se pudo leer el archivo: ' + err.message, 'error')
    }
  }

  const confirmar = async () => {
    if (!filas?.length) return
    setImportando(true)
    const res = { ots: 0, subconjuntos: 0, planos: 0, procesos: 0, errores: [] }
    try {
      const catalogo = await getCatalogo()
      const catMap = {}
      catalogo.forEach((c) => (catMap[c.nombre.toLowerCase()] = c.id))

      // Caches para deduplicar
      const otCache = {} // codigo -> id
      const subCache = {} // otId|nombre -> id

      const getOT = async (fila) => {
        if (otCache[fila.OT_codigo]) return otCache[fila.OT_codigo]
        // ¿existe ya?
        const { data: ex } = await supabase.from('ot').select('id').eq('codigo', fila.OT_codigo).maybeSingle()
        if (ex) {
          otCache[fila.OT_codigo] = ex.id
          return ex.id
        }
        const { data, error } = await supabase.from('ot').insert({
          codigo: fila.OT_codigo,
          producto: fila.Producto,
          cliente: fila.Cliente || null,
          fecha_entrega: fila.Fecha_entrega || null,
          prioridad: fila.Prioridad,
        }).select('id').single()
        if (error) throw error
        otCache[fila.OT_codigo] = data.id
        res.ots++
        return data.id
      }

      const getSub = async (otId, nombre) => {
        const key = `${otId}|${nombre.toLowerCase()}`
        if (subCache[key]) return subCache[key]
        const { data: ex } = await supabase.from('subconjuntos').select('id').eq('ot_id', otId).ilike('nombre', nombre).maybeSingle()
        if (ex) {
          subCache[key] = ex.id
          return ex.id
        }
        const { data, error } = await supabase.from('subconjuntos').insert({
          ot_id: otId, nombre, orden: Object.keys(subCache).filter((k) => k.startsWith(otId)).length,
        }).select('id').single()
        if (error) throw error
        subCache[key] = data.id
        res.subconjuntos++
        return data.id
      }

      for (const fila of filas) {
        if (!fila.OT_codigo || !fila.Subconjunto || !fila.Plano_numero) continue
        const otId = await getOT(fila)
        const subId = await getSub(otId, fila.Subconjunto)

        const { data: plano, error: ep } = await supabase.from('planos').insert({
          subconjunto_id: subId,
          numero_plano: fila.Plano_numero,
          descripcion: fila.Plano_descripcion || null,
          cantidad_total: fila.Cantidad,
        }).select('id').single()
        if (ep) throw ep
        res.planos++

        // Procesos
        const procesosIns = fila.Procesos
          .map((nombre, idx) => {
            const catId = catMap[nombre.toLowerCase()]
            if (!catId) {
              res.errores.push(`Proceso desconocido "${nombre}" en plano ${fila.Plano_numero}`)
              return null
            }
            return {
              plano_id: plano.id,
              proceso_catalogo_id: catId,
              cantidad_requerida: fila.Cantidad,
              orden: idx,
            }
          })
          .filter(Boolean)
        if (procesosIns.length) {
          const { error: epp } = await supabase.from('plano_procesos').insert(procesosIns)
          if (epp) throw epp
          res.procesos += procesosIns.length
        }
      }
      setResultado(res)
      toast('Importación completada ✓', 'success')
    } catch (err) {
      res.errores.push(err.message)
      setResultado(res)
      toast('Error en la importación: ' + err.message, 'error')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm mb" onClick={() => navigate('/gestion')}>← Gestión</button>
      <h2 className="page-title">📥 Importar estructura</h2>

      <div className="card">
        <p className="muted small">
          Subí un Excel con una fila por plano. Columnas: <b>{COLUMNAS.join(', ')}</b>.
          Las OTs y subconjuntos repetidos se deduplican automáticamente.
        </p>
        <button className="btn btn-block mb" onClick={descargarPlantilla}>
          ⬇ Descargar plantilla
        </button>
        <label className="btn btn-primary btn-block" style={{ cursor: 'pointer' }}>
          📂 Elegir archivo Excel
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: 'none' }} />
        </label>
      </div>

      {errores.length > 0 && (
        <div className="card" style={{ background: 'var(--rojo-claro)' }}>
          <div className="bold danger-text mb">⚠ Errores en el archivo:</div>
          {errores.map((e, i) => (
            <div key={i} className="small danger-text">• {e}</div>
          ))}
        </div>
      )}

      {filas && (
        <>
          <div className="section-title">Vista previa ({filas.length} fila(s))</div>
          {filas.length === 0 ? (
            <Empty icon="📄" title="Archivo vacío" />
          ) : (
            <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>OT</th><th>Subconj.</th><th>Plano</th><th>Cant.</th><th>Procesos</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(0, 50).map((f, i) => (
                    <tr key={i}>
                      <td>{f.OT_codigo}<div className="xs muted">{f.Producto}</div></td>
                      <td>{f.Subconjunto}</td>
                      <td>{f.Plano_numero}</td>
                      <td>{f.Cantidad}</td>
                      <td className="xs">{f.Procesos.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filas.length > 50 && <div className="muted small center" style={{ padding: '0.5rem' }}>… y {filas.length - 50} más</div>}
            </div>
          )}

          {!resultado && (
            <button
              className="btn btn-primary btn-block btn-lg mt"
              disabled={importando || errores.length > 0 || filas.length === 0}
              onClick={confirmar}
            >
              {importando ? 'Importando…' : `✓ Confirmar e importar ${filas.length} plano(s)`}
            </button>
          )}
        </>
      )}

      {resultado && (
        <Modal title="Importación completada" onClose={() => { setResultado(null); setFilas(null); navigate('/gestion') }}>
          <div className="col gap-sm">
            <div>✅ OTs creadas: <b>{resultado.ots}</b></div>
            <div>📦 Subconjuntos: <b>{resultado.subconjuntos}</b></div>
            <div>📄 Planos: <b>{resultado.planos}</b></div>
            <div>🔧 Procesos: <b>{resultado.procesos}</b></div>
          </div>
          {resultado.errores.length > 0 && (
            <div className="mt">
              <div className="bold danger-text">Advertencias:</div>
              {resultado.errores.map((e, i) => <div key={i} className="small danger-text">• {e}</div>)}
            </div>
          )}
          <button className="btn btn-primary btn-block mt-lg" onClick={() => navigate('/gestion')}>Ir a Gestión</button>
        </Modal>
      )}
    </div>
  )
}
