-- =============================================================
-- Endurecimiento: cerrar el acceso REST a funciones puramente internas.
-- Siguen funcionando porque se invocan desde triggers o desde otras
-- funciones SECURITY DEFINER (contexto del owner), no por llamada directa.
-- =============================================================
revoke execute on function public.recalcular_plano_proceso(uuid) from anon, authenticated;
revoke execute on function public.trg_recalcular_parte() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
