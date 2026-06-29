-- =============================================================
-- Funciones, triggers y lógica automática
-- =============================================================

-- Helpers de rol/estado (SECURITY DEFINER para usarse en RLS sin recursión)
create or replace function public.mi_rol()
returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from public.usuarios where id = auth.uid();
$$;

create or replace function public.mi_estado()
returns estado_usuario
language sql stable security definer set search_path = public as $$
  select estado from public.usuarios where id = auth.uid();
$$;

create or replace function public.es_jefe()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol = 'jefe' and estado = 'activo' from public.usuarios where id = auth.uid()),
    false
  );
$$;

create or replace function public.es_activo()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select estado = 'activo' from public.usuarios where id = auth.uid()),
    false
  );
$$;

create or replace function public.puede_comentar()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol in ('calidad', 'jefe') and estado = 'activo'
     from public.usuarios where id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------
-- Recalcular cantidad_completada y estado de un plano_proceso
-- ----------------------------------------------------------------
create or replace function public.recalcular_plano_proceso(pp_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_req int;
  v_estado estado_proceso;
  v_hay_defecto boolean;
begin
  select coalesce(sum(cantidad_realizada), 0)
    into v_total
    from public.partes_trabajo
   where plano_proceso_id = pp_id
     and anulado = false
     and es_defecto = false;

  select cantidad_requerida, estado into v_req, v_estado
    from public.plano_procesos where id = pp_id;

  -- ¿Hay defectos abiertos (no resueltos)?
  select exists(
    select 1 from public.partes_trabajo
     where plano_proceso_id = pp_id
       and anulado = false
       and es_defecto = true
       and coalesce(cantidad_defectuosa, 0) > 0
  ) into v_hay_defecto;

  -- Estados manuales (en_espera) se respetan salvo que haya defecto.
  if v_hay_defecto then
    v_estado := 'retrabajo';
  elsif v_estado = 'en_espera' then
    v_estado := 'en_espera';
  elsif v_total <= 0 then
    v_estado := 'pendiente';
  elsif v_total >= v_req then
    v_estado := 'hecho';
  else
    v_estado := 'en_curso';
  end if;

  update public.plano_procesos
     set cantidad_completada = v_total,
         estado = v_estado
   where id = pp_id;
end;
$$;

-- Trigger sobre partes_trabajo: recalcula el proceso afectado
create or replace function public.trg_recalcular_parte()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_plano_proceso(old.plano_proceso_id);
    return old;
  else
    perform public.recalcular_plano_proceso(new.plano_proceso_id);
    return new;
  end if;
end;
$$;

drop trigger if exists tg_partes_recalc on public.partes_trabajo;
create trigger tg_partes_recalc
after insert or update or delete on public.partes_trabajo
for each row execute function public.trg_recalcular_parte();

-- ----------------------------------------------------------------
-- RPC: registrar un parte de trabajo (operario/calidad/jefe)
-- Sella el usuario_id desde auth.uid() — nadie puede falsear autoría.
-- ----------------------------------------------------------------
create or replace function public.registrar_parte(
  p_plano_proceso_id uuid,
  p_cantidad int,
  p_metodo text default null,
  p_hora_inicio timestamptz default null,
  p_hora_fin timestamptz default null,
  p_observaciones text default null,
  p_es_defecto boolean default false,
  p_cantidad_defectuosa int default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.es_activo() then
    raise exception 'Usuario no activo';
  end if;

  insert into public.partes_trabajo(
    plano_proceso_id, usuario_id, metodo, cantidad_realizada,
    hora_inicio, hora_fin, observaciones, es_defecto, cantidad_defectuosa
  ) values (
    p_plano_proceso_id, auth.uid(), p_metodo, coalesce(p_cantidad, 0),
    p_hora_inicio, p_hora_fin, p_observaciones, coalesce(p_es_defecto, false), p_cantidad_defectuosa
  ) returning id into v_id;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: resolver un defecto/retrabajo (marca el parte como resuelto)
-- ----------------------------------------------------------------
create or replace function public.resolver_defecto(p_parte_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_pp uuid;
begin
  if not public.es_activo() then
    raise exception 'Usuario no activo';
  end if;
  update public.partes_trabajo
     set cantidad_defectuosa = 0
   where id = p_parte_id and es_defecto = true
   returning plano_proceso_id into v_pp;
  if v_pp is not null then
    perform public.recalcular_plano_proceso(v_pp);
  end if;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: setear estado manual de un proceso (jefe) — en_espera / liberar
-- ----------------------------------------------------------------
create or replace function public.set_estado_proceso(p_pp_id uuid, p_estado estado_proceso)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_jefe() then
    raise exception 'Solo el jefe de planta puede cambiar el estado manual';
  end if;

  if p_estado = 'en_espera' then
    update public.plano_procesos set estado = 'en_espera' where id = p_pp_id;
  else
    -- liberar: recalcular automáticamente
    update public.plano_procesos set estado = 'pendiente' where id = p_pp_id;
    perform public.recalcular_plano_proceso(p_pp_id);
  end if;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: anular un parte (solo jefe) — deja traza de quién lo anuló
-- ----------------------------------------------------------------
create or replace function public.anular_parte(p_parte_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_pp uuid;
begin
  if not public.es_jefe() then
    raise exception 'Solo el jefe de planta puede anular registros';
  end if;
  update public.partes_trabajo
     set anulado = true, anulado_por = auth.uid(), anulado_at = now()
   where id = p_parte_id
   returning plano_proceso_id into v_pp;
  if v_pp is not null then
    perform public.recalcular_plano_proceso(v_pp);
  end if;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: aprobar usuario (jefe) — asigna rol/sector y activa
-- ----------------------------------------------------------------
create or replace function public.aprobar_usuario(
  p_usuario_id uuid, p_rol rol_usuario, p_sector text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_jefe() then
    raise exception 'Solo el jefe de planta puede aprobar usuarios';
  end if;
  update public.usuarios
     set rol = p_rol, estado = 'activo', sector = p_sector
   where id = p_usuario_id;
end;
$$;

-- ----------------------------------------------------------------
-- RPC: cambiar estado de usuario (jefe) — activo/inactivo y rol
-- ----------------------------------------------------------------
create or replace function public.actualizar_usuario(
  p_usuario_id uuid, p_rol rol_usuario, p_estado estado_usuario, p_sector text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_jefe() then
    raise exception 'Solo el jefe de planta puede modificar usuarios';
  end if;
  update public.usuarios
     set rol = p_rol, estado = p_estado, sector = p_sector
   where id = p_usuario_id;
end;
$$;

-- ----------------------------------------------------------------
-- Trigger: crear perfil en public.usuarios al registrarse en auth
-- Lee nombre/usuario desde raw_user_meta_data.
-- ----------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, nombre, usuario, estado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', 'Sin nombre'),
    coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email, '@', 1)),
    'pendiente'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
