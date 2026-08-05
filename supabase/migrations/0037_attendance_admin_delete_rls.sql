-- FASE 9 (auditoría 4 ago 2026): edit-attendance-sheet.tsx ahora permite
-- eliminar un movimiento agregado por error (no solo agregar/corregir hora)
-- — sin esta policy, el DELETE de un admin/rh queda bloqueado en silencio
-- por RLS (0 filas afectadas, sin error visible) igual que pasó con
-- att_admin_update/att_admin_insert_any antes de 0035.
create policy att_admin_delete on public.attendance
  for delete to authenticated
  using (my_role() = any (array['admin'::text, 'rh'::text]));
