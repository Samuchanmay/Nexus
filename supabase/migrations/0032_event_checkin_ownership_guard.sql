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
