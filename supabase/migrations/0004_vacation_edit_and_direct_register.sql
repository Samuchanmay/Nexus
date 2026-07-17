-- Editar una vacación ya Aprobada: recalcula el delta de días y ajusta el saldo
-- atómicamente (misma forma que approve_vacation/cancel_vacation).
create or replace function public.edit_vacation(
  p_vacation_id uuid, p_start_date date, p_end_date date, p_days int
)
returns table(new_balance int)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v record;
  delta int;
begin
  if public.my_role() <> 'admin' then
    raise exception 'Solo el administrador puede editar vacaciones';
  end if;

  select * into v from public.vacations where id = p_vacation_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v.status <> 'Aprobada' then
    raise exception 'Solo se pueden editar solicitudes Aprobadas (estado actual: %).', v.status;
  end if;

  delta := v.days - p_days; -- positivo = se liberan días, negativo = se necesitan más

  update public.users
     set vacation_balance = vacation_balance + delta
   where id = v.user_id and vacation_balance + delta >= 0;
  if not found then
    raise exception 'Saldo insuficiente para este cambio';
  end if;

  update public.vacations
     set start_date = p_start_date, end_date = p_end_date, days = p_days
   where id = p_vacation_id;

  return query select vacation_balance from public.users where id = v.user_id;
end $$;

-- Registrar vacaciones directamente por el admin, sin pasar por el flujo de
-- solicitud/aprobación (equivalente a registrarVacaciones() del checador legado).
create or replace function public.register_vacation_direct(
  p_user_id uuid, p_start_date date, p_end_date date, p_days int, p_note text default null
)
returns table(id uuid, new_balance int)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  new_id uuid;
begin
  if public.my_role() <> 'admin' then
    raise exception 'Solo el administrador puede registrar vacaciones directamente';
  end if;

  update public.users
     set vacation_balance = vacation_balance - p_days
   where id = p_user_id and vacation_balance >= p_days;
  if not found then
    raise exception 'Saldo insuficiente: se piden % días', p_days;
  end if;

  insert into public.vacations (user_id, start_date, end_date, days, status, admin_note)
  values (p_user_id, p_start_date, p_end_date, p_days, 'Aprobada', p_note)
  returning vacations.id into new_id;

  return query select new_id, vacation_balance from public.users where id = p_user_id;
end $$;
