-- =============================================================
-- Producción Iturrospe — Esquema de base de datos
-- Trazabilidad del proceso productivo metalúrgico por QR
-- =============================================================

-- Extensiones
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------
do $$ begin
  create type rol_usuario as enum ('operario', 'calidad', 'jefe');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_usuario as enum ('pendiente', 'activo', 'inactivo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prioridad_t as enum ('alta', 'media', 'baja');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_ot as enum ('en_curso', 'pausada', 'finalizada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_proceso as enum ('pendiente', 'en_curso', 'hecho', 'en_espera', 'retrabajo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_comentario as enum ('comentario', 'observacion', 'no_conformidad');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------
-- usuarios  (mapea 1:1 con auth.users vía id)
-- ----------------------------------------------------------------
create table if not exists public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  usuario     text not null unique,
  rol         rol_usuario,
  estado      estado_usuario not null default 'pendiente',
  sector      text,
  created_at  timestamptz not null default now()
);
comment on table public.usuarios is 'Perfil de usuario. El PIN se guarda como contraseña en auth.users.';

-- ----------------------------------------------------------------
-- ot  (Orden de Trabajo = 1 producto)
-- ----------------------------------------------------------------
create table if not exists public.ot (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,
  producto        text not null,
  cliente         text,
  fecha_creacion  date not null default current_date,
  fecha_entrega   date,
  prioridad       prioridad_t not null default 'media',
  estado          estado_ot not null default 'en_curso',
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- subconjuntos
-- ----------------------------------------------------------------
create table if not exists public.subconjuntos (
  id      uuid primary key default gen_random_uuid(),
  ot_id   uuid not null references public.ot(id) on delete cascade,
  nombre  text not null,
  orden   int not null default 0
);
create index if not exists idx_subconjuntos_ot on public.subconjuntos(ot_id);

-- ----------------------------------------------------------------
-- planos
-- ----------------------------------------------------------------
create table if not exists public.planos (
  id              uuid primary key default gen_random_uuid(),
  subconjunto_id  uuid not null references public.subconjuntos(id) on delete cascade,
  numero_plano    text not null,
  descripcion     text,
  cantidad_total  int not null default 1,
  qr_token        text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at      timestamptz not null default now()
);
create index if not exists idx_planos_subconjunto on public.planos(subconjunto_id);
create index if not exists idx_planos_token on public.planos(qr_token);

-- ----------------------------------------------------------------
-- procesos_catalogo  (catálogo reutilizable)
-- ----------------------------------------------------------------
create table if not exists public.procesos_catalogo (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique,
  metodos text[] not null default '{}',
  orden   int not null default 0
);

-- ----------------------------------------------------------------
-- plano_procesos  (ruta de procesos del plano)
-- ----------------------------------------------------------------
create table if not exists public.plano_procesos (
  id                    uuid primary key default gen_random_uuid(),
  plano_id              uuid not null references public.planos(id) on delete cascade,
  proceso_catalogo_id   uuid not null references public.procesos_catalogo(id),
  cantidad_requerida    int not null default 1,
  cantidad_completada   int not null default 0,
  estado                estado_proceso not null default 'pendiente',
  orden                 int not null default 0,
  prioridad             prioridad_t not null default 'media',
  created_at            timestamptz not null default now()
);
create index if not exists idx_plano_procesos_plano on public.plano_procesos(plano_id);

-- ----------------------------------------------------------------
-- partes_trabajo  (registros inmutables de avance)
-- ----------------------------------------------------------------
create table if not exists public.partes_trabajo (
  id                  uuid primary key default gen_random_uuid(),
  plano_proceso_id    uuid not null references public.plano_procesos(id) on delete cascade,
  usuario_id          uuid not null references public.usuarios(id),
  metodo              text,
  cantidad_realizada  int not null default 0,
  hora_inicio         timestamptz,
  hora_fin            timestamptz,
  observaciones       text,
  es_defecto          boolean not null default false,
  cantidad_defectuosa int,
  -- Trazabilidad de correcciones del jefe
  anulado             boolean not null default false,
  anulado_por         uuid references public.usuarios(id),
  anulado_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_partes_proceso on public.partes_trabajo(plano_proceso_id);
create index if not exists idx_partes_usuario on public.partes_trabajo(usuario_id);

-- ----------------------------------------------------------------
-- comentarios  (calidad / jefe)
-- ----------------------------------------------------------------
create table if not exists public.comentarios (
  id          uuid primary key default gen_random_uuid(),
  plano_id    uuid not null references public.planos(id) on delete cascade,
  usuario_id  uuid not null references public.usuarios(id),
  tipo        tipo_comentario not null default 'comentario',
  texto       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_comentarios_plano on public.comentarios(plano_id);
