-- ═══════════════════════════════════════════════════════════════════
--  EMET — MIGRACIÓN 0037 — Recibos de lectura ("Leído por …") + "Eliminar para mí"
--  ═══════════════════════════════════════════════════════════════════
--  Qué hace (Fase 3 del chat):
--   1. message_reads — un renglón por (mensaje, lector). En grupos, las
--      burbujas propias muestran "Leído por Ana, Luis +3" bajo la hora.
--      En directas NO cambia nada: siguen usando el ✓✓ con hora (0025).
--   2. message_hidden — "Eliminar para mí": el mensaje deja de verse SOLO
--      para quien lo oculta (la política RLS de messages lo excluye de
--      todos los SELECTs: feed, scroll, búsqueda y fijado). Los demás lo
--      siguen viendo. "Eliminar para todos" (0021) no se toca.
--
--  Cómo aplicar: pegar TODO en el SQL Editor de emet.uno y ejecutar
--  (idempotente, se puede re-ejecutar sin riesgo). Depende de que ya
--  estén aplicadas 0011, 0013, 0025 y 0036.
--  ═══════════════════════════════════════════════════════════════════

-- ── 1. Tabla message_reads (recibos por miembro) ──────────────────
create table if not exists public.message_reads (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);

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

-- ── 2. Tabla message_hidden ("Eliminar para mí") ──────────────────
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

-- ── 3. Realtime (para que "Leído por" se actualice en vivo) ───────
alter publication supabase_realtime add table public.message_reads;
alter publication supabase_realtime add table public.message_hidden;
alter table public.message_reads replica identity full;
alter table public.message_hidden replica identity full;

-- ── 4. RPC: marcar un lote de mensajes como leídos ────────────────
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

-- ── 5. RPC: recibos por lote (para "Leído por …") ─────────────────
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

-- ── 6. RPC: ocultar / restaurar para mí ───────────────────────────
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

-- ── 7. messages_select: los mensajes ocultados ya no se devuelven ─
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

-- ── 8. La búsqueda también respeta lo ocultado ────────────────────
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

-- Verificaciones (debe devolver filas solo si el usuario es participante):
--   select * from nx_enlace_message_reads(array['<id-de-mensaje>']::uuid[]);
--   select * from nx_enlace_mark_messages_read(array['<id-de-mensaje>']::uuid[]);
--   select * from nx_enlace_hide_message('<id-de-mensaje>');      -- luego un SELECT de messages ya no lo trae
--   select * from nx_enlace_show_message('<id-de-mensaje>');
--   select * from nx_search_messages('hola', 5);                  -- no devuelve mensajes ocultados
