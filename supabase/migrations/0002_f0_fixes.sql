-- ═══════════════════════════════════════════════════════════════
--  NEXUS · Migración F0 — Correcciones críticas (AUDIT.md)
--  Ejecutar en el SQL Editor de Supabase DESPUÉS de schema.sql.
--  Idempotente: usa create or replace / drop if exists.
-- ═══════════════════════════════════════════════════════════════

-- ─── B1 · Zona horaria ──────────────────────────────────────────
-- La app y la Edge Function ya calculan fecha/hora en America/Merida.
-- Esto alinea Postgres como refuerzo (defaults, now(), current_date):
alter database postgres set timezone to 'America/Merida';

-- Defaults de attendance en zona Mérida (red de seguridad si algún
-- insert llegara sin date/time explícitos):
alter table public.attendance
  alter column date set default ((now() at time zone 'America/Merida')::date),
  alter column time set default ((now() at time zone 'America/Merida')::time(0));

-- ─── B4 · Aprobación de vacaciones ATÓMICA (RPC) ────────────────
-- Valida y descuenta saldo en UNA transacción. Solo admin.
create or replace function public.approve_vacation(p_vacation_id uuid, p_note text default null)
returns table (new_balance int) language plpgsql security definer set search_path = public as $$
declare
  v record;
begin
  if public.my_role() <> 'admin' then
    raise exception 'Solo el administrador puede aprobar vacaciones';
  end if;

  select * into v from public.vacations where id = p_vacation_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v.status <> 'Pendiente' then raise exception 'La solicitud ya fue decidida (%).', v.status; end if;

  update public.users
     set vacation_balance = vacation_balance - v.days
   where id = v.user_id and vacation_balance >= v.days;
  if not found then
    raise exception 'Saldo insuficiente: la solicitud pide % días', v.days;
  end if;

  update public.vacations
     set status = 'Aprobada', admin_note = coalesce(p_note, admin_note)
   where id = p_vacation_id;

  return query select vacation_balance from public.users where id = v.user_id;
end $$;

revoke all on function public.approve_vacation(uuid, text) from public;
grant execute on function public.approve_vacation(uuid, text) to authenticated;

-- ─── B5a · Saldo validado en la BD al SOLICITAR ─────────────────
create or replace function public.trg_vacations_check_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare bal int;
begin
  if new.days < 1 then raise exception 'La solicitud debe ser de al menos 1 día'; end if;
  if new.end_date < new.start_date then raise exception 'Rango de fechas inválido'; end if;
  select vacation_balance into bal from public.users where id = new.user_id;
  if new.status = 'Pendiente' and new.days > coalesce(bal, 0) then
    raise exception 'Saldo insuficiente: pides % días y tienes %', new.days, coalesce(bal, 0);
  end if;
  return new;
end $$;

drop trigger if exists vacations_check_balance on public.vacations;
create trigger vacations_check_balance
  before insert on public.vacations
  for each row execute function public.trg_vacations_check_balance();

-- ─── B5b · Anticipación mínima (72h / 168h) en la BD ────────────
create or replace function public.trg_requests_check_min_hours()
returns trigger language plpgsql security definer set search_path = public as $$
declare event_ts timestamptz;
begin
  if new.event_date is null then return new; end if; -- sin fecha: no aplica
  event_ts := (new.event_date::text || ' ' || coalesce(new.event_time, '09:00')::text)::timestamp
              at time zone 'America/Merida';
  if event_ts < now() + make_interval(hours => new.min_hours_required) then
    raise exception 'Anticipación insuficiente: este tipo requiere % horas (% días)',
      new.min_hours_required, round(new.min_hours_required / 24.0);
  end if;
  return new;
end $$;

drop trigger if exists requests_check_min_hours on public.requests;
create trigger requests_check_min_hours
  before insert on public.requests
  for each row execute function public.trg_requests_check_min_hours();

-- ─── B5c · UNA tarea activa por persona (BD, no solo UI) ────────
create or replace function public.trg_one_active_task()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select user_id into uid from public.project_assignments where id = new.assignment_id;
  if exists (
    select 1 from public.task_time_logs l
    join public.project_assignments a on a.id = l.assignment_id
    where a.user_id = uid and l.ended_at is null and l.id <> new.id
  ) then
    raise exception 'Ya tienes una tarea activa — finalízala primero';
  end if;
  return new;
end $$;

drop trigger if exists one_active_task on public.task_time_logs;
create trigger one_active_task
  before insert on public.task_time_logs
  for each row execute function public.trg_one_active_task();

-- ─── B3 · Primer inicio de tiempo ⇒ proyecto en_progreso ────────
create or replace function public.trg_project_start_on_time()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.projects p
     set status = 'en_progreso'
   where p.id = (select project_id from public.project_assignments where id = new.assignment_id)
     and p.status = 'aprobada';
  -- El request espejo también avanza:
  update public.requests r
     set status = 'en_progreso'
   where r.id = (select request_id from public.projects p2
                 where p2.id = (select project_id from public.project_assignments where id = new.assignment_id))
     and r.status = 'aprobada';
  return new;
end $$;

drop trigger if exists project_start_on_time on public.task_time_logs;
create trigger project_start_on_time
  after insert on public.task_time_logs
  for each row execute function public.trg_project_start_on_time();

-- ─── S1 · El usuario NO puede tocar campos sensibles propios ────
create or replace function public.trg_users_protect_self_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() = 'admin' then return new; end if;
  if new.role                  is distinct from old.role
  or new.vacation_balance      is distinct from old.vacation_balance
  or new.vacation_days_per_year is distinct from old.vacation_days_per_year
  or new.hire_date             is distinct from old.hire_date
  or new.active                is distinct from old.active
  or new.email                 is distinct from old.email
  or new.nexus_clave           is distinct from old.nexus_clave then
    raise exception 'No puedes modificar ese campo de tu perfil';
  end if;
  return new;
end $$;

drop trigger if exists users_protect_self_update on public.users;
create trigger users_protect_self_update
  before update on public.users
  for each row execute function public.trg_users_protect_self_update();
