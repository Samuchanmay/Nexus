-- ═══════════════════════════════════════════════════════════════════
--  0037 — Chat: recibos de lectura por miembro ("Leído por …") + "Eliminar para mí"
--  ═══════════════════════════════════════════════════════════════════
--  Contexto (roadmap §Chat, Fase 3): en grupos el ✓✓/read_at de la
--  migración 0025 solo dice "leído", no QUIÉN leyó. Este lote añade:
--   1. `message_reads` — un renglón por (mensaje, lector): alimenta el
--      "Leído por Ana, Luis +3" bajo las burbujas propias en grupos.
--      Complementa, no reemplaza, el tick de `messages.status`/`read_at`
--      (directas siguen usando el ✓✓ con hora).
--   2. `message_hidden` — "Eliminar para mí": borrado suave POR USUARIO.
--      El mensaje deja de verse para quien lo oculta (RLS filtra las
--      selects de messages), pero los demás siguen viéndolo. El autor de
--      un mensaje propio sigue pudiendo borrarlo "para todos" (0021).
--  Aditivo e idempotente. Depende de: 0011 (messages_select), 0013
--  (schema chat), 0025 (read_at), 0036 (nx_search_messages).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tabla message_reads ─────────────────────────────────────────
-- PK (message_id, user_id): un lector, una marca por mensaje. El autor no
-- se registra (nadie "lee" su propio mensaje). user_id referencia `users`
-- (la tabla de app, igual que message_reactions), NO auth.users.
create table if not exists public.message_reads (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- RLS: solo se pueden VER los recibos de mensajes de conversaciones en
-- las que se participa. Las inserciones van por RPC (security definer).
alter table public.message_reads enable row level security;

create policy message_reads_select on public.message_reads
  for select to authenticated
  using (
    exists (
      select 1 from messages m
      join conversation_participants cp
        on cp.conversation_id = m.conversation_id
      where m.id = message_reads.message_id
        and cp.user_id = my_user_id()
    )
  );

-- ── 2. Tabla message_hidden ────────────────────────────────────────
-- "Eliminar para mí": quién ocultó qué mensaje. Solo el propio usuario
-- ve (y toca) sus renglones.
create table if not exists public.message_hidden (
  user_id    uuid not null references public.users (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  hidden_at  timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table public.message_hidden enable row level security;

create policy message_hidden_select on public.message_hidden
  for select to authenticated
  using (user_id = my_user_id());

-- ── 3. Realtime ────────────────────────────────────────────────────
-- "Leído por" debe actualizarse en vivo cuando otro miembro abre el chat.
-- REPLICA IDENTITY FULL porque los eventos se filtran por columnas no-PK
-- (message_id, user_id) — mismo criterio que la migración 0026.
alter publication supabase_realtime add table public.message_reads;
alter publication supabase_realtime add table public.message_hidden;
alter table public.message_reads replica identity full;
alter table public.message_hidden replica identity full;

-- ── 4. RPC: marcar lote leído (reemplaza el bucle de nx_enlace_mark_read
--          que el cliente hacía por mensaje) ─────────────────────────
-- Para cada id del lote:
--   · si el llamador es participante y no el autor → inserta su recibo en
--     message_reads (idempotente: on conflict do nothing);
--   · transiciona el mensaje a 'read' con hora (mismo efecto que 0025 para
--     el ✓✓ del remitente en directas), solo si es participante.
create or replace function nx_enlace_mark_messages_read(p_message_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
begin
  insert into message_reads (message_id, user_id)
  select m.id, v_me
  from messages m
  where m.id = any(p_message_ids)
    and m.sender_id <> v_me
    and exists (
      select 1 from conversation_participants cp
      where cp.conversation_id = m.conversation_id and cp.user_id = v_me
    )
  on conflict (message_id, user_id) do nothing;

  update messages
    set status = 'read',
        read_at = coalesce(read_at, now())
    where id = any(p_message_ids)
      and status in ('sent', 'delivered')
      and exists (
        select 1 from conversation_participants cp
        where cp.conversation_id = messages.conversation_id and cp.user_id = v_me
      );
end;
$$;
grant execute on function nx_enlace_mark_messages_read(uuid[]) to authenticated;

-- ── 5. RPC: recibos por lote (para "Leído por …") ──────────────────
-- Devuelve SOLO los recibos de mensajes en conversaciones del llamador
-- (el RLS de message_reads_select ya lo garantiza, esto lo mantiene
-- explícito para el cliente sin depender solo de políticas).
create or replace function nx_enlace_message_reads(p_message_ids uuid[])
returns table (
  message_id uuid,
  user_id    uuid,
  read_at    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
begin
  return query
  select r.message_id, r.user_id, r.read_at
  from message_reads r
  join messages m on m.id = r.message_id
  join conversation_participants cp
    on cp.conversation_id = m.conversation_id and cp.user_id = v_me
  where r.message_id = any(p_message_ids);
end;
$$;
grant execute on function nx_enlace_message_reads(uuid[]) to authenticated;

-- ── 6. RPC: ocultar / restaurar para mí ────────────────────────────
-- Solo un participante de la conversación puede ocultar un mensaje suyo
-- (idempotente) o restaurarlo. El RLS de message_hidden garantiza que
-- nunca toque renglones ajenos.
create or replace function nx_enlace_hide_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
begin
  insert into message_hidden (user_id, message_id)
  select v_me, m.id
  from messages m
  where m.id = p_message_id
    and exists (
      select 1 from conversation_participants cp
      where cp.conversation_id = m.conversation_id and cp.user_id = v_me
    )
  on conflict (user_id, message_id) do nothing;
end;
$$;
grant execute on function nx_enlace_hide_message(uuid) to authenticated;

create or replace function nx_enlace_show_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from message_hidden
    where user_id = my_user_id() and message_id = p_message_id;
end;
$$;
grant execute on function nx_enlace_show_message(uuid) to authenticated;

-- ── 7. messages_select: excluir lo que oculté para mí ──────────────
-- Se recrea la política de 0011 añadiendo `message_hidden`: cualquier
-- SELECT de messages (feed del servidor, loadMore, jump de búsqueda,
-- fijado, etc.) ya no devuelve los mensajes que este usuario ocultó.
-- No afecta a los demás usuarios (el filtro es por my_user_id()).
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from conversation_participants
      where conversation_id = messages.conversation_id and user_id = my_user_id()
    )
    and not exists (
      select 1 from message_hidden h
      where h.message_id = messages.id and h.user_id = my_user_id()
    )
  );

-- ── 8. nx_search_messages: también respeta lo ocultado ─────────────
-- La búsqueda cross-conversación (0036) es security definer y salta el
-- RLS, así que el filtro de message_hidden va explícito en la query.
create or replace function nx_search_messages(p_query text, p_limit integer default 30)
returns table (
  message_id uuid,
  conversation_id uuid,
  content text,
  sender_id uuid,
  sender_name text,
  created_at timestamptz,
  conversation_type text,
  conversation_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_pattern text;
begin
  v_pattern := '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    m.id                        as message_id,
    m.conversation_id,
    m.content,
    m.sender_id,
    coalesce(u.display_name, 'Alguien') as sender_name,
    m.created_at,
    c.type                      as conversation_type,
    c.name                      as conversation_name
  from messages m
  join conversation_participants cp
    on cp.conversation_id = m.conversation_id
   and cp.user_id = v_me
  join conversations c on c.id = m.conversation_id
  left join users_directory u on u.id = m.sender_id
  where m.content ilike v_pattern escape '\'
    and m.type = 'text'
    and m.deleted_at is null
    and not exists (
      select 1 from message_hidden h
      where h.message_id = m.id and h.user_id = v_me
    )
  order by m.created_at desc
  limit p_limit;
end;
$$;

grant execute on function nx_search_messages(text, integer) to authenticated;
