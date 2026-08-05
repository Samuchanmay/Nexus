-- =====================================================================
-- EMET (emet.uno) - MIGRACIONES PENDIENTES 0025-0034
-- Aplicar TODO en el SQL Editor de Supabase, en este orden, en UNA sola
-- ejecucion. Cada bloque es independiente (aditivo/idempotente).
-- Fecha: 2026-08-05
-- =====================================================================


-- ==================== INICIO 0025_chat_mute_duration_read_at.sql ====================
-- ═══════════════════════════════════════════════════════════════════
--  0025 — Chat: silencio por duración + hora de lectura
--  ═══════════════════════════════════════════════════════════════════
--  Contexto (roadmap §Chat, bloque "plataforma de mensajería moderna"):
--   1. Silencio por duración (8h / 1 semana / siempre). Hoy `muted` es un
--      booleano; se añade `muted_until timestamptz` y dos RPCs nuevos:
--      `nx_enlace_set_mute` (con vencimiento opcional) y `nx_enlace_unmute`.
--      Un participante se considera silenciado si `muted` es true O si
--      `muted_until` está en el futuro — el push (send-chat-push) y el
--      watcher de no-leídos deben replicar ese criterio.
--   2. Hora de la lectura: `messages` no guardaba cuándo se leyó; se añade
--      `read_at timestamptz` y `nx_enlace_mark_read` lo rellena al
--      transicionar a `read`, para poder exponer "Leído · HH:MM" en la UI.
--  Aditivo e idempotente. Depende de: 0013 (schema chat), 0015 (RPCs).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Columnas nuevas ──────────────────────────────────────────────
alter table conversation_participants
  add column if not exists muted_until timestamptz;

alter table messages
  add column if not exists read_at timestamptz;

-- ── 2. RPC: silenciar con vencimiento ───────────────────────────────
-- p_until = NULL  → silenciar para siempre (mismo efecto que el toggle
--                   histórico, `muted` queda true).
-- p_until futuro   → silenciar hasta esa fecha/hora (`muted_until`).
create or replace function nx_enlace_set_mute(p_conversation_id uuid, p_until timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversation_participants
    set muted = (p_until is null),
        muted_until = p_until
    where conversation_id = p_conversation_id and user_id = my_user_id();
end;
$$;
grant execute on function nx_enlace_set_mute(uuid, timestamptz) to authenticated;

-- ── 3. RPC: desactivar el silencio (limpia ambos campos) ────────────
create or replace function nx_enlace_unmute(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversation_participants
    set muted = false, muted_until = null
    where conversation_id = p_conversation_id and user_id = my_user_id();
end;
$$;
grant execute on function nx_enlace_unmute(uuid) to authenticated;

-- ── 4. RPC: mark read ahora registra la hora ────────────────────────
create or replace function nx_enlace_mark_read(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update messages
    set status = 'read',
        read_at = coalesce(read_at, now())
    where id = p_message_id
      and status in ('sent', 'delivered');
end;
$$;
grant execute on function nx_enlace_mark_read(uuid) to authenticated;
-- ===================== FIN 0025_chat_mute_duration_read_at.sql =====================


-- ==================== INICIO 0026_chat_realtime_publication_fix.sql ====================
-- ═══════════════════════════════════════════════════════════════════
--  0026 — Chat: arreglo de Realtime (publicación + REPLICA IDENTITY)
--  ═══════════════════════════════════════════════════════════════════
--  Síntoma: los mensajes y los estados (ticks de lectura, mute, pin,
--  archivar) solo llegan al recargar la página, nunca en vivo.
--
--  Causa raíz (documentada en el código y en la guía oficial de Supabase
--  "Realtime + postgres_changes"):
--   1. `conversation_participants` nunca se agregó a la publicación
--      `supabase_realtime` (0011/0016 solo cubren messages, conversations,
--      message_attachments, message_reactions). El canal `enlace-unread`
--      del layout escucha UPDATE en esa tabla con filtro `user_id=eq.…`
--      → ese canal nunca entrega nada.
--   2. Los eventos UPDATE/DELETE con FILTRO sobre una columna que no es la
--      PK (p. ej. `conversation_id=eq.X` para los ticks de lectura, o
--      `user_id=eq.X` en conversation_participants) exigen
--      `REPLICA IDENTITY FULL`: sin ello, Realtime no puede evaluar el
--      filtro contra la fila vieja y DESCARTÁ silenciosamente el evento.
--      El INSERT de mensajes sí funciona sin esto (fila nueva completa),
--      pero los ticks ✓✓→leído, editar/eliminar en vivo y el conteo de
--      no-leídos no.
--
--  Fix (configuración recomendada por Supabase para filtros en
--  postgres_changes). Aditivo e idempotente. Depende de: 0011, 0016.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Publicación: cubrir TODAS las tablas que el chat escucha ─────
-- (idempotente: añadir una tabla ya publicada no falla, y una tabla que
--  no existe todavía se cubrirá con la migración que la cree).
alter publication supabase_realtime add table conversation_participants;
alter publication supabase_realtime add table push_subscriptions;

-- ── 2. REPLICA IDENTITY FULL ────────────────────────────────────────
-- Necesario para que Realtime entregue los UPDATE/DELETE filtrados por
-- columnas no-PK (message_id, conversation_id, user_id, etc.).
alter table messages replica identity full;
alter table conversations replica identity full;
alter table conversation_participants replica identity full;
alter table message_attachments replica identity full;
alter table message_reactions replica identity full;
alter table push_subscriptions replica identity full;
-- ===================== FIN 0026_chat_realtime_publication_fix.sql =====================


-- ==================== INICIO 0027_attendance_corrections_history.sql ====================
-- ═══════════════════════════════════════════════════════════════════
--  0027 — Historial de correcciones de asistencia por admin
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: el admin puede corregir entrada/salida cuando el empleado
--  olvidó marcar. Esta tabla registra quién corrigió, cuándo, qué cambió
--  y el motivo. Nunca se sobrescribe el registro original — solo se
--  agregan nuevos movimientos + entrada en este historial.
--  Aditivo e idempotente.
-- ═══════════════════════════════════════════════════════════════════

-- Tabla de historial de correcciones
create table if not exists attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  admin_id uuid not null references users(id) on delete cascade,
  action text not null, -- "Agregó entrada", "Agregó salida", "Agregó entrada y salida"
  details text, -- "Entrada: 08:00, Salida: 17:00. Motivo: Olvidó registrar"
  created_at timestamptz not null default now()
);

-- Índice para consultar historial por usuario/fecha
create index if not exists idx_attendance_corrections_user_date
  on attendance_corrections(user_id, date desc);

-- RLS: solo admins pueden insertar/ver correcciones
alter table attendance_corrections enable row level security;

drop policy if exists "Admins pueden insertar correcciones" on attendance_corrections;
create policy "Admins pueden insertar correcciones"
  on attendance_corrections for insert
  to authenticated
  with check (
    exists (
      select 1 from users
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Admins pueden ver correcciones" on attendance_corrections;
create policy "Admins pueden ver correcciones"
  on attendance_corrections for select
  to authenticated
  using (
    exists (
      select 1 from users
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Empleados pueden ver sus propias correcciones" on attendance_corrections;
create policy "Empleados pueden ver sus propias correcciones"
  on attendance_corrections for select
  to authenticated
  using (user_id = auth.uid());
-- ===================== FIN 0027_attendance_corrections_history.sql =====================


-- ==================== INICIO 0028_events_extended.sql ====================
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
-- ===================== FIN 0028_events_extended.sql =====================


-- ==================== INICIO 0029_event_participants_attendance.sql ====================
-- ═══════════════════════════════════════════════════════════════════
--  0029 — Participantes y asistencia en eventos
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: los eventos necesitan participantes (responsable + equipo)
--  y asistencia vinculada al evento (no a la oficina). Esto permite:
--   - Asignar responsable principal y equipo
--   - Cada participante hace su propio check-in/out
--   - La asistencia se registra en event_attendance (separada de attendance)
--   - GPS valida contra ubicación del evento (no de la oficina)
--
--  Tablas nuevas:
--   1. event_participants (responsable + equipo asignado)
--   2. event_attendance (check-in/out en eventos)
--   3. event_history (historial de cambios en eventos)
--
--  Aditivo e idempotente. No rompe datos existentes.
--  Depende de: 0028 (institutional_events ampliado), 0001 (users).
-- ═══════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  1. event_participants — quién está asignado a cada evento
-- ══════════════════════════════════════════════════════════════════
create table if not exists event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references institutional_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'participante' check (role in ('responsable', 'participante')),
  status text not null default 'pendiente' check (status in ('pendiente', 'confirmado', 'cancelado')),
  notified_at timestamptz, -- cuándo se le notificó
  created_at timestamptz not null default now(),

  -- Un usuario solo puede tener un rol por evento
  unique(event_id, user_id)
);

-- Índices para consultas comunes
create index if not exists idx_event_participants_event
  on event_participants(event_id);

create index if not exists idx_event_participants_user
  on event_participants(user_id);

create index if not exists idx_event_participants_status
  on event_participants(status);

comment on table event_participants is 'Participantes asignados a eventos (responsable + equipo).';
comment on column event_participants.role is 'responsable (1 por evento) o participante (N).';
comment on column event_participants.status is 'pendiente, confirmado, cancelado.';

-- RLS: solo admins pueden insertar/actualizar/eliminar
alter table event_participants enable row level security;

drop policy if exists "Event participants admin all" on event_participants;
create policy "Event participants admin all"
  on event_participants for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- Todos los autenticados pueden leer (para ver quién está asignado)
drop policy if exists "Event participants read" on event_participants;
create policy "Event participants read"
  on event_participants for select to authenticated
  using (true);

-- ══════════════════════════════════════════════════════════════════
--  2. event_attendance — check-in/out en eventos
-- ══════════════════════════════════════════════════════════════════
-- Separada de attendance (oficina) para no mezclar conceptos.
create table if not exists event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references institutional_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  check_in_at timestamptz, -- cuándo inició cobertura
  check_out_at timestamptz, -- cuándo finalizó cobertura
  check_in_location text, -- "oficina" | "evento" | "remoto"
  check_in_coords text, -- "lat,lng" del GPS al hacer check-in
  check_in_distance_m integer, -- distancia a la ubicación del evento
  notes text, -- notas del check-in
  created_at timestamptz not null default now(),

  -- Un usuario solo puede tener un registro de asistencia por evento
  unique(event_id, user_id)
);

-- Índices para consultas comunes
create index if not exists idx_event_attendance_event
  on event_attendance(event_id);

create index if not exists idx_event_attendance_user
  on event_attendance(user_id);

create index if not exists idx_event_attendance_check_in
  on event_attendance(check_in_at);

comment on table event_attendance is 'Check-in/out de participantes en eventos.';
comment on column event_attendance.check_in_location is 'oficina, evento o remoto.';
comment on column event_attendance.check_in_coords is 'Coordenadas GPS del check-in.';
comment on column event_attendance.check_in_distance_m is 'Distancia a la ubicación del evento (metros).';

-- RLS: participantes pueden insertar su propio check-in, admin puede todo
alter table event_attendance enable row level security;

drop policy if exists "Event attendance admin all" on event_attendance;
create policy "Event attendance admin all"
  on event_attendance for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- Participantes pueden insertar su propio check-in
drop policy if exists "Event attendance participant insert" on event_attendance;
create policy "Event attendance participant insert"
  on event_attendance for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from event_participants
      where event_id = event_attendance.event_id
        and user_id = auth.uid()
        and status = 'confirmado'
    )
  );

-- Participantes pueden leer su propia asistencia y la de su equipo
drop policy if exists "Event attendance read" on event_attendance;
create policy "Event attendance read"
  on event_attendance for select to authenticated
  using (
    user_id = auth.uid()
    or public.my_role() = 'admin'
    or exists (
      select 1 from event_participants
      where event_id = event_attendance.event_id
        and user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════
--  3. event_history — historial de cambios en eventos
-- ══════════════════════════════════════════════════════════════════
-- Registra quién cambió qué, cuándo y por qué. Nunca se elimina.
create table if not exists event_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references institutional_events(id) on delete cascade,
  admin_id uuid not null references users(id) on delete set null,
  action text not null, -- "Creó evento", "Cambió responsable", "Canceló evento", etc.
  details text, -- detalles del cambio (JSON o texto)
  created_at timestamptz not null default now()
);

-- Índices para consultas comunes
create index if not exists idx_event_history_event
  on event_history(event_id);

create index if not exists idx_event_history_admin
  on event_history(admin_id);

create index if not exists idx_event_history_created
  on event_history(created_at desc);

comment on table event_history is 'Historial de cambios en eventos (auditoría).';
comment on column event_history.action is 'Descripción de la acción (ej: "Cambió responsable").';
comment on column event_history.details is 'Detalles del cambio (JSON o texto).';

-- RLS: solo admins pueden insertar, todos pueden leer
alter table event_history enable row level security;

drop policy if exists "Event history admin insert" on event_history;
create policy "Event history admin insert"
  on event_history for insert to authenticated
  with check (public.my_role() = 'admin');

drop policy if exists "Event history read" on event_history;
create policy "Event history read"
  on event_history for select to authenticated
  using (true);

-- ══════════════════════════════════════════════════════════════════
--  4. Función helper: obtener participantes de un evento
-- ══════════════════════════════════════════════════════════════════
create or replace function get_event_participants(p_event_id uuid)
returns table (
  user_id uuid,
  display_name text,
  role text,
  status text,
  check_in_at timestamptz,
  check_out_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    ep.user_id,
    u.display_name,
    ep.role,
    ep.status,
    ea.check_in_at,
    ea.check_out_at
  from event_participants ep
  join users u on u.id = ep.user_id
  left join event_attendance ea on ea.event_id = ep.event_id and ea.user_id = ep.user_id
  where ep.event_id = p_event_id
  order by ep.role desc, u.display_name; -- responsable primero
end;
$$;

grant execute on function get_event_participants(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════
--  5. Función helper: calcular duración de cobertura
-- ══════════════════════════════════════════════════════════════════
create or replace function get_event_coverage_duration(p_event_id uuid, p_user_id uuid)
returns integer -- minutos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_duration integer;
begin
  select check_in_at, check_out_at
  into v_check_in, v_check_out
  from event_attendance
  where event_id = p_event_id and user_id = p_user_id;

  if v_check_in is null then
    return 0;
  end if;

  if v_check_out is null then
    -- Aún en cobertura, calcular hasta ahora
    v_duration := extract(epoch from (now() - v_check_in)) / 60;
  else
    v_duration := extract(epoch from (v_check_out - v_check_in)) / 60;
  end if;

  return v_duration::integer;
end;
$$;

grant execute on function get_event_coverage_duration(uuid, uuid) to authenticated;
-- ===================== FIN 0029_event_participants_attendance.sql =====================


-- ==================== INICIO 0030_event_checkin_gps.sql ====================
-- ═══════════════════════════════════════════════════════════════════
--  0030 — Check-in/out en eventos con validación GPS
--  ═══════════════════════════════════════════════════════════════════
--  Fase 2: Asistencia en eventos externos
--  
--  Funcionalidad:
--   - Check-in/out en eventos (iniciar/finalizar cobertura)
--   - Validación GPS contra ubicación del evento
--   - Validar que el usuario sea participante confirmado
--   - Registrar coordenadas y distancia
--   - Calcular duración automáticamente
--
--  Depende de: 0029 (event_participants, event_attendance)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Función: Check-in en evento ────────────────────────────────
create or replace function event_check_in(
  p_event_id uuid,
  p_user_id uuid,
  p_coords text default null, -- formato: "lat,lng"
  p_location_type text default 'evento' -- 'oficina' | 'evento' | 'remoto'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_participant record;
  v_distance integer := null;
  v_error text;
begin
  -- Obtener evento
  select * into v_event
  from institutional_events
  where id = p_event_id;

  if not found then
    return json_build_object('ok', false, 'error', 'Evento no encontrado');
  end if;

  -- Validar que el evento esté confirmado
  if v_event.status != 'confirmado' then
    return json_build_object('ok', false, 'error', 'El evento no está confirmado');
  end if;

  -- Validar que el usuario sea participante confirmado
  select * into v_participant
  from event_participants
  where event_id = p_event_id and user_id = p_user_id and status = 'confirmado';

  if not found then
    return json_build_object('ok', false, 'error', 'No estás confirmado como participante');
  end if;

  -- Validar que no haya check-in previo
  if exists (
    select 1 from event_attendance
    where event_id = p_event_id and user_id = p_user_id and check_in_at is not null
  ) then
    return json_build_object('ok', false, 'error', 'Ya hiciste check-in en este evento');
  end if;

  -- Validar GPS si el evento es externo y requiere validación
  if v_event.location_type = 'externo' and not v_event.allow_any_location and p_coords is not null and v_event.location_coords is not null then
    -- Calcular distancia (fórmula simplificada Haversine)
    declare
      v_event_lat float;
      v_event_lng float;
      v_user_lat float;
      v_user_lng float;
      v_parts text[];
    begin
      -- Parsear coordenadas del evento
      v_parts := string_to_array(v_event.location_coords, ',');
      v_event_lat := v_parts[1]::float;
      v_event_lng := v_parts[2]::float;

      -- Parsear coordenadas del usuario
      v_parts := string_to_array(p_coords, ',');
      v_user_lat := v_parts[1]::float;
      v_user_lng := v_parts[2]::float;

      -- Calcular distancia aproximada en metros
      v_distance := (
        sqrt(
          power((v_user_lat - v_event_lat) * 111000, 2) +
          power((v_user_lng - v_event_lng) * 111000 * cos(radians(v_event_lat)), 2)
        )
      )::integer;

      -- Validar radio
      if v_distance > v_event.location_radius then
        return json_build_object(
          'ok', false,
          'error', 'Estás fuera del radio del evento',
          'distance', v_distance,
          'radius', v_event.location_radius
        );
      end if;
    end;
  end if;

  -- Crear registro de asistencia
  insert into event_attendance (
    event_id, user_id, check_in_at, check_in_location, check_in_coords, check_in_distance_m
  ) values (
    p_event_id, p_user_id, now(), p_location_type, p_coords, v_distance
  );

  -- Registrar en historial
  insert into event_history (event_id, admin_id, action, details)
  values (
    p_event_id,
    p_user_id,
    'Check-in',
    json_build_object(
      'user_id', p_user_id,
      'location_type', p_location_type,
      'coords', p_coords,
      'distance_m', v_distance
    )::text
  );

  return json_build_object(
    'ok', true,
    'check_in_at', now(),
    'distance_m', v_distance
  );
end;
$$;

grant execute on function event_check_in(uuid, uuid, text, text) to authenticated;

-- ── 2. Función: Check-out de evento ───────────────────────────────
create or replace function event_check_out(
  p_event_id uuid,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attendance record;
  v_duration_min integer;
begin
  -- Obtener registro de asistencia
  select * into v_attendance
  from event_attendance
  where event_id = p_event_id and user_id = p_user_id;

  if not found then
    return json_build_object('ok', false, 'error', 'No hay check-in registrado');
  end if;

  if v_attendance.check_in_at is null then
    return json_build_object('ok', false, 'error', 'No has hecho check-in');
  end if;

  if v_attendance.check_out_at is not null then
    return json_build_object('ok', false, 'error', 'Ya hiciste check-out');
  end if;

  -- Actualizar check-out
  update event_attendance
  set check_out_at = now()
  where id = v_attendance.id;

  -- Calcular duración
  v_duration_min := extract(epoch from (now() - v_attendance.check_in_at)) / 60;

  -- Registrar en historial
  insert into event_history (event_id, admin_id, action, details)
  values (
    p_event_id,
    p_user_id,
    'Check-out',
    json_build_object(
      'user_id', p_user_id,
      'check_in_at', v_attendance.check_in_at,
      'check_out_at', now(),
      'duration_min', v_duration_min
    )::text
  );

  return json_build_object(
    'ok', true,
    'check_out_at', now(),
    'duration_min', v_duration_min::integer
  );
end;
$$;

grant execute on function event_check_out(uuid, uuid) to authenticated;

-- ── 3. Función: Obtener estado de cobertura del usuario en evento ─
create or replace function get_event_coverage_status(
  p_event_id uuid,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attendance record;
  v_participant record;
  v_status text;
  v_duration_min integer := null;
begin
  -- Verificar si es participante
  select * into v_participant
  from event_participants
  where event_id = p_event_id and user_id = p_user_id;

  if not found then
    return json_build_object('is_participant', false);
  end if;

  -- Verificar asistencia
  select * into v_attendance
  from event_attendance
  where event_id = p_event_id and user_id = p_user_id;

  if not found then
    v_status := 'not_checked_in';
  elsif v_attendance.check_out_at is null then
    v_status := 'in_coverage';
    v_duration_min := extract(epoch from (now() - v_attendance.check_in_at)) / 60;
  else
    v_status := 'coverage_completed';
    v_duration_min := extract(epoch from (v_attendance.check_out_at - v_attendance.check_in_at)) / 60;
  end if;

  return json_build_object(
    'is_participant', true,
    'participant_role', v_participant.role,
    'participant_status', v_participant.status,
    'coverage_status', v_status,
    'check_in_at', v_attendance.check_in_at,
    'check_out_at', v_attendance.check_out_at,
    'duration_min', v_duration_min
  );
end;
$$;

grant execute on function get_event_coverage_status(uuid, uuid) to authenticated;

-- ── 4. Función: Obtener resumen de cobertura del evento ───────────
create or replace function get_event_coverage_summary(p_event_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_participants integer;
  v_checked_in integer;
  v_in_coverage integer;
  v_completed integer;
  v_not_checked_in integer;
begin
  -- Total de participantes confirmados
  select count(*) into v_total_participants
  from event_participants
  where event_id = p_event_id and status = 'confirmado';

  -- Checked in (tienen check_in_at)
  select count(*) into v_checked_in
  from event_attendance
  where event_id = p_event_id and check_in_at is not null;

  -- En cobertura (tienen check_in_at pero no check_out_at)
  select count(*) into v_in_coverage
  from event_attendance
  where event_id = p_event_id and check_in_at is not null and check_out_at is null;

  -- Completados (tienen check_in_at y check_out_at)
  select count(*) into v_completed
  from event_attendance
  where event_id = p_event_id and check_in_at is not null and check_out_at is not null;

  -- No han hecho check-in
  v_not_checked_in := v_total_participants - v_checked_in;

  return json_build_object(
    'total_participants', v_total_participants,
    'checked_in', v_checked_in,
    'in_coverage', v_in_coverage,
    'completed', v_completed,
    'not_checked_in', v_not_checked_in
  );
end;
$$;

grant execute on function get_event_coverage_summary(uuid) to authenticated;
-- ===================== FIN 0030_event_checkin_gps.sql =====================


-- ==================== INICIO 0031_google_calendar_sync.sql ====================
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
-- ===================== FIN 0031_google_calendar_sync.sql =====================


-- ==================== INICIO 0032_event_checkin_ownership_guard.sql ====================
-- ═══════════════════════════════════════════════════════════════════
--  0032 — Guard de propiedad en check-in/out de eventos
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: event_check_in / event_check_out (0030) son security definer
--  y reciben p_user_id como parámetro elegido por quien llama, sin
--  validarlo contra auth.uid(). Cualquier autenticado podía marcar
--  check-in/out de OTRO participante confirmado, falseando su asistencia.
--
--  Fix: solo el propio usuario (p_user_id = auth.uid()) o un admin
--  pueden ejecutar la acción. create or replace — mismo nombre/firma,
--  no rompe llamadas existentes desde la app.
-- ═══════════════════════════════════════════════════════════════════

create or replace function event_check_in(
  p_event_id uuid,
  p_user_id uuid,
  p_coords text default null,
  p_location_type text default 'evento'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_participant record;
  v_distance integer := null;
begin
  -- Guard de propiedad: solo el propio usuario o un admin.
  if p_user_id != auth.uid() and public.my_role() != 'admin' then
    return json_build_object('ok', false, 'error', 'No puedes registrar asistencia de otro usuario');
  end if;

  select * into v_event
  from institutional_events
  where id = p_event_id;

  if not found then
    return json_build_object('ok', false, 'error', 'Evento no encontrado');
  end if;

  if v_event.status != 'confirmado' then
    return json_build_object('ok', false, 'error', 'El evento no está confirmado');
  end if;

  select * into v_participant
  from event_participants
  where event_id = p_event_id and user_id = p_user_id and status = 'confirmado';

  if not found then
    return json_build_object('ok', false, 'error', 'No estás confirmado como participante');
  end if;

  if exists (
    select 1 from event_attendance
    where event_id = p_event_id and user_id = p_user_id and check_in_at is not null
  ) then
    return json_build_object('ok', false, 'error', 'Ya hiciste check-in en este evento');
  end if;

  if v_event.location_type = 'externo' and not v_event.allow_any_location and p_coords is not null and v_event.location_coords is not null then
    declare
      v_event_lat float;
      v_event_lng float;
      v_user_lat float;
      v_user_lng float;
      v_parts text[];
    begin
      v_parts := string_to_array(v_event.location_coords, ',');
      v_event_lat := v_parts[1]::float;
      v_event_lng := v_parts[2]::float;

      v_parts := string_to_array(p_coords, ',');
      v_user_lat := v_parts[1]::float;
      v_user_lng := v_parts[2]::float;

      v_distance := (
        sqrt(
          power((v_user_lat - v_event_lat) * 111000, 2) +
          power((v_user_lng - v_event_lng) * 111000 * cos(radians(v_event_lat)), 2)
        )
      )::integer;

      if v_distance > v_event.location_radius then
        return json_build_object(
          'ok', false,
          'error', 'Estás fuera del radio del evento',
          'distance', v_distance,
          'radius', v_event.location_radius
        );
      end if;
    end;
  end if;

  insert into event_attendance (
    event_id, user_id, check_in_at, check_in_location, check_in_coords, check_in_distance_m
  ) values (
    p_event_id, p_user_id, now(), p_location_type, p_coords, v_distance
  );

  insert into event_history (event_id, admin_id, action, details)
  values (
    p_event_id,
    p_user_id,
    'Check-in',
    json_build_object(
      'user_id', p_user_id,
      'location_type', p_location_type,
      'coords', p_coords,
      'distance_m', v_distance
    )::text
  );

  return json_build_object(
    'ok', true,
    'check_in_at', now(),
    'distance_m', v_distance
  );
end;
$$;

grant execute on function event_check_in(uuid, uuid, text, text) to authenticated;

create or replace function event_check_out(
  p_event_id uuid,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attendance record;
  v_duration_min integer;
begin
  -- Guard de propiedad: solo el propio usuario o un admin.
  if p_user_id != auth.uid() and public.my_role() != 'admin' then
    return json_build_object('ok', false, 'error', 'No puedes registrar asistencia de otro usuario');
  end if;

  select * into v_attendance
  from event_attendance
  where event_id = p_event_id and user_id = p_user_id;

  if not found then
    return json_build_object('ok', false, 'error', 'No hay check-in registrado');
  end if;

  if v_attendance.check_in_at is null then
    return json_build_object('ok', false, 'error', 'No has hecho check-in');
  end if;

  if v_attendance.check_out_at is not null then
    return json_build_object('ok', false, 'error', 'Ya hiciste check-out');
  end if;

  update event_attendance
  set check_out_at = now()
  where id = v_attendance.id;

  v_duration_min := extract(epoch from (now() - v_attendance.check_in_at)) / 60;

  insert into event_history (event_id, admin_id, action, details)
  values (
    p_event_id,
    p_user_id,
    'Check-out',
    json_build_object(
      'user_id', p_user_id,
      'check_in_at', v_attendance.check_in_at,
      'check_out_at', now(),
      'duration_min', v_duration_min
    )::text
  );

  return json_build_object(
    'ok', true,
    'check_out_at', now(),
    'duration_min', v_duration_min::integer
  );
end;
$$;

grant execute on function event_check_out(uuid, uuid) to authenticated;
-- ===================== FIN 0032_event_checkin_ownership_guard.sql =====================


-- ==================== INICIO 0033_chat_push_subscriptions.sql ====================
-- ═══════════════════════════════════════════════════════════════════
--  0033 — Chat: tabla de suscripciones Web Push
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: el cliente (src/lib/use-push-notifications.ts) y la Edge
--  Function send-chat-push YA estaban escritos y esperaban esta tabla —
--  nunca se creó, así que el push con la app cerrada no hacía nada
--  (fallaba en silencio, a propósito, como best-effort).
--
--  Esquema explícito según lo que ya consume send-chat-push/index.ts:
--    admin.from("push_subscriptions").select("id, user_id, subscription")
--    ...JSON.parse(sub.subscription as string)
--  → `subscription` es TEXTO (JSON.stringify de PushSubscription.toJSON()),
--    no jsonb — si fuera jsonb, supabase-js ya lo devolvería como objeto y
--    ese JSON.parse tronaría en runtime.
--
--  RLS: cada usuario administra sus propias suscripciones (las escribe su
--  propio navegador vía /api/push/subscribe, con su sesión). La Edge
--  Function lee con service_role — no necesita política de lectura.
--
--  Aditivo. No depende de nada nuevo (usa my_user_id(), ya existente).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null,
  subscription text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (endpoint)
);

create index if not exists idx_push_subscriptions_user
  on push_subscriptions(user_id);

comment on table push_subscriptions is 'Suscripciones Web Push del chat (una fila por navegador/dispositivo suscrito).';
comment on column push_subscriptions.endpoint is 'Endpoint único del push service del navegador — identifica el dispositivo/instalación.';
comment on column push_subscriptions.subscription is 'JSON.stringify(PushSubscription.toJSON()) completo — lo consume send-chat-push tal cual.';

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own_all" on push_subscriptions;
create policy "push_subscriptions_own_all"
  on push_subscriptions for all to authenticated
  using (user_id = my_user_id())
  with check (user_id = my_user_id());
-- ===================== FIN 0033_chat_push_subscriptions.sql =====================


-- ==================== INICIO 0034_phone_self_editable.sql ====================
-- FASE self-service — teléfono editable por el propio empleado.
--
-- Contexto (auditoría 4 ago 2026, docs/AUDITORIA-LOGICA-NEGOCIO.md): hoy
-- profile-modal.tsx no tiene NINGÚN campo de teléfono — el empleado no puede
-- verlo ni editarlo, solo un admin puede escribirlo desde Equipo/Directorio.
-- Se decidió (con el admin) que es dato de contacto de bajo riesgo, no
-- sensible como rol/vacaciones/salario/email, y que dejarlo auto-editable
-- reduce captura manual del admin y mantiene el contacto al día — mismo
-- criterio ya aplicado a birth_date/rfc/curp (ver comentario en
-- 0010_w5b_security_findings.sql).
--
-- Se quita `phone` de la lista de columnas protegidas de
-- trg_users_protect_self_update(); `extension` se queda protegida (esa sí
-- la asigna el admin según la estructura interna, no el propio empleado).
create or replace function public.trg_users_protect_self_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.my_role() = 'admin' then return new; end if;
  if new.role                   is distinct from old.role
  or new.vacation_balance       is distinct from old.vacation_balance
  or new.vacation_days_per_year is distinct from old.vacation_days_per_year
  or new.vacation_balance_reset is distinct from old.vacation_balance_reset
  or new.hire_date              is distinct from old.hire_date
  or new.termination_date       is distinct from old.termination_date
  or new.active                 is distinct from old.active
  or new.email                  is distinct from old.email
  or new.nexus_clave            is distinct from old.nexus_clave
  or new.requester_kind         is distinct from old.requester_kind
  or new.nexus_color            is distinct from old.nexus_color
  or new.specialties            is distinct from old.specialties
  or new.area                   is distinct from old.area
  or new.nivel                  is distinct from old.nivel
  or new.extension              is distinct from old.extension then
    raise exception 'No puedes modificar ese campo de tu perfil';
  end if;
  return new;
end $function$;
-- ===================== FIN 0034_phone_self_editable.sql =====================

