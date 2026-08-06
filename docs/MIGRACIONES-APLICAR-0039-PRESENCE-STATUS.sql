-- ═══════════════════════════════════════════════════════════════════
--  EMET — MIGRACIÓN 0039 — Estados de presencia (Activo/Ausente/No molestar)
--  ═══════════════════════════════════════════════════════════════════
--  Qué hace (Fase 5 del chat):
--   1. users.presence_status — estado manual del usuario: 'active',
--      'away', 'busy', 'offline'. Por defecto 'offline'.
--   2. RPC nx_set_presence_status — el usuario cambia su estado desde
--      la UI (selector en el perfil/avatar).
--   3. users_directory actualizada — incluye presence_status para que
--      el chat pueda mostrar el estado de los participantes.
--
--  Cómo aplicar: pegar TODO en el SQL Editor de emet.uno y ejecutar
--  (idempotente, se puede re-ejecutar sin riesgo). Depende de que ya
--  estén aplicadas 0001-0038.
--  ═══════════════════════════════════════════════════════════════════

-- ── 1. Columna presence_status en users ────────────────────────────
alter table public.users
  add column if not exists presence_status text not null default 'offline'
  check (presence_status in ('active', 'away', 'busy', 'offline'));

-- ── 2. RPC: actualizar estado de presencia ─────────────────────────
create or replace function nx_set_presence_status(p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('active', 'away', 'busy', 'offline') then
    raise exception 'Invalid presence status: %', p_status;
  end if;
  
  update public.users
    set presence_status = p_status
    where id = my_user_id();
end;
$$;
grant execute on function nx_set_presence_status(text) to authenticated;

-- ── 3. Actualizar users_directory para incluir presence_status ─────
create or replace view public.users_directory
with (security_invoker = true) as
  select id, display_name, full_name, avatar_url, role, title, honorific,
         area, area_id, nexus_color, active, phone, extension, presence_status
  from public.users;

-- Verificación:
--   select id, display_name, presence_status from users_directory limit 5;
--   select nx_set_presence_status('busy');
