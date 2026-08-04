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
