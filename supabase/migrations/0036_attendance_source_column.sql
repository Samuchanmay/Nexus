-- ══════════════════════════════════════════════════════════
--  FASE 9 (auditoría 4 ago 2026, sección 7 / roadmap P2):
--  columna `source` en attendance — hoy no hay forma de distinguir,
--  sin cruzar contra attendance_corrections, si un registro vino del
--  checador real o fue insertado/corregido a mano por un admin.
--  `device_id` se usaba como pista informal (valores libres como
--  'migracion-excel' o 'jornada-pendiente-resuelta') — esto lo
--  formaliza en un enum controlado + quién lo insertó.
-- ══════════════════════════════════════════════════════════

alter table public.attendance
  add column if not exists source text not null default 'checador'
    check (source in (
      'checador',                    -- fichaje real vía Edge Function `fichar`
      'admin_correccion',            -- admin agregó/corrigió desde /admin/asistencia
      'salida_pendiente_propia',     -- la propia persona confirmó salida de un día pasado
      'salida_pendiente_admin',      -- un admin confirmó la salida de otra persona
      'migracion'                    -- carga histórica desde Excel (one-off, ya ejecutada)
    )),
  add column if not exists created_by uuid references public.users(id) on delete set null;

comment on column public.attendance.source is
  'Origen del registro — FASE 9 auditoría 4 ago 2026. Default checador porque la inmensa mayoría de filas históricas son fichajes reales; se reclasifican abajo las que tienen pista de origen distinto en device_id.';
comment on column public.attendance.created_by is
  'Admin que insertó/corrigió el registro manualmente (null = fichaje del propio usuario vía checador).';

-- Backfill: reclasificar filas históricas cuyo device_id ya delataba
-- un origen distinto de "checador real" (ver pending-exits.ts y la
-- migración 0003_attendance_history.sql que sembró la carga de Excel).
update public.attendance set source = 'migracion'
  where device_id = 'migracion-excel' and source = 'checador';

update public.attendance set source = 'salida_pendiente_propia'
  where device_id = 'jornada-pendiente-resuelta' and source = 'checador';

update public.attendance set source = 'salida_pendiente_admin'
  where device_id = 'jornada-pendiente-resuelta-admin' and source = 'checador';

-- Nota: las correcciones de admin anteriores a esta migración (insertadas
-- desde edit-attendance-sheet.tsx antes de FASE 9) NO se pueden reclasificar
-- con certeza aquí — no dejaban marca en `device_id`, solo en la tabla
-- aparte `attendance_corrections`. Quedan como 'checador' por default; el
-- rastro real de esas correcciones sigue disponible cruzando por
-- user_id+date contra attendance_corrections, igual que antes de esta
-- migración. A partir de aquí, todo insert nuevo desde edit-attendance-sheet
-- se marca source='admin_correccion' explícitamente.
