-- ═══════════════════════════════════════════════════════════════════
--  0025 — Chat: silencio por duración + hora de lectura
--  ═══════════════════════════════════════════════════════════════════
--  Contexto (roadmap §Chat, bloque "plataforma de mensajería moderna"):
--   1. Silencio por duración (8h / 1 semana / siempre). Hoy `muted` es un
--      booleano; se añade `muted_until timestamptz` y dos RPCs nuevos:
--      `nx_enlace_set_mute` (con vencimiento opcional) y `nx_enlace_unmute`.
--      Un participante se considera silenciado si `muted` es true O si
--      `muted_until` está en el futuro — el push (send-chat-push) y el
--      watcher de no-leídos deben replicar ese criterio.
--   2. Hora de la lectura: `messages` no guardaba cuándo se leyó; se añade
--      `read_at timestamptz` y `nx_enlace_mark_read` lo rellena al
--      transicionar a `read`, para poder exponer "Leído · HH:MM" en la UI.
--  Aditivo e idempotente. Depende de: 0013 (schema chat), 0015 (RPCs).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Columnas nuevas ──────────────────────────────────────────────
alter table conversation_participants
  add column if not exists muted_until timestamptz;

alter table messages
  add column if not exists read_at timestamptz;

-- ── 2. RPC: silenciar con vencimiento ───────────────────────────────
-- p_until = NULL  → silenciar para siempre (mismo efecto que el toggle
--                   histórico, `muted` queda true).
-- p_until futuro   → silenciar hasta esa fecha/hora (`muted_until`).
create or replace function nx_enlace_set_mute(p_conversation_id uuid, p_until timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversation_participants
    set muted = (p_until is null),
        muted_until = p_until
    where conversation_id = p_conversation_id and user_id = my_user_id();
end;
$$;
grant execute on function nx_enlace_set_mute(uuid, timestamptz) to authenticated;

-- ── 3. RPC: desactivar el silencio (limpia ambos campos) ────────────
create or replace function nx_enlace_unmute(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversation_participants
    set muted = false, muted_until = null
    where conversation_id = p_conversation_id and user_id = my_user_id();
end;
$$;
grant execute on function nx_enlace_unmute(uuid) to authenticated;

-- ── 4. RPC: mark read ahora registra la hora ────────────────────────
create or replace function nx_enlace_mark_read(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update messages
    set status = 'read',
        read_at = coalesce(read_at, now())
    where id = p_message_id
      and status in ('sent', 'delivered');
end;
$$;
grant execute on function nx_enlace_mark_read(uuid) to authenticated;
