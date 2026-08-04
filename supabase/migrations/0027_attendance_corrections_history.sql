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
