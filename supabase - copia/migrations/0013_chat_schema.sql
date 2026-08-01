-- ═══════════════════════════════════════════════════════════════════
--  0013 — Chat: Schema (tablas, columnas, constraints, índices)
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: el frontend espera reacciones, adjuntos, estados de
--  mensaje, mute/pin/archive por participante y mensajes fijados.
--  Sin esto TODO el módulo falla (server crash al abrir chat).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Columnas faltantes en conversations ───────────────────────
alter table conversations add column if not exists pinned_message_id uuid references messages(id);
alter table conversations add column if not exists pinned_by uuid references users(id);
alter table conversations add column if not exists pinned_at timestamptz;

-- ── 2. Columnas faltantes en conversation_participants ───────────
alter table conversation_participants add column if not exists muted boolean not null default false;
alter table conversation_participants add column if not exists pinned boolean not null default false;
alter table conversation_participants add column if not exists archived boolean not null default false;
alter table conversation_participants add column if not exists last_read_at timestamptz not null default now();

-- ── 3. Columnas faltantes en messages ───────────────────────────
alter table messages add column if not exists status text not null default 'sent'
  check (status in ('pending', 'sent', 'delivered', 'read', 'failed'));
alter table messages add column if not exists client_id text;

-- Índice único para dedup del outbox (código 23505 en use-outbox.ts)
create unique index if not exists idx_messages_client_id on messages(client_id) where client_id is not null;

-- ── 4. Corregir CHECK constraint de messages.type ───────────────
-- Antes: type in ('text', 'system')
-- Ahora: type in ('text', 'system', 'image', 'file')
alter table messages drop constraint if exists messages_type_check;
alter table messages add constraint messages_type_check
  check (type in ('text', 'system', 'image', 'file'));

-- ── 5. Tabla message_attachments ─────────────────────────────────
create table if not exists message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size integer not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_attachment_message on message_attachments(message_id);

-- ── 6. Tabla message_reactions ───────────────────────────────────
create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references users(id),
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);
create index if not exists idx_reactions_message on message_reactions(message_id);
