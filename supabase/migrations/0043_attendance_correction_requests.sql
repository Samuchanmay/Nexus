-- ═══════════════════════════════════════════════════════════════════
--  Gap de producto cerrado a pedido del usuario (auditoría de
--  notificaciones): antes de esto, un empleado que veía un error en su
--  asistencia (ej. el checador marcó una hora equivocada) no tenía
--  forma de avisarlo dentro del sistema — solo podía hablar con un
--  admin fuera de EMET. El admin ya podía corregir asistencia
--  directamente (edit-attendance-sheet.tsx), pero no existía el "pedido"
--  del lado del empleado.
--
--  Diseño: tabla de SOLICITUD liviana (nota libre + fecha), no duplica
--  el catálogo de movimientos/razones de attendance ni su lógica de
--  AM/PM (eso ya vive, completo y probado, en edit-attendance-sheet.tsx).
--  Al aprobar, el admin abre ESE MISMO Sheet para el usuario/fecha de la
--  solicitud y aplica la corrección real ahí — esta tabla solo trackea
--  el pedido y su resolución (aprobada/rechazada), nunca escribe
--  directamente en attendance.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  note text not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  admin_id uuid references public.users(id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.attendance_correction_requests is
  'Solicitud del empleado para que un admin revise/corrija su asistencia de un día. No modifica attendance directamente — el admin aplica el fix real vía edit-attendance-sheet.tsx y esta fila solo queda como registro de la solicitud + su resolución.';

create index if not exists idx_attendance_correction_requests_status
  on public.attendance_correction_requests(status) where status = 'pendiente';
create index if not exists idx_attendance_correction_requests_user
  on public.attendance_correction_requests(user_id, date);

alter table public.attendance_correction_requests enable row level security;

-- Mismo patrón que vacations: el empleado ve/crea las suyas, el admin ve/edita todas.
create policy acr_insert_own on public.attendance_correction_requests
  for insert with check (user_id = my_user_id());

create policy acr_read on public.attendance_correction_requests
  for select using (user_id = my_user_id() or my_role() = 'admin');

create policy acr_admin_update on public.attendance_correction_requests
  for update using (my_role() = 'admin') with check (my_role() = 'admin');
