-- ══════════════════════════════════════════════════════════
--  FIX RAÍZ (5 ago 2026): las 3 policies de attendance_corrections
--  (migración 0027) comparaban `users.id = auth.uid()` / `user_id =
--  auth.uid()` directamente. auth.uid() es el id de Supabase Auth —
--  vive en `users.auth_id`, NUNCA en `users.id` (el id de la app).
--  Resultado: la comparación siempre era falsa para CUALQUIER usuario
--  real → el INSERT de cada corrección de asistencia era rechazado por
--  RLS ("new row violates row-level security policy") en el 100% de
--  los casos, sin excepción — el guardado de attendance sí ocurría
--  (esa tabla tiene su propia RLS correcta desde 0035), pero el
--  historial fallaba siempre y el error crudo de Postgres (un objeto
--  {message,code,details,hint}, no una instancia de Error) se
--  mostraba como "[object Object]" en el toast porque el catch lo
--  pasaba por String(err) en vez de leer err.message.
--
--  Todo el resto del esquema ya usa my_role()/my_user_id() (ver
--  att_admin_update, att_insert_own, att_read en 0010/0035) — esas
--  funciones sí hacen el join correcto por auth_id. Esta migración
--  alinea attendance_corrections al mismo patrón, y de paso agrega
--  'rh' (attendance.att_admin_* ya lo permite; correcciones se había
--  quedado exclusiva de 'admin' por descuido).
-- ══════════════════════════════════════════════════════════

drop policy if exists "Admins pueden insertar correcciones" on public.attendance_corrections;
create policy "Admins pueden insertar correcciones" on public.attendance_corrections
  for insert to authenticated
  with check (my_role() in ('admin', 'rh'));

drop policy if exists "Admins pueden ver correcciones" on public.attendance_corrections;
create policy "Admins pueden ver correcciones" on public.attendance_corrections
  for select to authenticated
  using (my_role() in ('admin', 'rh'));

drop policy if exists "Empleados pueden ver sus propias correcciones" on public.attendance_corrections;
create policy "Empleados pueden ver sus propias correcciones" on public.attendance_corrections
  for select to authenticated
  using (user_id = my_user_id());
