# Producción Iturrospe

PWA de **trazabilidad del proceso productivo** para una empresa metalúrgica. Los operarios
escanean el **QR de un plano** desde el celular y registran el avance de cada proceso
(inicio, fin, cantidad, observaciones, defectos). El jefe de planta gestiona toda la
estructura productiva (OT → Subconjuntos → Planos → Procesos) y toma decisiones con un
dashboard. Calidad deja comentarios y no conformidades.

> Identidad: **I amarilla sobre fondo blanco** · color primario `#FFC107` · estilo
> industrial, mobile-first, botones grandes (uso con guantes).

## Stack

- **React 18 + Vite** · **vite-plugin-pwa** (manifest + service worker)
- **Supabase** (Postgres, Auth, RLS)
- `qrcode` (generar) · `html5-qrcode` (leer) · `xlsx` (importar) · `recharts` (dashboard)

## PWA instalable

- `manifest.webmanifest` completo (`standalone`, `portrait`, theme `#FFC107`).
- Set de íconos generado (`192`, `512`, **maskable**, `apple-touch-icon` 180, favicon) — ver
  `scripts/generate-icons.mjs` (`npm run gen:icons`).
- Service worker con precache del app shell (`registerType: autoUpdate`).
- Metadatos iOS/Android + Open Graph en `index.html`.
- Botón **“Instalar app”** (`beforeinstallprompt`) y guía de “Agregar a pantalla de inicio”
  en iOS (`src/components/InstallPrompt.jsx`).
- Deep link `/plano/{token}`: si se escanea con la cámara nativa, pide login y abre el plano.

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el proyecto Supabase y aplicar el esquema

Aplicá, **en orden**, las migraciones de `supabase/migrations/`:

1. `0001_schema.sql` — tablas y tipos.
2. `0002_functions.sql` — triggers, recálculo automático y RPCs.
3. `0003_rls.sql` — Row Level Security (matriz de permisos).
4. `0004_seed_catalogo.sql` — los 8 procesos del catálogo.

Podés pegarlas en el **SQL Editor** de Supabase, o usar la CLI:

```bash
supabase db push   # si trabajás con la CLI y supabase/ vinculado
```

> **Importante (login por PIN):** en **Authentication → Providers → Email**, poné
> **Minimum password length = 6** y deshabilitá la confirmación por email. El login usa
> usuario + PIN: internamente cada usuario se mapea a `usuario@iturrospe.local` y el PIN es
> la contraseña.

### 3. Variables de entorno

```bash
cp .env.example .env
```

Completá con los valores de **Settings → API**:

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key   # solo para el seed
```

### 4. Cargar datos de ejemplo

```bash
npm run seed
```

Crea usuarios de prueba, 2 OTs con subconjuntos, planos, rutas de procesos y registros
(incluye división de producción y un defecto en retrabajo).

**Usuarios de prueba (PIN `123456`):**

| Usuario     | Rol            |
|-------------|----------------|
| `jperez`    | Jefe de planta |
| `mlopez`    | Calidad        |
| `rgomez`    | Operario       |
| `asosa`     | Operario       |
| `pendiente` | Sin aprobar (para probar la aprobación) |

### 5. Correr la app

```bash
npm run dev      # desarrollo (PWA habilitada también en dev)
npm run build    # producción
npm run preview  # previsualizar el build
```

## Roles y permisos (RLS)

| Acción | Operario | Calidad | Jefe |
|---|:---:|:---:|:---:|
| Escanear QR y registrar avance | ✅ | ✅ | ✅ |
| Reportar defecto / retrabajo | ✅ | ✅ | ✅ |
| Comentarios / no conformidades | ❌ | ✅ | ✅ |
| Editar/anular registros | ❌ | ❌ | ✅ (con traza) |
| Crear/importar OT, planos, rutas | ❌ | ❌ | ✅ |
| Reasignar / repriorizar / “En espera” | ❌ | ❌ | ✅ |
| Generar QR / etiquetas | ❌ | ❌ | ✅ |
| Aprobar usuarios | ❌ | ❌ | ✅ |
| Dashboard | ❌ | parcial | ✅ |

Los **partes de trabajo son inmutables** a nivel cliente (no hay políticas de UPDATE/DELETE).
Solo el jefe puede anularlos vía la RPC `anular_parte`, que deja traza de quién y cuándo.

## Modelo de datos

`usuarios`, `ot`, `subconjuntos`, `planos`, `procesos_catalogo`, `plano_procesos`
(ruta + cantidades), `partes_trabajo` (registros inmutables), `comentarios`.

**Lógica automática** (triggers): `plano_procesos.cantidad_completada` = suma de
`partes_trabajo.cantidad_realizada` no anuladas ni defectuosas; el `estado` se recalcula
(`pendiente → en_curso → hecho`), salvo `en_espera` (manual) y `retrabajo` (defecto abierto).

## Estructura del proyecto

```
public/                  íconos PWA, favicon, manifest (generado)
scripts/
  generate-icons.mjs     genera el set de íconos (I amarilla)
  seed.mjs               datos de ejemplo
supabase/migrations/     esquema, funciones, RLS, catálogo
src/
  lib/        supabase, auth (usuario+PIN), queries, helpers
  components/ Layout, ui (toast/modal/badge), InstallPrompt, Logo, SetupNotice
  pages/      Login, Registro, Pendiente, Home, Escanear, PlanoView,
              Dashboard, Gestion, OTDetalle, Usuarios, Importar, Etiquetas
```

## Notas

- Sin imágenes en los registros (solo texto en observaciones), por requerimiento.
- Pensada para WiFi en planta: el SW cachea el app shell (carga e instalación rápidas),
  sin sincronización offline compleja.
