-- 0019_rest_days.sql — Attendance Status Resolver (spec 2026-07-31)
-- Tabla de días de descanso asignados por admin (distinto de vacaciones/
-- incidencias: no lo autosolicita el empleado, solo admin lo asigna).
create table public.rest_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  start_date date not null,
  end_date date not null,
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.rest_days enable row level security;

create policy rd_read on public.rest_days for select
  using (user_id = my_user_id() or my_role() in ('admin','rh'));

create policy rd_admin_write on public.rest_days for all
  using (my_role() = 'admin') with check (my_role() = 'admin');

create index rest_days_user_date_idx on public.rest_days (user_id, start_date, end_date);
