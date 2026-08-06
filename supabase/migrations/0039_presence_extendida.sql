-- ══════════════════════════════════════════════════════════════════
--  0039 — Chat: presencia extendida (Ausente / No molestar)
--  ══════════════════════════════════════════════════════════════════
--  FASE W7.1. Hasta ahora la presencia era 100% automática: user_heartbeats
--  guarda solo last_seen_at (heartbeat de actividad), y el cliente deriva
--  "Activo ahora" si el último latido fue hace <2 min. Esto añade un
--  estado MANUAL que el propio usuario puede fijar y que tiene prioridad
--  sobre el cálculo automático (Ausente/No molestar se muestran aunque
--  el heartbeat siga llegando — la persona sigue "usando" Emet pero no
--  quiere que la interrumpan).
--
--  null = automático (el heartbeat decide "Activo ahora" / "Hace X min").
--  El heartbeat (JornadaWatcher, upsert de solo user_id+last_seen_at) NO
--  toca esta columna al no incluirla en el payload — Postgres solo
--  actualiza en ON CONFLICT las columnas presentes en el upsert.
--  Aditivo e idempotente. Las políticas RLS existentes de user_heartbeats
--  (heartbeat_own_update) ya cubren esta columna: son por fila completa
--  (user_id = my_user_id()), no por columna.
-- ══════════════════════════════════════════════════════════════════

alter table public.user_heartbeats
  add column if not exists manual_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_heartbeats_manual_status_check'
  ) then
    alter table public.user_heartbeats
      add constraint user_heartbeats_manual_status_check
      check (manual_status is null or manual_status in ('ausente', 'no_molestar'));
  end if;
end $$;
