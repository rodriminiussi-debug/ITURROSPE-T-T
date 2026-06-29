-- =============================================================
-- Datos de referencia: catálogo de procesos (sección 6)
-- =============================================================
insert into public.procesos_catalogo (nombre, metodos, orden) values
  ('Corte',               array['Oxicorte','Láser','Serrucho'], 1),
  ('Soldadura',           '{}',                                 2),
  ('Mecanizado',          array['Torno','Fresado'],             3),
  ('Ajuste',              array['Rebabado','Roscado'],          4),
  ('Plegado',             '{}',                                 5),
  ('Tratamiento Térmico', '{}',                                 6),
  ('Pintura',             '{}',                                 7),
  ('Montaje',             '{}',                                 8)
on conflict (nombre) do update
  set metodos = excluded.metodos, orden = excluded.orden;
