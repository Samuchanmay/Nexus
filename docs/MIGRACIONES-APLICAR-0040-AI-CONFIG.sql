-- ═══════════════════════════════════════════════════════════════════
--  EMET — MIGRACIÓN 0040 — Configuración de IA (API keys)
--  ═══════════════════════════════════════════════════════════════════
--  Qué hace (Fase 5 del chat):
--   1. Guarda las API keys de IA en app_settings (OpenAI, Anthropic,
--      OpenRouter) con prefijo "ai_" para distinguirlas.
--   2. RPCs nx_get_ai_config() y nx_set_ai_config(key, value) para
--      leer/escribir la configuración (solo admin).
--   3. Tabla message_embeddings para búsqueda semántica (requiere
--      pgvector habilitado en Supabase; si no está, la tabla se crea
--      sin columna vector y la búsqueda semántica no estará disponible).
--   4. RPC nx_search_messages_semantic() para buscar mensajes por
--      similitud de embeddings (requiere pgvector).
--
--  Cómo aplicar: pegar TODO en el SQL Editor de emet.uno y ejecutar
--  (idempotente, se puede re-ejecutar sin riesgo). Depende de que ya
--  estén aplicadas 0001-0039.
--
--  IMPORTANTE: Si quieres habilitar búsqueda semántica, primero debes
--  habilitar pgvector en Supabase:
--  Dashboard → Database → Extensions → Buscar "vector" → Enable
--  ═══════════════════════════════════════════════════════════════════

-- ── 1. Insertar settings iniciales (si no existen) ─────────────────
-- OpenAI
INSERT INTO app_settings (key, value, updated_at)
VALUES 
  ('ai_openai_api_key', ''),
  ('ai_openai_model', 'gpt-4o-mini'),
  ('ai_openai_embeddings_model', 'text-embedding-3-small')
ON CONFLICT (key) DO NOTHING;

-- Anthropic
INSERT INTO app_settings (key, value, updated_at)
VALUES 
  ('ai_anthropic_api_key', ''),
  ('ai_anthropic_model', 'claude-3-5-sonnet-20241022')
ON CONFLICT (key) DO NOTHING;

-- OpenRouter (proxy unificado)
INSERT INTO app_settings (key, value, updated_at)
VALUES 
  ('ai_openrouter_api_key', ''),
  ('ai_openrouter_model', 'openai/gpt-4o-mini')
ON CONFLICT (key) DO NOTHING;

-- Provider activo (cual de los 3 se usa para resúmenes)
INSERT INTO app_settings (key, value, updated_at)
VALUES ('ai_provider', 'openai')
ON CONFLICT (key) DO NOTHING;

-- ── 2. RPC: obtener configuración de IA (solo admin) ───────────────
create or replace function nx_get_ai_config()
returns table (key text, value text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if my_role() <> 'admin' then
    raise exception 'Solo administradores pueden ver la configuración de IA';
  end if;
  
  return query
  select s.key, s.value
  from app_settings s
  where s.key like 'ai_%'
  order by s.key;
end;
$$;
grant execute on function nx_get_ai_config() to authenticated;

-- ── 3. RPC: actualizar configuración de IA (solo admin) ────────────
create or replace function nx_set_ai_config(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if my_role() <> 'admin' then
    raise exception 'Solo administradores pueden cambiar la configuración de IA';
  end if;
  
  if p_key not like 'ai_%' then
    raise exception 'Key inválida (debe empezar con "ai_")';
  end if;
  
  insert into app_settings (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at;
end;
$$;
grant execute on function nx_set_ai_config(text, text) to authenticated;

-- ── 4. Tabla para embeddings de mensajes (búsqueda semántica) ──────
-- Si pgvector está disponible, crea la tabla con columna vector.
-- Si no, crea la tabla sin columna vector (fallback a búsqueda por texto).

DO $$
BEGIN
  -- Intentar crear la extensión pgvector
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector no está disponible, búsqueda semántica usará fallback por texto';
  END;
  
  -- Crear tabla de embeddings
  CREATE TABLE IF NOT EXISTS message_embeddings (
    message_id uuid PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    content_hash text NOT NULL,
    embedding vector(1536), -- 1536 dimensiones para text-embedding-3-small
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  
  -- Índice para búsqueda por similitud coseno
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_message_embeddings_embedding 
    ON message_embeddings 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo crear índice IVFFlat (pgvector no disponible o tabla vacía)';
  END;
  
  -- Índice para búsqueda por hash (deduplicación)
  CREATE INDEX IF NOT EXISTS idx_message_embeddings_content_hash 
  ON message_embeddings(content_hash);
END $$;

-- ── 5. RPC: buscar mensajes por similitud semántica ────────────────
create or replace function nx_search_messages_semantic(
  p_query_embedding vector(1536),
  p_conversation_id uuid default null,
  p_limit integer default 20
)
returns table (
  message_id uuid,
  conversation_id uuid,
  content text,
  sender_id uuid,
  created_at timestamptz,
  similarity double precision
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    me.message_id,
    m.conversation_id,
    m.content,
    m.sender_id,
    m.created_at,
    1 - (me.embedding <=> p_query_embedding) as similarity
  from message_embeddings me
  join messages m on m.id = me.message_id
  where (p_conversation_id is null or m.conversation_id = p_conversation_id)
    and exists (
      select 1 from conversation_participants cp
      where cp.conversation_id = m.conversation_id
        and cp.user_id = my_user_id()
    )
  order by me.embedding <=> p_query_embedding
  limit p_limit;
end;
$$;
grant execute on function nx_search_messages_semantic(vector(1536), uuid, integer) to authenticated;

-- Verificación:
--   select * from nx_get_ai_config();
--   select nx_set_ai_config('ai_openai_api_key', 'sk-...');
--   select * from message_embeddings limit 5;
