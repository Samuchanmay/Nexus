-- ═══════════════════════════════════════════════════════════════════
--  0028 — Eventos ampliados (Fase 1 del plan de eventos)
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: el sistema de eventos actual solo tiene título, tipo,
--  fechas y notas. Esto es insuficiente para el caso de uso real:
--  eventos externos con clientes, departamentos, ubicaciones,
--  responsables, equipos, estados y prioridades.
--
--  Cambios:
--   1. Añadir hora inicio/fin (start_time, end_time)
--   2. Añadir cliente (client_name)
--   3. Añadir departamento solicitante (department_id)
--   4. Añadir ubicación: tipo (interno/externo), nombre, dirección, GPS
--   5. Añadir responsable principal (owner_id)
--   6. Añadir estado (status: pendiente/confirmado/cancelado)
--   7. Añadir prioridad (priority: alta/media/baja)
--   8. Añadir descripción larga (description)
--   9. Añadir historial de cambios (updated_at ya existe implícitamente)
--
--  Aditivo e idempotente. No rompe datos existentes.
--  Depende de: 0008 (institutional_events), 0001 (users, departments).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Hora inicio/fin ────────────────────────────────────────────
-- time sin zona (se interpreta en America/Merida por la app).
-- NULL = evento de todo el día (comportamiento actual).
alter table institutional_events
  add column if not exists start_time time;

alter table institutional_events
  add column if not exists end_time time;

-- ── 2. Cliente ────────────────────────────────────────────────────
-- Texto libre (no catálogo todavía — se puede normalizar después).
alter table institutional_events
  add column if not exists client_name text;

-- ── 3. Departamento solicitante ───────────────────────────────────
-- FK opcional a departments (si existe). Si el departamento se elimina,
-- el evento se conserva con department_id = null.
alter table institutional_events
  add column if not exists department_id uuid references departments(id) on delete set null;

-- ── 4. Ubicación ──────────────────────────────────────────────────
-- location_type: 'interno' (dentro del CERT) o 'externo' (fuera).
-- Por defecto 'interno' para no romper eventos existentes.
alter table institutional_events
  add column if not exists location_type text not null default 'interno'
  check (location_type in ('interno', 'externo'));

-- location_name: nombre del lugar (ej: "Hotel Fiesta Americana").
alter table institutional_events
  add column if not exists location_name text;

-- location_address: dirección completa.
alter table institutional_events
  add column if not exists location_address text;

-- location_coords: coordenadas GPS (lat, lng) para validación.
-- Se guarda como texto "lat,lng" para simplicidad (PostGIS sería overkill).
alter table institutional_events
  add column if not exists location_coords text;

-- location_radius: radio de validación en metros (default 150m).
alter table institutional_events
  add column if not exists location_radius integer not null default 150;

-- allow_any_location: si true, no valida GPS (útil para eventos sin señal).
alter table institutional_events
  add column if not exists allow_any_location boolean not null default false;

-- ── 5. Responsable principal ──────────────────────────────────────
-- FK a users. Si el usuario se elimina, el evento se conserva con null.
alter table institutional_events
  add column if not exists owner_id uuid references users(id) on delete set null;

-- ── 6. Estado ─────────────────────────────────────────────────────
-- status: pendiente, confirmado, cancelado. Default pendiente.
alter table institutional_events
  add column if not exists status text not null default 'pendiente'
  check (status in ('pendiente', 'confirmado', 'cancelado'));

-- ── 7. Prioridad ──────────────────────────────────────────────────
-- priority: alta, media, baja. Default media.
alter table institutional_events
  add column if not exists priority text not null default 'media'
  check (priority in ('alta', 'media', 'baja'));

-- ── 8. Descripción larga ──────────────────────────────────────────
-- description: texto libre para detalles del evento.
alter table institutional_events
  add column if not exists description text;

-- ── 9. Índice para consultas por estado/prioridad ─────────────────
create index if not exists idx_institutional_events_status
  on institutional_events(status);

create index if not exists idx_institutional_events_priority
  on institutional_events(priority);

create index if not exists idx_institutional_events_owner
  on institutional_events(owner_id);

create index if not exists idx_institutional_events_department
  on institutional_events(department_id);

-- ── 10. Comentario de documentación ───────────────────────────────
comment on column institutional_events.start_time is 'Hora de inicio (America/Merida). NULL = todo el día.';
comment on column institutional_events.end_time is 'Hora de fin (America/Merida). NULL = todo el día.';
comment on column institutional_events.client_name is 'Nombre del cliente (texto libre).';
comment on column institutional_events.department_id is 'Departamento solicitante (FK a departments).';
comment on column institutional_events.location_type is 'interno (CERT) o externo (fuera).';
comment on column institutional_events.location_name is 'Nombre del lugar (ej: Hotel Fiesta Americana).';
comment on column institutional_events.location_address is 'Dirección completa.';
comment on column institutional_events.location_coords is 'Coordenadas GPS "lat,lng" para validación.';
comment on column institutional_events.location_radius is 'Radio de validación GPS en metros (default 150).';
comment on column institutional_events.allow_any_location is 'Si true, no valida GPS (eventos sin señal).';
comment on column institutional_events.owner_id is 'Responsable principal del evento.';
comment on column institutional_events.status is 'pendiente, confirmado, cancelado.';
comment on column institutional_events.priority is 'alta, media, baja.';
comment on column institutional_events.description is 'Descripción larga del evento.';
