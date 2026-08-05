-- ═══════════════════════════════════════════════════════════════════
--  EMET — MIGRACIÓN 0036 — Búsqueda cross-conversación del chat
--  ═══════════════════════════════════════════════════════════════════
--  Hace la búsqueda de mensajes entre TODAS tus conversaciones rápida y
--  con resultados enriquecidos:
--   1. índice GIN trigram sobre messages.content → ILIKE '%...%' usa el
--      índice en vez de barrer todo el historial (crece con el uso).
--   2. RPC nx_search_messages → un solo round-trip con remitente y
--      conversación pre-unidos (el cliente ya no hace 2-3 consultas).
--
--  Aplicar en el SQL Editor de emet.uno: pegar y ejecutar (idempotente).
--  Independiente de 0025-0035; puede aplicarse en cualquier orden.
--  ═══════════════════════════════════════════════════════════════════

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

-- Verificación (debe devolver filas si el usuario es participante):
--   select * from nx_search_messages('hola', 5);
