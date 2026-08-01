-- ═══════════════════════════════════════════════════════════════════
--  0022 — Chat: stickers, ubicación y cámara (cierre de adjuntos)
--  ═══════════════════════════════════════════════════════════════════
--  Depende de: 0011 (messages), 0013 (messages_type_check), 0014/0020
--  (messages_insert), 0021 (nx_enlace_refresh_preview / delete_message).
--
--  Decisiones de diseño:
--  · `sticker` es un tipo de mensaje propio con el emoji en `content`
--    (no reusa image: los stickers se renderizan como glyph grande, no
--    como archivo en Storage). `location` es un tipo propio con lat/lng
--    en columnas nuevas (el mapa se renderiza por iframe OSM sin API key;
--    el link de Google Maps es una mejora de interacción, no un requisito).
--  · Se amplía messages_type_check y messages_insert para admitir los
--    dos tipos nuevos, conservando la regla de Anuncios (solo admin).
--  · El preview de la lista ahora se deriva del tipo (no solo del texto):
--    un preview honesto — "📍 Ubicación", "Sticker", "📷 Foto" — en vez de
--    texto vacío para los mensajes sin content. Se aplica tanto en el
--    trigger de INSERT como en nx_enlace_refresh_preview (editar/eliminar).
--  · nx_enlace_delete_message admite los tipos nuevos (borrado suave).
--  · La cámara NO introduce tipo nuevo: captura → blob → sube por la
--    tubería de adjuntos existente como image (use-attachment-upload).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Columnas lat/lng en messages ────────────────────────────────
alter table public.messages add column if not exists lat double precision;
alter table public.messages add column if not exists lng double precision;

-- ── 2. Ampliar CHECK de messages.type ──────────────────────────────
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type = any (array['text'::text, 'system'::text, 'image'::text,
                       'file'::text, 'location'::text, 'sticker'::text]));

-- ── 3. Preview honesto por tipo (helper reutilizable) ──────────────
create or replace function public.nx_enlace_preview_for(p_type text, p_content text)
returns text
language sql
immutable
as $function$
  select case p_type
    when 'location' then '📍 Ubicación'
    when 'sticker'  then coalesce(nullif(trim(coalesce(p_content, '')), ''), 'Sticker')
    when 'image'    then '📷 Foto'
    when 'file'     then '📎 Archivo adjunto'
    else left(coalesce(p_content, ''), 120)
  end;
$function$;

-- Trigger de INSERT: usar el helper (antes era solo left(content, 120)).
create or replace function public.nx_enlace_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  update conversations
  set last_message_at = new.created_at,
      last_message_preview = public.nx_enlace_preview_for(new.type, new.content),
      last_message_sender_id = new.sender_id,
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$function$;

-- nx_enlace_refresh_preview: mismo criterio por tipo (0021).
create or replace function public.nx_enlace_refresh_preview(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid;
  v_at timestamptz;
  v_sender uuid;
  v_preview text;
begin
  select id, created_at, sender_id,
         public.nx_enlace_preview_for(type, content)
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
$function$;
grant execute on function public.nx_enlace_refresh_preview(uuid) to authenticated;

-- ── 4. RLS messages_insert con los tipos nuevos ────────────────────
-- Conserva la regla de 0020: en Anuncios solo publica quien tiene rol
-- admin en conversation_participants.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
with check (
  sender_id = my_user_id()
  and type = any (array['text'::text, 'image'::text, 'file'::text,
                        'location'::text, 'sticker'::text])
  and exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = my_user_id()
      and (
        not exists (select 1 from conversations c where c.id = messages.conversation_id and c.type = 'announcement')
        or cp.role = 'admin'
      )
  )
);

-- ── 5. Borrado suave admite los tipos nuevos ───────────────────────
create or replace function public.nx_enlace_delete_message(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
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
  if v_type not in ('text', 'image', 'file', 'location', 'sticker') then
    return jsonb_build_object('ok', false, 'error', 'tipo');
  end if;

  update messages set deleted_at = now(), content = null
    where id = p_message_id;

  update conversations
    set pinned_message_id = null, pinned_by = null, pinned_at = null
  where pinned_message_id = p_message_id;

  perform public.nx_enlace_refresh_preview(v_conv);

  return jsonb_build_object('ok', true);
end;
$function$;
grant execute on function public.nx_enlace_delete_message(uuid) to authenticated;
