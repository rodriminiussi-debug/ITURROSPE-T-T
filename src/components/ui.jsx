import { createContext, useContext, useState, useCallback, useEffect } from 'react'

// ---------------- Toast ----------------
const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const show = useCallback((msg, type = 'default') => {
    setToast({ msg, type })
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  return ctx || (() => {})
}

// ---------------- Spinner ----------------
export function Spinner() {
  return <div className="spinner" aria-label="Cargando" />
}

export function Loading({ text = 'Cargando…' }) {
  return (
    <div className="center" style={{ padding: '2rem 0' }}>
      <Spinner />
      <div className="muted small">{text}</div>
    </div>
  )
}

// ---------------- Modal ----------------
export function Modal({ title, children, onClose, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between mb">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="row gap mt-lg">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------- Badge ----------------
export function Badge({ children, color = '' }) {
  return <span className={`badge ${color}`}>{children}</span>
}

// ---------------- Progress ----------------
export function Progress({ value }) {
  const w = Math.round(Math.min(1, Math.max(0, value || 0)) * 100)
  return (
    <div className="progress">
      <span style={{ width: `${w}%` }} />
    </div>
  )
}

// ---------------- Empty ----------------
export function Empty({ icon = '📭', title, hint }) {
  return (
    <div className="center muted" style={{ padding: '2.5rem 1rem' }}>
      <div style={{ fontSize: '2.5rem' }}>{icon}</div>
      <div className="bold" style={{ color: 'var(--gris-700)', marginTop: '0.5rem' }}>
        {title}
      </div>
      {hint && <div className="small mt">{hint}</div>}
    </div>
  )
}
