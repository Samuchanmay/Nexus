-- ═══════════════════════════════════════════════════════════════════
--  EMET · MIGRACIÓN URGENTE 0035 — RLS de escritura en attendance
--  ═══════════════════════════════════════════════════════════════════
--  Bloquea la corrección de asistencia ("No se pudo guardar la corrección"):
--  el admin hace UPDATE/INSERT de attendance de OTRO empleado, pero solo
--  existían políticas para registrar/leer lo propio.
--
--  Aplicar en el SQL Editor de emet.uno: pegar y ejecutar (idempotente).
--  ═══════════════════════════════════════════════════════════════════
--  VERIFICAR ANTES: si la tabla `attendance_corrections` (0027) aún no
--  existe, aplicar primero docs/MIGRACIONES-APLICAR-0025-0034.sql.
--  ═══════════════════════════════════════════════════════════════════

drop policy if exists "att_admin_update" on public.attendance;
create policy "att_admin_update" on public.attendance
  for update to authenticated
  using (public.my_role() in ('admin','rh'))
  with check (public.my_role() in ('admin','rh'));

drop policy if exists "att_admin_insert_any" on public.attendance;
create policy "att_admin_insert_any" on public.attendance
  for insert to authenticated
  with check (public.my_role() in ('admin','rh'));
