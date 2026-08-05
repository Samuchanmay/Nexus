-- ═══════════════════════════════════════════════════════════════════
--  0036 — Chat: búsqueda cross-conversación (RPC + índice trigram)
--  ═══════════════════════════════════════════════════════════════════
--  Aditivo. Cierra la búsqueda cross-conversación de la Fase 3:
--   - índice GIN trigram sobre messages.content: acelera ILIKE '%...%'
--     (que de otra forma es un seq scan sobre todo el historial).
--   - RPC nx_search_messages: devuelve mensajes de TODAS las
--     conversaciones del usuario, pre-unidos al remitente y a la
--     conversación (un solo round-trip, sin joins en el cliente).
--  RLS: security definer — la membresía se exige de forma explícita con
--  el join a conversation_participants (mismo criterio que las funciones
--  nx_enlace_* de 0015).
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm;

create index if not exists messages_content_trgm_idx
  on public.messages using gin (content gin_trgm_ops);

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
  -- Escapa % y _ para que el usuario busque literales, no comodines SQL
  -- (y la barra invertida para poder escapar la propia barra).
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
  order by m.created_at desc
  limit p_limit;
end;
$$;

grant execute on function nx_search_messages(text, integer) to authenticated;
