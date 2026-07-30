-- ═══════════════════════════════════════════════════════════════
--  0018 — EQUIPO Y DIRECTORIO: tablas y columnas faltantes
--  · Crea tablas: jornada_states, activity_types, departments,
--    app_settings
--  · Agrega columnas faltantes: birth_date, area_id, nivel,
--    phone, extension, archived_at ×2
--  · Seeds por defecto para que las pantallas no se rompan
-- ═══════════════════════════════════════════════════════════════

-- ── 1. JORNADA STATES ────────────────────────────────────────
create table if not exists public.jornada_states (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  cuenta_tiempo boolean not null default false,
  pausa_actividad boolean not null default false,
  requiere_motivo boolean not null default false,
  color text not null default '#888888',
  orden int not null default 0,
  activo boolean not null default true,
  emoji text,
  motivo_salida text check (motivo_salida in (
    'Entrada a trabajo','Regreso de comida','Regreso de diligencia',
    'Regreso de cita médica','Regreso de permiso','Regreso de pendientes',
    'Salida a comer','Salida a pendientes','Salida a diligencia',
    'Salida a permiso','Salida a cita médica','Fin de jornada'
  )),
  motivo_regreso text check (motivo_regreso in (
    'Entrada a trabajo','Regreso de comida','Regreso de diligencia',
    'Regreso de cita médica','Regreso de permiso','Regreso de pendientes',
    'Salida a comer','Salida a pendientes','Salida a diligencia',
    'Salida a permiso','Salida a cita médica','Fin de jornada'
  )),
  label_salida text,
  label_regreso text,
  desc_salida text,
  desc_regreso text,
  limite_salida int,
  prioridad_manana int,
  prioridad_mediodia int,
  prioridad_tarde int
);

alter table public.jornada_states enable row level security;
create policy js_read on public.jornada_states for select to authenticated using (true);
create policy js_admin on public.jornada_states for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Seeds por defecto (coinciden con SALIDA_REASON_TO_STATE en hours.ts)
insert into public.jornada_states (nombre, cuenta_tiempo, pausa_actividad, color, orden, activo) values
  ('Trabajando',      true,  false, '#0066FF', 1, true),
  ('Comida',          false, true,  '#FF8A00', 2, true),
  ('Diligencia',      false, true,  '#AF52DE', 3, true),
  ('Consulta médica', false, true,  '#FF3B30', 4, true),
  ('Permiso temporal',false, true,  '#FFD60A', 5, true),
  ('Pendientes',      false, true,  '#8E8E93', 6, true)
on conflict (nombre) do nothing;

-- ── 2. ACTIVITY TYPES ────────────────────────────────────────
create table if not exists public.activity_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  min_hours int not null default 72,
  icon text not null default '📋',
  subtypes text[] default '{}',
  orden int not null default 0,
  activo boolean not null default true
);

alter table public.activity_types enable row level security;
create policy at_read on public.activity_types for select to authenticated using (true);
create policy at_admin on public.activity_types for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Seeds por defecto
insert into public.activity_types (key, label, min_hours, icon, orden) values
  ('cobertura', 'Cobertura', 72,  '📸',  1),
  ('diseno',    'Diseño',    72,  '🎨',  2),
  ('lona',      'Lona',      72,  '🖼️',  3),
  ('video',     'Video',     120, '🎬',  4),
  ('difusion',  'Difusión',  48,  '📢',  5)
on conflict (key) do nothing;

-- ── 3. DEPARTMENTS ───────────────────────────────────────────
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('coordinacion', 'departamento')),
  activo boolean not null default true,
  color text
);

alter table public.departments enable row level security;
create policy dep_read on public.departments for select to authenticated using (true);
create policy dep_admin on public.departments for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ── 4. APP SETTINGS ──────────────────────────────────────────
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
create policy as_read on public.app_settings for select to authenticated using (true);
create policy as_admin on public.app_settings for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ── 5. COLUMNAS FALTANTES en users ───────────────────────────
alter table public.users add column if not exists birth_date date;
alter table public.users add column if not exists area_id uuid references public.departments(id) on delete set null;
alter table public.users add column if not exists nivel text check (nivel in ('licenciatura', 'centro_educativo', 'posgrado'));
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists extension text;

-- ── 6. ARCHIVED_AT en vacations e incidents ────────────────
alter table public.vacations add column if not exists archived_at timestamptz;
alter table public.incidents add column if not exists archived_at timestamptz;

-- ── 7. ÍNDICES ──────────────────────────────────────────────
create index if not exists idx_users_area_id on public.users(area_id);
create index if not exists idx_vacations_archived_at on public.vacations(archived_at);
create index if not exists idx_incidents_archived_at on public.incidents(archived_at);
