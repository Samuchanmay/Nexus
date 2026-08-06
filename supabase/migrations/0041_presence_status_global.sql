-- ═══════════════════════════════════════════════════════════════════
--  0041 — Estados de presencia globales (Activo/Ausente/No molestar)
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: reemplaza/renumera el archivo 0039_presence_status.sql
--  (nombre en colisión con 0039_presence_extendida.sql, escrito en
--  paralelo por otra sesión) — este es el contenido REALMENTE aplicado
--  a la base de datos en la nube (migración "presence_status_global",
--  20260806100643), con una corrección de seguridad sobre el original:
--  el chequeo NOT NULL-safe de p_status (ver punto 2).
--
--  Diseño: los usuarios pueden definir su estado de presencia
--  manualmente (además del heartbeat automático de última actividad).
--  Estados: active (verde), away (amarillo), busy (rojo), offline (gris).
--  El estado manual tiene prioridad sobre el heartbeat para mostrar
--  "No molestar" aunque el usuario esté activo. Usado por el Shell
--  global (src/components/os/shell.tsx) Y por el selector de presencia
--  del chat (src/components/chat/presence-status-menu.tsx).
--
--  Convive con 0039_presence_extendida.sql (user_heartbeats.manual_status,
--  valores 'ausente'/'no_molestar') — ese sigue siendo un fallback legado
--  soportado por getPresenceInfo() en src/lib/chat/format-presence.ts,
--  que acepta ambos espacios de valores.
--
--  Aditivo e idempotente. Depende de: 0001 (users table), 0010 (vista
--  users_directory).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Columna presence_status en users ────────────────────────────
-- Valores permitidos: 'active', 'away', 'busy', 'offline'.
-- NOT NULL con default 'offline' — todo usuario tiene un estado válido
-- desde el momento en que se crea la fila, sin huecos que el código
-- cliente tenga que andar tratando como "sin dato".
alter table public.users
  add column if not exists presence_status text not null default 'offline'
  check (presence_status in ('active', 'away', 'busy', 'offline'));

-- ── 2. RPC: actualizar mi propio estado de presencia ────────────────
-- Solo puede cambiar su propio estado (my_user_id()).
-- OJO: "p_status not in (...)" da NULL (falsy) cuando p_status es NULL,
-- así que sin el chequeo "is null" explícito, un NULL se cuela sin
-- excepción y termina violando el NOT NULL de la columna con un error
-- crudo de Postgres en vez del mensaje claro que se espera aquí.
create or replace function nx_set_presence_status(p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status is null or p_status not in ('active', 'away', 'busy', 'offline') then
    raise exception 'Estado de presencia inválido: %', p_status;
  end if;

  update public.users
    set presence_status = p_status
    where id = my_user_id();
end;
$$;
grant execute on function nx_set_presence_status(text) to authenticated;

-- ── 3. users_directory incluye presence_status ─────────────────────
-- security_invoker = true: la vista corre con los permisos RLS de
-- quien consulta, no del dueño de la vista — mismo criterio que el
-- resto de vistas de la app, no cambiar sin razón explícita.
create or replace view public.users_directory
with (security_invoker = true) as
  select id, display_name, full_name, avatar_url, role, title, honorific,
         area, area_id, nexus_color, active, phone, extension, presence_status
  from public.users;

-- ── 4. RLS ───────────────────────────────────────────────────────────
-- La política de UPDATE en users (solo el propio usuario) ya cubre
-- esta columna — no se necesita política nueva.
