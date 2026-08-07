-- ═══════════════════════════════════════════════════════════════════
--  0049 — Drop tabla muerta time_edit_requests (AUDIT A.9)
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: la tabla nació en la auditoría v1 como feature incompleta
--  (I2: "UI de solicitud de corrección y de aprobación"), pero nunca se
--  le construyó UI ni se referencia desde la app — solo vivía en el
--  schema legacy y en el registro de backups (src/lib/backups/tables.ts).
--  Las correcciones de tiempo ya se manejan por el flujo real de
--  attendance_correction_requests (migración 0043), que sí tiene UI en
--  ambos lados (empleado/admin). time_edit_requests quedó obsoleta.
-- ═══════════════════════════════════════════════════════════════════

drop table if exists public.time_edit_requests;
