-- ═══════════════════════════════════════════════════════════════════
--  0031 — Sincronización bidireccional con Google Calendar
--  ═══════════════════════════════════════════════════════════════════
--  Fase 3: Permite sincronizar eventos institucionales con Google Calendar
--  
--  Cambios:
--   1. Agregar campos de sincronización a institutional_events
--   2. Crear tabla para mapear eventos Emet ↔ Google Calendar
--   3. Crear tabla para webhooks de Google Calendar
--
--  Aditivo e idempotente. No rompe datos existentes.
--  Depende de: 0028 (institutional_events ampliado), google_oauth_tokens
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Campos de sincronización en institutional_events ───────────
-- sync_to_google: si true, sincronizar con Google Calendar
alter table institutional_events
  add column if not exists sync_to_google boolean not null default false;

-- google_calendar_id: ID del calendario de Google destino (opcional)
-- Si es null, usa el calendario principal del admin
alter table institutional_events
  add column if not exists google_calendar_id text;

-- ── 2. Tabla de mapeo eventos Emet ↔ Google Calendar ──────────────
-- Guarda el ID del evento en Google Calendar para poder actualizar/eliminar
create table if not exists event_google_mapping (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references institutional_events(id) on delete cascade,
  google_event_id text not null, -- ID del evento en Google Calendar
  google_calendar_id text not null, -- ID del calendario en Google
  synced_at timestamptz not null default now(),
  last_sync_status text, -- 'success' | 'error' | 'pending'
  last_error text,
  
  unique(event_id, google_calendar_id)
);

create index if not exists idx_event_google_mapping_event
  on event_google_mapping(event_id);

create index if not exists idx_event_google_mapping_google
  on event_google_mapping(google_event_id, google_calendar_id);

comment on table event_google_mapping is 'Mapeo entre eventos Emet y Google Calendar';
comment on column event_google_mapping.google_event_id is 'ID del evento en Google Calendar';
comment on column event_google_mapping.last_sync_status is 'Estado de la última sincronización';

-- RLS: solo admins pueden gestionar el mapeo
alter table event_google_mapping enable row level security;

drop policy if exists "Event google mapping admin all" on event_google_mapping;
create policy "Event google mapping admin all"
  on event_google_mapping for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- ── 3. Tabla de webhooks de Google Calendar ───────────────────────
-- Registra los webhooks activos para recibir cambios de Google
create table if not exists google_calendar_webhooks (
  id uuid primary key default gen_random_uuid(),
  calendar_id text not null, -- ID del calendario en Google
  channel_id text not null, -- ID del canal de notificación
  resource_id text not null, -- ID del recurso en Google
  expiration timestamptz not null, -- Cuándo expira el webhook
  admin_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  
  unique(calendar_id, admin_id)
);

create index if not exists idx_google_webhooks_channel
  on google_calendar_webhooks(channel_id);

create index if not exists idx_google_webhooks_expiration
  on google_calendar_webhooks(expiration);

comment on table google_calendar_webhooks is 'Webhooks activos para recibir cambios de Google Calendar';
comment on column google_calendar_webhooks.channel_id is 'ID del canal de notificación de Google';
comment on column google_calendar_webhooks.expiration is 'Cuándo expira el webhook (Google los renueva automáticamente)';

-- RLS: solo admins pueden gestionar webhooks
alter table google_calendar_webhooks enable row level security;

drop policy if exists "Google webhooks admin all" on google_calendar_webhooks;
create policy "Google webhooks admin all"
  on google_calendar_webhooks for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- ── 4. Tabla de logs de sincronización ────────────────────────────
-- Registra todos los intentos de sincronización para debugging
create table if not exists google_sync_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references institutional_events(id) on delete set null,
  action text not null, -- 'create' | 'update' | 'delete' | 'webhook_received'
  direction text not null, -- 'emet_to_google' | 'google_to_emet'
  status text not null, -- 'success' | 'error'
  details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_google_sync_logs_event
  on google_sync_logs(event_id);

create index if not exists idx_google_sync_logs_created
  on google_sync_logs(created_at desc);

comment on table google_sync_logs is 'Logs de sincronización con Google Calendar';

-- RLS: solo admins pueden ver los logs
alter table google_sync_logs enable row level security;

drop policy if exists "Google sync logs admin all" on google_sync_logs;
create policy "Google sync logs admin all"
  on google_sync_logs for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- ── 5. Función helper: obtener mapeo de evento ────────────────────
create or replace function get_event_google_mapping(p_event_id uuid)
returns table (
  google_event_id text,
  google_calendar_id text,
  synced_at timestamptz,
  last_sync_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select egm.google_event_id, egm.google_calendar_id, egm.synced_at, egm.last_sync_status
  from event_google_mapping egm
  where egm.event_id = p_event_id;
end;
$$;

grant execute on function get_event_google_mapping(uuid) to authenticated;
