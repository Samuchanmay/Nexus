-- ═══════════════════════════════════════════════════════════════════
--  0015 — Chat: RPCs (funciones)
--  ═══════════════════════════════════════════════════════════════════
--  Depende de: 0013_chat_schema.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. RPC: toggle mute ─────────────────────────────────────────
create or replace function nx_enlace_toggle_mute(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_current boolean;
begin
  select muted into v_current from conversation_participants
    where conversation_id = p_conversation_id and user_id = v_me;
  update conversation_participants set muted = not coalesce(v_current, false)
    where conversation_id = p_conversation_id and user_id = v_me;
  return not coalesce(v_current, false);
end;
$$;
grant execute on function nx_enlace_toggle_mute(uuid) to authenticated;

-- ── 2. RPC: toggle conversation pin ──────────────────────────────
create or replace function nx_enlace_toggle_conversation_pin(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_current boolean;
begin
  select pinned into v_current from conversation_participants
    where conversation_id = p_conversation_id and user_id = v_me;
  update conversation_participants set pinned = not coalesce(v_current, false)
    where conversation_id = p_conversation_id and user_id = v_me;
end;
$$;
grant execute on function nx_enlace_toggle_conversation_pin(uuid) to authenticated;

-- ── 3. RPC: toggle conversation archived ─────────────────────────
create or replace function nx_enlace_toggle_conversation_archived(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_current boolean;
begin
  select archived into v_current from conversation_participants
    where conversation_id = p_conversation_id and user_id = v_me;
  update conversation_participants set archived = not coalesce(v_current, false)
    where conversation_id = p_conversation_id and user_id = v_me;
end;
$$;
grant execute on function nx_enlace_toggle_conversation_archived(uuid) to authenticated;

-- ── 4. RPC: mark conversation read ───────────────────────────────
create or replace function nx_enlace_mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversation_participants
    set last_read_at = now()
    where conversation_id = p_conversation_id and user_id = my_user_id();
end;
$$;
grant execute on function nx_enlace_mark_conversation_read(uuid) to authenticated;

-- ── 5. RPC: mark message delivered ───────────────────────────────
create or replace function nx_enlace_mark_delivered(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update messages set status = 'delivered'
    where id = p_message_id
    and status in ('sent', 'pending');
end;
$$;
grant execute on function nx_enlace_mark_delivered(uuid) to authenticated;

-- ── 6. RPC: mark message read ────────────────────────────────────
create or replace function nx_enlace_mark_read(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update messages set status = 'read'
    where id = p_message_id
    and status in ('sent', 'delivered');
end;
$$;
grant execute on function nx_enlace_mark_read(uuid) to authenticated;

-- ── 7. RPC: toggle pin message ───────────────────────────────────
create or replace function nx_enlace_toggle_pin(p_conversation_id uuid, p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_current uuid;
begin
  select pinned_message_id into v_current from conversations where id = p_conversation_id;
  if v_current = p_message_id then
    update conversations set pinned_message_id = null, pinned_by = null, pinned_at = null
      where id = p_conversation_id;
  else
    update conversations set pinned_message_id = p_message_id, pinned_by = v_me, pinned_at = now()
      where id = p_conversation_id;
  end if;
end;
$$;
grant execute on function nx_enlace_toggle_pin(uuid, uuid) to authenticated;

-- ── 8. RPC: toggle reaction ──────────────────────────────────────
create or replace function nx_enlace_toggle_reaction(p_message_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_existing_id uuid;
begin
  select id into v_existing_id from message_reactions
    where message_id = p_message_id and user_id = v_me and emoji = p_emoji;
  if v_existing_id is not null then
    delete from message_reactions where id = v_existing_id;
  else
    insert into message_reactions (message_id, user_id, emoji) values (p_message_id, v_me, p_emoji);
  end if;
end;
$$;
grant execute on function nx_enlace_toggle_reaction(uuid, text) to authenticated;
