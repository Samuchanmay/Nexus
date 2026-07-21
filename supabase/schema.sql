-- ============================================================
--  NEXUS · Schema completo Supabase
--  CERT Comunicación · Hecho con ❤️ por Samu Chan
--  Ejecutar en: SQL Editor del panel de Supabase
-- ============================================================

create extension if not exists "uuid-ossp";

-- ════ 1. USERS — tabla central (ambos módulos) ════
create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete set null,
  email text unique not null,
  full_name text not null,
  display_name text not null,
  avatar_url text,
  role text not null default 'empleado' check (role in ('admin','empleado','rh','coordinador','departamento')),
  requester_kind text check (requester_kind in ('coordinador','departamento')),
  title text,
  nexus_clave text,
  nexus_color text,
  specialties text[] default '{}',
  area text,
  active boolean not null default true,
  termination_date date,
  vacation_balance int not null default 0,
  vacation_balance_reset date,
  vacation_days_per_year int not null default 0,
  hire_date date,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- ════ 2. SCHEDULES ════
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  work_days text not null default 'Lun-Vie',
  start_time time not null,
  end_time time not null,
  target_min int not null,
  tolerance_min int not null default 15,
  valid_from date not null default current_date,
  valid_until date
);

-- ════ 3. ATTENDANCE ════
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('Entrada','Salida')),
  reason text not null check (reason in (
    -- Catálogo COMPLETO del checador del cliente (U1) — debe coincidir con la Edge Function `fichar`
    'Entrada a trabajo','Regreso de comida','Regreso de diligencia',
    'Regreso de cita médica','Regreso de permiso','Regreso de pendientes',
    'Salida a comer','Salida a pendientes','Salida a diligencia',
    'Salida a permiso','Salida a cita médica','Fin de jornada')),
  date date not null default current_date,
  time time not null default localtime,
  lat numeric,
  lng numeric,
  distance_m int,
  device_id text,
  created_at timestamptz not null default now(),
  unique (user_id, reason, date, time)
);
create index attendance_user_date on public.attendance(user_id, date);

-- ════ 4. VACATIONS ════
create table public.vacations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  days int not null,
  status text not null default 'Pendiente' check (status in ('Pendiente','Aprobada','Rechazada','Cancelada')),
  admin_note text,
  calendar_event_id text,
  notification_sent boolean not null default false,
  created_at timestamptz not null default now()
);

-- ════ 5. INCIDENTS ════
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('permiso','incapacidad','home_office','comision','falta_justificada','cambio_jornada')),
  start_date date not null,
  end_date date not null,
  note text,
  status text not null default 'Pendiente' check (status in ('Pendiente','Autorizado','Rechazado')),
  created_at timestamptz not null default now()
);

-- ════ 6. HOLIDAYS ════
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date unique not null,
  name text not null,
  kind text not null default 'nacional' check (kind in ('nacional','estatal','empresa','puente'))
);

-- ════ 7. GUARDS (diseñada, NO activa) ════
create table public.guards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  date date not null,
  status text default 'Programada',
  note text
);

-- ════ 8. REQUESTS ════
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.users(id),
  requester_type text not null check (requester_type in ('coordinador','departamento','externo')),
  requester_name text,
  requester_area text,
  type text not null check (type in ('cobertura','diseno','lona','video','difusion')),
  subtype text[] default '{}',
  title text not null,
  event_date date,
  event_time time,
  event_location text,
  notes text,
  status text not null default 'solicitada' check (status in ('solicitada','aprobada','en_progreso','en_revision','completada','pausada','cancelada')),
  priority text not null default 'normal' check (priority in ('baja','normal','alta','urgente')),
  rejection_reason text,
  min_hours_required int not null default 72,
  created_at timestamptz not null default now()
);

-- ════ 9. PROJECTS ════
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  lead_user_id uuid references public.users(id),
  status text not null default 'aprobada',
  priority text not null default 'normal',
  deadline date,
  drive_folder_url text,
  calendar_event_id text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id),
  is_lead boolean not null default false,
  assigned_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- ════ 10. CHECKLISTS ════
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  type text unique not null
);
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  position int not null,
  label text not null
);
create table public.project_checklist (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.project_assignments(id) on delete cascade,
  position int not null,
  label text not null,
  done boolean not null default false,
  done_at timestamptz
);

-- ════ 11. TIME TRACKING ════
create table public.task_time_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.project_assignments(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes int,
  is_manual boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.time_edit_requests (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.task_time_logs(id) on delete cascade,
  requested_by uuid not null references public.users(id),
  new_minutes int not null,
  note text not null,
  status text not null default 'Pendiente' check (status in ('Pendiente','Aprobada','Rechazada')),
  created_at timestamptz not null default now()
);

-- ════ 12. EVIDENCES · COMMENTS · NOTIFICATIONS · LOGS ════
create table public.evidences (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  drive_url text,
  publish_url text,
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id),
  body text not null,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text,
  kind text default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  entity text not null,
  entity_id uuid,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create table public.employee_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text
);
create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  catalog text not null check (catalog in ('licenciaturas','niveles','departamentos')),
  label text not null,
  active boolean not null default true,
  unique (catalog, label)
);

-- ════ RLS ════
alter table public.users enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance enable row level security;
alter table public.vacations enable row level security;
alter table public.incidents enable row level security;
alter table public.holidays enable row level security;
alter table public.requests enable row level security;
alter table public.projects enable row level security;
alter table public.project_assignments enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.project_checklist enable row level security;
alter table public.task_time_logs enable row level security;
alter table public.time_edit_requests enable row level security;
alter table public.evidences enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.employee_availability enable row level security;
alter table public.catalog_items enable row level security;
alter table public.guards enable row level security;

create or replace function public.my_role() returns text
language sql stable security definer as $$
  select role from public.users where auth_id = auth.uid()
$$;
create or replace function public.my_user_id() returns uuid
language sql stable security definer as $$
  select id from public.users where auth_id = auth.uid()
$$;

create policy users_read on public.users for select to authenticated using (true);
create policy users_admin_write on public.users for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy users_self_onboard on public.users for update to authenticated
  using (auth_id = auth.uid()) with check (auth_id = auth.uid());

create policy schedules_read on public.schedules for select to authenticated using (true);
create policy schedules_admin on public.schedules for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy att_insert_own on public.attendance for insert to authenticated
  with check (user_id = public.my_user_id());
create policy att_read on public.attendance for select to authenticated
  using (user_id = public.my_user_id() or public.my_role() in ('admin','rh'));

create policy vac_insert_own on public.vacations for insert to authenticated
  with check (user_id = public.my_user_id());
create policy vac_read on public.vacations for select to authenticated
  using (user_id = public.my_user_id() or public.my_role() = 'admin'
         or (public.my_role() = 'rh' and status = 'Aprobada'));
create policy vac_admin_update on public.vacations for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy inc_insert_own on public.incidents for insert to authenticated
  with check (user_id = public.my_user_id());
create policy inc_read on public.incidents for select to authenticated
  using (user_id = public.my_user_id() or public.my_role() in ('admin','rh'));
create policy inc_admin on public.incidents for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy hol_read on public.holidays for select to authenticated using (true);
create policy hol_admin on public.holidays for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy req_insert on public.requests for insert to authenticated
  with check (requester_id = public.my_user_id() or public.my_role() = 'admin');
create policy req_read on public.requests for select to authenticated
  using (requester_id = public.my_user_id() or public.my_role() in ('admin','empleado'));
create policy req_admin_update on public.requests for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy prj_read on public.projects for select to authenticated
  using (public.my_role() = 'admin'
     or exists (select 1 from public.project_assignments a
                where a.project_id = projects.id and a.user_id = public.my_user_id())
     or exists (select 1 from public.requests r
                where r.id = projects.request_id and r.requester_id = public.my_user_id()));
create policy prj_admin on public.projects for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy prj_lead_update on public.projects for update to authenticated
  using (lead_user_id = public.my_user_id());

create policy pa_read on public.project_assignments for select to authenticated using (true);
create policy pa_admin on public.project_assignments for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy ct_read on public.checklist_templates for select to authenticated using (true);
create policy ci_read on public.checklist_items for select to authenticated using (true);
create policy pc_rw on public.project_checklist for all to authenticated
  using (public.my_role() = 'admin'
     or exists (select 1 from public.project_assignments a
                where a.id = assignment_id and a.user_id = public.my_user_id()));

create policy ttl_rw on public.task_time_logs for all to authenticated
  using (public.my_role() in ('admin','rh')
     or exists (select 1 from public.project_assignments a
                where a.id = assignment_id and a.user_id = public.my_user_id()));
create policy ter_insert on public.time_edit_requests for insert to authenticated
  with check (requested_by = public.my_user_id());
create policy ter_read on public.time_edit_requests for select to authenticated
  using (requested_by = public.my_user_id() or public.my_role() = 'admin');
create policy ter_admin on public.time_edit_requests for update to authenticated
  using (public.my_role() = 'admin');

create policy ev_rw on public.evidences for all to authenticated
  using (public.my_role() = 'admin'
     or exists (select 1 from public.project_assignments a
                where a.project_id = evidences.project_id and a.user_id = public.my_user_id()));
create policy cm_rw on public.comments for all to authenticated
  using (public.my_role() = 'admin'
     or exists (select 1 from public.project_assignments a
                where a.project_id = comments.project_id and a.user_id = public.my_user_id()));
create policy nt_own on public.notifications for all to authenticated
  using (user_id = public.my_user_id());
create policy al_read on public.activity_logs for select to authenticated
  using (public.my_role() = 'admin');
create policy al_insert on public.activity_logs for insert to authenticated with check (true);
create policy ea_read on public.employee_availability for select to authenticated using (true);
create policy ea_admin on public.employee_availability for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy cat_read on public.catalog_items for select to authenticated using (true);
create policy cat_admin on public.catalog_items for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy g_admin on public.guards for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ════ SEEDS ════
-- Saldos, antigüedad y reinicios tomados del Excel CONTROL_VACACIONES (jul 2026)
insert into public.users (email, full_name, display_name, role, nexus_clave, nexus_color, area, specialties,
                          vacation_balance, vacation_days_per_year, hire_date, vacation_balance_reset) values
  ('samuel.chan@cert.edu.mx',      'Samuel Chan May',   'Samu',     'admin',    'Samu',     '#5856D6', 'Dirección',      '{video,fotografia,diseno}',  2, 24, '2018-07-09', '2026-07-09'),
  ('angelica.tzakum@cert.edu.mx',  'Angélica Tzakum',   'Angélica', 'empleado', 'Angélica', '#FF3B30', 'Comunicación',   '{diseno,difusion}',         13, 24, '2019-09-01', '2026-09-01'),
  ('jorge.martinchan@cert.edu.mx', 'Jorge Martin Chan', 'Jorge',    'empleado', 'Jorge',    '#FF8A00', 'Operaciones',    '{fotografia,video}',        13, 18, '2022-11-20', '2026-11-20'),
  ('citlaly.may@cert.edu.mx',      'Citlaly May Iuit',  'Citlaly',  'empleado', 'Citlaly',  '#0066FF', 'Administración', '{difusion,diseno}',          0,  0, '2026-04-27', '2027-04-27');

insert into public.schedules (user_id, start_time, end_time, target_min)
select id, '09:00','18:00',480 from public.users where nexus_clave in ('Samu','Angélica','Citlaly');
insert into public.schedules (user_id, start_time, end_time, target_min)
select id, '14:00','21:00',420 from public.users where nexus_clave = 'Jorge';

insert into public.holidays (date, name, kind) values
  ('2026-01-01','Año Nuevo','nacional'),
  ('2026-02-02','Día de la Constitución','nacional'),
  ('2026-03-16','Natalicio de Benito Juárez','nacional'),
  ('2026-05-01','Día del Trabajo','nacional'),
  ('2026-09-16','Día de la Independencia','nacional'),
  ('2026-11-02','Día de Muertos','empresa'),
  ('2026-11-16','Revolución Mexicana','nacional'),
  ('2026-12-24','Nochebuena','empresa'),
  ('2026-12-25','Navidad','nacional'),
  ('2026-12-31','Fin de Año','empresa');

insert into public.checklist_templates (type) values ('cobertura'),('diseno'),('lona'),('video'),('difusion');

insert into public.checklist_items (template_id, position, label)
select t.id, x.pos, x.lbl from public.checklist_templates t,
lateral (values
  (1,'Confirmar horario y lugar'),(2,'Capturar (foto/video)'),(3,'Seleccionar material'),
  (4,'Editar en Lightroom/Premiere'),(5,'Exportar'),(6,'Redactar copy'),(7,'Subir a Facebook')
) as x(pos,lbl) where t.type='cobertura';

insert into public.checklist_items (template_id, position, label)
select t.id, x.pos, x.lbl from public.checklist_templates t,
lateral (values
  (1,'Recibir brief'),(2,'Propuesta de diseño'),(3,'Revisión'),(4,'Correcciones'),
  (5,'Aprobación'),(6,'Entregar archivo final'),(7,'Redactar copy'),(8,'Programar/publicar'),(9,'Guardar enlace')
) as x(pos,lbl) where t.type='diseno';

insert into public.checklist_items (template_id, position, label)
select t.id, x.pos, x.lbl from public.checklist_templates t,
lateral (values
  (1,'Recibir brief'),(2,'Propuesta de diseño'),(3,'Revisión'),(4,'Correcciones'),
  (5,'Aprobación'),(6,'Enviar a imprenta')
) as x(pos,lbl) where t.type='lona';

insert into public.checklist_items (template_id, position, label)
select t.id, x.pos, x.lbl from public.checklist_templates t,
lateral (values
  (1,'Guion'),(2,'Grabar'),(3,'Editar'),(4,'Revisión'),(5,'Correcciones'),
  (6,'Exportar'),(7,'Redactar copy'),(8,'Programar/publicar'),(9,'Guardar enlace')
) as x(pos,lbl) where t.type='video';

insert into public.checklist_items (template_id, position, label)
select t.id, x.pos, x.lbl from public.checklist_templates t,
lateral (values
  (1,'Redactar copy'),(2,'Material visual'),(3,'Revisión'),(4,'Programar'),(5,'Publicar'),(6,'Guardar enlace')
) as x(pos,lbl) where t.type='difusion';

insert into public.catalog_items (catalog, label) values
  ('niveles','Preescolar'),('niveles','Primaria'),('niveles','Secundaria'),
  ('niveles','Preparatoria'),('niveles','Licenciatura'),('niveles','Posgrado / Maestría'),
  ('departamentos','Admisiones'),('departamentos','Control Escolar'),('departamentos','Comunicaciones Mérida');

-- ════ TRIGGER: vincular auth → users por email (whitelist) ════
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  update public.users
    set auth_id = new.id,
        avatar_url = coalesce(new.raw_user_meta_data->>'avatar_url', avatar_url)
  where email = new.email and auth_id is null;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ════ MIGRACIÓN VACACIONES HISTÓRICAS ════
-- 15 movimientos reales del Excel CONTROL_VACACIONES (ya listos, se ejecutan con el schema)
insert into public.vacations (user_id, start_date, end_date, days, status, admin_note) values
  ((select id from public.users where nexus_clave='Samu'),     '2025-08-11','2025-08-15', 5, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Angélica'), '2025-11-24','2025-11-28', 5, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Samu'),     '2025-12-15','2025-12-16', 2, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Samu'),     '2025-12-18','2025-12-19', 2, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Samu'),     '2025-12-22','2025-12-23', 2, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Samu'),     '2025-12-26','2025-12-26', 1, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Jorge'),    '2025-12-17','2025-12-19', 3, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Jorge'),    '2025-12-29','2025-12-30', 2, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Angélica'), '2025-12-29','2025-12-30', 2, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Angélica'), '2026-01-02','2026-01-02', 1, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Samu'),     '2026-04-06','2026-04-10', 5, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Angélica'), '2026-04-08','2026-04-10', 3, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Samu'),     '2026-05-25','2026-05-29', 5, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Samu'),     '2026-06-18','2026-06-18', 1, 'Aprobada', 'Migrado del Excel'),
  ((select id from public.users where nexus_clave='Samu'),     '2026-06-24','2026-06-24', 1, 'Aprobada', 'Migrado del Excel');
