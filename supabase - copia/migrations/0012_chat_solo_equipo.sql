-- Chat (antes "Enlace") — restringido a solo el equipo interno de CERT
-- (role admin/empleado). Pedido explícito del usuario tras el primer
-- entregable: coordinador/departamento/rh no deben poder ni ser
-- contactados desde el chat — son contrapartes externas que interactúan
-- con CERT vía Solicitudes, no compañeros de equipo.
--
-- El layout (chat/layout.tsx) ya bloquea la entrada al módulo para esos
-- roles, y el picker de "Nuevo mensaje" ya filtra por rol — pero eso es
-- solo UI. La regla real vive aquí, en las funciones SECURITY DEFINER que
-- son la única vía de creación de conversaciones: sin esto, alguien podría
-- llamar al RPC directo (fetch/curl con su JWT) y saltarse el filtro de
-- la UI. Esta migración es la que de verdad cierra el acceso.

create or replace function nx_enlace_get_or_create_direct(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_conv_id uuid;
begin
  if v_me is null then
    raise exception 'No autenticado';
  end if;
  if v_me = p_other_user_id then
    raise exception 'No puedes iniciar una conversación contigo mismo';
  end if;
  if my_role() not in ('admin', 'empleado') then
    raise exception 'El chat es solo para el equipo interno';
  end if;
  if not exists (
    select 1 from users where id = p_other_user_id and active = true and role in ('admin', 'empleado')
  ) then
    raise exception 'Usuario no encontrado o fuera del equipo';
  end if;

  select c.id into v_conv_id
  from conversations c
  where c.type = 'direct'
    and c.deleted_at is null
    and exists (select 1 from conversation_participants where conversation_id = c.id and user_id = v_me)
    and exists (select 1 from conversation_participants where conversation_id = c.id and user_id = p_other_user_id)
    and (select count(*) from conversation_participants where conversation_id = c.id) = 2
  limit 1;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  insert into conversations (type, created_by) values ('direct', v_me) returning id into v_conv_id;
  insert into conversation_participants (conversation_id, user_id, role) values
    (v_conv_id, v_me, 'member'),
    (v_conv_id, p_other_user_id, 'member');

  return v_conv_id;
end;
$$;

create or replace function nx_enlace_create_group(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_conv_id uuid;
  v_member uuid;
  v_clean_name text := trim(coalesce(p_name, ''));
  v_outsider_count int;
begin
  if v_me is null then
    raise exception 'No autenticado';
  end if;
  if my_role() not in ('admin', 'empleado') then
    raise exception 'El chat es solo para el equipo interno';
  end if;
  if length(v_clean_name) = 0 then
    raise exception 'El grupo necesita un nombre';
  end if;
  if p_member_ids is null or array_length(p_member_ids, 1) is null or array_length(p_member_ids, 1) < 1 then
    raise exception 'Selecciona al menos un integrante';
  end if;
  if array_length(p_member_ids, 1) > 19 then
    raise exception 'Máximo 20 integrantes por grupo';
  end if;

  select count(*) into v_outsider_count
  from users
  where id = any(p_member_ids) and (active = false or role not in ('admin', 'empleado'));
  if v_outsider_count > 0 then
    raise exception 'Solo puedes agregar compañeros del equipo';
  end if;

  insert into conversations (type, name, created_by) values ('group', v_clean_name, v_me) returning id into v_conv_id;
  insert into conversation_participants (conversation_id, user_id, role) values (v_conv_id, v_me, 'admin');

  foreach v_member in array p_member_ids loop
    if v_member <> v_me then
      insert into conversation_participants (conversation_id, user_id, role)
      values (v_conv_id, v_member, 'member')
      on conflict do nothing;
    end if;
  end loop;

  return v_conv_id;
end;
$$;
