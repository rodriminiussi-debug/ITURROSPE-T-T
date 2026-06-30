-- =============================================================
-- Solicitud de reseteo de PIN (olvido de contraseña)
-- El operario no tiene email: pide el reset y el jefe le asigna
-- un PIN nuevo desde la pantalla de Usuarios.
-- =============================================================

alter table public.usuarios
  add column if not exists reset_pin_solicitado    boolean not null default false,
  add column if not exists reset_pin_solicitado_at timestamptz;

comment on column public.usuarios.reset_pin_solicitado is
  'El usuario solicitó un reseteo de PIN; el jefe le asigna uno nuevo.';
