-- ═══════════════════════════════════════════════════════════════════
--  0039 — Estados de presencia (Activo/Ausente/No molestar)
--  ═══════════════════════════════════════════════════════════════════
--  Contexto (roadmap §Chat Fase 5): los usuarios pueden definir su
--  estado de presencia manualmente, además del heartbeat automático.
--  Estados: active (verde), away (amarillo), busy (rojo), offline (gris).
--  El estado manual tiene prioridad sobre el heartbeat para mostrar
--  "No molestar" aunque el usuario esté activo.
--  Aditivo e idempotente. Depende de: 0001 (users table).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Columna presence_status en users ────────────────────────────
-- Valores permitidos: 'active', 'away', 'busy', 'offline'
-- Por defecto 'offline' (se actualiza automáticamente por heartbeat).
alter table public.users
  add column if not exists presence_status text not null default 'offline'
  check (presence_status in ('active', 'away', 'busy', 'offline'));

-- ── 2. RPC: actualizar estado de presencia ─────────────────────────
-- El usuario puede cambiar su estado manualmente desde la UI.
-- Solo puede cambiar su propio estado (my_user_id()).
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
-- users_directory es una vista definida en 0010. La recreamos con la
-- nueva columna presence_status incluida.
create or replace view public.users_directory
with (security_invoker = true) as
  select id, display_name, full_name, avatar_url, role, title, honorific,
         area, area_id, nexus_color, active, phone, extension, presence_status
  from public.users;

-- ── 4. RLS: solo el propio usuario puede actualizar su estado ──────
-- La política ya existe para UPDATE en users (solo propio usuario).
-- No necesitamos crear una nueva política.
