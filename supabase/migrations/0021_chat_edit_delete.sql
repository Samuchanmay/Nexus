-- ═══════════════════════════════════════════════════════════════════
--  0021 — Chat: editar / eliminar mensajes (FASE 2)
--  ═══════════════════════════════════════════════════════════════════
--  Depende de: 0011_enlace_mvp.sql (messages.edited / messages.deleted_at
--  ya existen desde la ronda 1 — no hace falta DDL de columnas).
--
--  Decisiones de diseño:
--  · La edición/eliminación NO se expone como policy UPDATE/DELETE sobre
--    messages: se hace exclusivamente vía RPC SECURITY DEFINER que valida
--    reglas de negocio (solo autor, solo texto para editar, no-eliminado)
--    que una policy declarativa no puede expresar bien. Mismo patrón que
--    nx_enlace_get_or_create_direct (0011).
--  · Eliminar es BORRADO SUAVE (deleted_at, content → null), no físico:
--    conserva el id y el realtime para que los demás participantes vean
--    "mensaje eliminado" en vivo sin colisiones de ids. Los adjuntos no se
--    borran del bucket (no hay UI de purga todavía) — el mensaje deja de
--    mostrarlos.
--  · Al editar/eliminar el ÚLTIMO mensaje, el preview de la lista
--    (conversations.last_message_preview) quedaría obsoleto porque el
--    trigger nx_enlace_touch_conversation solo corre en INSERT. Se agrega
--    nx_enlace_refresh_preview para recalcularlo siempre, sin romper el
--    trigger existente.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Helper: recalcular el preview de la conversación ───────────
-- Toma el último mensaje NO eliminado; si no queda ninguno, deja la
-- conversación sin preview (last_message_* = null) en vez de mostrar el
-- texto de un mensaje borrado.
create or replace function public.nx_enlace_refresh_preview(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_at timestamptz;
  v_sender uuid;
  v_preview text;
begin
  select id, created_at, sender_id, left(coalesce(content, ''), 120)
    into v_id, v_at, v_sender, v_preview
  from messages
  where conversation_id = p_conversation_id and deleted_at is null
  order by created_at desc, id desc
  limit 1;

  update conversations
  set last_message_at = v_at,
      last_message_preview = v_preview,
      last_message_sender_id = v_sender,
      updated_at = now()
  where id = p_conversation_id;
end;
$$;
grant execute on function public.nx_enlace_refresh_preview(uuid) to authenticated;

-- ── 2. RPC: editar mensaje (solo texto, solo autor, no-eliminado) ──
create or replace function public.nx_enlace_edit_message(p_message_id uuid, p_content text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_sender uuid;
  v_type text;
  v_conv uuid;
  v_deleted_at timestamptz;
  v_clean text := nullif(trim(coalesce(p_content, '')), '');
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'no-auth');
  end if;

  select sender_id, type, conversation_id, deleted_at
    into v_sender, v_type, v_conv, v_deleted_at
  from messages
  where id = p_message_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no-existe');
  end if;
  if v_deleted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'eliminado');
  end if;
  if v_sender <> v_me then
    return jsonb_build_object('ok', false, 'error', 'no-autor');
  end if;
  if v_type <> 'text' then
    return jsonb_build_object('ok', false, 'error', 'tipo');
  end if;
  if v_clean is null then
    return jsonb_build_object('ok', false, 'error', 'vacio');
  end if;

  update messages set content = v_clean, edited = true
    where id = p_message_id;

  perform public.nx_enlace_refresh_preview(v_conv);

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.nx_enlace_edit_message(uuid, text) to authenticated;

-- ── 3. RPC: eliminar mensaje (borrado suave, solo autor) ─────────
-- Los mensajes del sistema no se pueden eliminar (los crea el servidor,
-- nunca un usuario). Si el mensaje estaba fijado, se desfija al borrarlo
-- para que el panel no quede apuntando a un mensaje eliminado.
create or replace function public.nx_enlace_delete_message(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_sender uuid;
  v_type text;
  v_conv uuid;
  v_deleted_at timestamptz;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'no-auth');
  end if;

  select sender_id, type, conversation_id, deleted_at
    into v_sender, v_type, v_conv, v_deleted_at
  from messages
  where id = p_message_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no-existe');
  end if;
  if v_deleted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'eliminado');
  end if;
  if v_sender <> v_me then
    return jsonb_build_object('ok', false, 'error', 'no-autor');
  end if;
  if v_type not in ('text', 'image', 'file') then
    return jsonb_build_object('ok', false, 'error', 'tipo');
  end if;

  update messages set deleted_at = now(), content = null
    where id = p_message_id;

  -- Desfijar si era el mensaje fijado de su conversación.
  update conversations
    set pinned_message_id = null, pinned_by = null, pinned_at = null
  where pinned_message_id = p_message_id;

  perform public.nx_enlace_refresh_preview(v_conv);

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.nx_enlace_delete_message(uuid) to authenticated;
