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
