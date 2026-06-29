-- =============================================================
-- Row Level Security — coherente con la matriz de permisos
-- =============================================================

alter table public.usuarios          enable row level security;
alter table public.ot                enable row level security;
alter table public.subconjuntos      enable row level security;
alter table public.planos            enable row level security;
alter table public.procesos_catalogo enable row level security;
alter table public.plano_procesos    enable row level security;
alter table public.partes_trabajo    enable row level security;
alter table public.comentarios       enable row level security;

-- ----------------------------------------------------------------
-- usuarios
-- ----------------------------------------------------------------
-- Cada uno ve su propio perfil; el jefe ve todos.
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select using ( id = auth.uid() or public.es_jefe() );

-- El usuario puede actualizar su propio nombre (no su rol/estado).
drop policy if exists usuarios_update_self on public.usuarios;
create policy usuarios_update_self on public.usuarios
  for update using ( id = auth.uid() )
  with check ( id = auth.uid() );

-- (Inserción la maneja el trigger handle_new_user con SECURITY DEFINER.)

-- ----------------------------------------------------------------
-- Lectura general para usuarios activos (estructura productiva)
-- ----------------------------------------------------------------
drop policy if exists ot_select on public.ot;
create policy ot_select on public.ot for select using ( public.es_activo() );

drop policy if exists subconjuntos_select on public.subconjuntos;
create policy subconjuntos_select on public.subconjuntos for select using ( public.es_activo() );

drop policy if exists planos_select on public.planos;
create policy planos_select on public.planos for select using ( public.es_activo() );

drop policy if exists procesos_catalogo_select on public.procesos_catalogo;
create policy procesos_catalogo_select on public.procesos_catalogo for select using ( public.es_activo() );

drop policy if exists plano_procesos_select on public.plano_procesos;
create policy plano_procesos_select on public.plano_procesos for select using ( public.es_activo() );

drop policy if exists partes_select on public.partes_trabajo;
create policy partes_select on public.partes_trabajo for select using ( public.es_activo() );

drop policy if exists comentarios_select on public.comentarios;
create policy comentarios_select on public.comentarios for select using ( public.es_activo() );

-- ----------------------------------------------------------------
-- Escritura de estructura productiva: SOLO jefe
-- ----------------------------------------------------------------
drop policy if exists ot_write on public.ot;
create policy ot_write on public.ot for all
  using ( public.es_jefe() ) with check ( public.es_jefe() );

drop policy if exists subconjuntos_write on public.subconjuntos;
create policy subconjuntos_write on public.subconjuntos for all
  using ( public.es_jefe() ) with check ( public.es_jefe() );

drop policy if exists planos_write on public.planos;
create policy planos_write on public.planos for all
  using ( public.es_jefe() ) with check ( public.es_jefe() );

drop policy if exists procesos_catalogo_write on public.procesos_catalogo;
create policy procesos_catalogo_write on public.procesos_catalogo for all
  using ( public.es_jefe() ) with check ( public.es_jefe() );

drop policy if exists plano_procesos_write on public.plano_procesos;
create policy plano_procesos_write on public.plano_procesos for all
  using ( public.es_jefe() ) with check ( public.es_jefe() );

-- ----------------------------------------------------------------
-- partes_trabajo: INSERT por cualquier activo (vía RPC registrar_parte,
--   pero también permitimos insert directo sellando usuario_id propio).
--   UPDATE/DELETE bloqueados (inmutables): solo el jefe vía RPC SECURITY DEFINER.
-- ----------------------------------------------------------------
drop policy if exists partes_insert on public.partes_trabajo;
create policy partes_insert on public.partes_trabajo
  for insert with check ( public.es_activo() and usuario_id = auth.uid() );

-- Sin políticas de UPDATE/DELETE => inmutables a nivel cliente.
-- Las correcciones del jefe pasan por anular_parte() (SECURITY DEFINER).

-- ----------------------------------------------------------------
-- comentarios: insertar SOLO calidad o jefe
-- ----------------------------------------------------------------
drop policy if exists comentarios_insert on public.comentarios;
create policy comentarios_insert on public.comentarios
  for insert with check ( public.puede_comentar() and usuario_id = auth.uid() );
