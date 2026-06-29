import Logo from './Logo'

export default function SetupNotice() {
  return (
    <div className="content" style={{ maxWidth: 560, margin: '0 auto', paddingTop: '3rem' }}>
      <div className="center mb">
        <Logo size={64} />
        <h1 style={{ marginTop: '1rem' }}>Producción Iturrospe</h1>
      </div>
      <div className="card">
        <h3>⚙️ Falta configurar Supabase</h3>
        <p className="muted">
          Para usar la app, creá un archivo <code>.env</code> en la raíz (podés copiar{' '}
          <code>.env.example</code>) y completá:
        </p>
        <pre
          style={{
            background: 'var(--gris-100)',
            padding: '0.75rem',
            borderRadius: 8,
            overflow: 'auto',
            fontSize: '0.85rem',
          }}
        >
{`VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key`}
        </pre>
        <p className="muted small">
          Aplicá las migraciones de <code>supabase/migrations</code> y ejecutá{' '}
          <code>npm run seed</code> para cargar datos de ejemplo. Luego reiniciá el dev server.
          Ver <code>README.md</code> para el paso a paso completo.
        </p>
      </div>
    </div>
  )
}
