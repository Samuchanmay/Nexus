-- ═══════════════════════════════════════════════════════════════════
--  0035 — RLS: Admin/RH pueden escribir asistencia de cualquier persona
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: la corrección de asistencia del admin (edit-attendance-sheet)
--  hace UPDATE e INSERT sobre `attendance` en nombre de OTRO empleado, y
--  adminResolvePendingExit inserta el "Fin de jornada" de la persona. Las
--  únicas políticas existentes eran att_insert_own (con check user_id =
--  my_user_id()) y att_read (solo lectura) → TODO UPDATE era rechazado por
--  RLS y TODO INSERT de un admin para otro usuario también (42501, "new row
--  violates row-level security policy"). La UI mostraba el genérico "No se
--  pudo guardar la corrección" ocultando el error real.
--
--  Fix: políticas de UPDATE + INSERT para admin y rh, alineadas con att_read
--  (que ya les da lectura completa). La persona sigue escribiendo SOLO sus
--  propios movimientos vía att_insert_own.
--
--  Aditivo e idempotente.
-- ═══════════════════════════════════════════════════════════════════

drop policy if exists "att_admin_update" on public.attendance;
create policy "att_admin_update" on public.attendance
  for update to authenticated
  using (public.my_role() in ('admin','rh'))
  with check (public.my_role() in ('admin','rh'));

drop policy if exists "att_admin_insert_any" on public.attendance;
create policy "att_admin_insert_any" on public.attendance
  for insert to authenticated
  with check (public.my_role() in ('admin','rh'));
