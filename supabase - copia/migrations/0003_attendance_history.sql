-- ══════════════════════════════════════════════════════════════════
-- 0003_attendance_history.sql — I14 · Migración de fichajes históricos
-- Fuente: REGISTRO_DE_ENTRADA_COMUNICACIÓN__1_.xlsx · hoja ASISTENCIA
-- Rango: 2026-06-17 → 2026-07-01 · Total: 108 fichajes
-- Conteo por empleado (verificado contra el Excel):
--   Angélica: 39 · Citlaly: 31 · Samu: 29 · Jorge: 9
-- Los motivos se migran TAL CUAL (incluido "Regreso de permiso", fila #44):
--   esta migración amplía primero el check constraint al catálogo completo
--   del checador del cliente (12 motivos), que es el que valida la Edge
--   Function `fichar`. Antes el schema solo permitía 6 y la mitad de los
--   motivos del checador fallaban al insertar (bug latente corregido aquí).
-- distance_m recalculado con haversine contra la oficina (20.405833, −89.529222).
-- device_id = 'migracion-excel' para trazabilidad.
-- Idempotente: ON CONFLICT sobre unique(user_id, reason, date, time).
-- ══════════════════════════════════════════════════════════════════

-- ── Paso 1 · Ampliar el catálogo de motivos al del checador (idempotente) ──
alter table public.attendance drop constraint if exists attendance_reason_check;
alter table public.attendance add constraint attendance_reason_check check (reason in (
  'Entrada a trabajo','Regreso de comida','Regreso de diligencia',
  'Regreso de cita médica','Regreso de permiso','Regreso de pendientes',
  'Salida a comer','Salida a pendientes','Salida a diligencia',
  'Salida a permiso','Salida a cita médica','Fin de jornada'));

-- ── Paso 2 · Insertar los 108 fichajes históricos ──
insert into public.attendance (user_id, type, reason, date, time, lat, lng, distance_m, device_id)
select u.id, v.type, v.reason, v.date::date, v.time::time, v.lat, v.lng, v.distance_m, 'migracion-excel'
from (values
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-17', '09:09:13', 20.405854, -89.529252, 4),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-06-17', '09:09:34', 20.405876, -89.529201, 5),
    ('Samu', 'Entrada', 'Entrada a trabajo', '2026-06-17', '09:28:08', 20.405858, -89.529244, 4),
    ('Angélica', 'Salida', 'Salida a comer', '2026-06-17', '14:07:10', 20.405842, -89.529249, 3),
    ('Citlaly', 'Salida', 'Salida a comer', '2026-06-17', '14:13:10', 20.405745, -89.529186, 10),
    ('Samu', 'Salida', 'Salida a comer', '2026-06-17', '14:19:21', 20.405855, -89.529252, 4),
    ('Angélica', 'Entrada', 'Regreso de comida', '2026-06-17', '15:13:58', 20.405983, -89.528977, 30),
    ('Samu', 'Entrada', 'Regreso de comida', '2026-06-17', '15:29:50', 20.405899, -89.528899, 34),
    ('Citlaly', 'Entrada', 'Regreso de comida', '2026-06-17', '16:08:55', 20.405873, -89.5292, 5),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-17', '17:34:28', 20.405827, -89.529249, 3),
    ('Samu', 'Salida', 'Fin de jornada', '2026-06-17', '17:40:31', 20.405832, -89.529252, 3),
    ('Citlaly', 'Salida', 'Fin de jornada', '2026-06-17', '18:19:09', 20.405873, -89.5292, 5),
    ('Jorge', 'Salida', 'Fin de jornada', '2026-06-17', '21:05:07', 20.40592, -89.529167, 11),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-18', '09:06:45', 20.40586, -89.529239, 3),
    ('Jorge', 'Entrada', 'Entrada a trabajo', '2026-06-18', '13:57:34', 20.405922, -89.529167, 11),
    ('Angélica', 'Salida', 'Salida a comer', '2026-06-18', '14:14:20', 20.405849, -89.529246, 3),
    ('Angélica', 'Entrada', 'Regreso de comida', '2026-06-18', '15:18:02', 20.405855, -89.529226, 2),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-18', '17:26:20', 20.405862, -89.529245, 4),
    ('Jorge', 'Salida', 'Fin de jornada', '2026-06-18', '21:03:36', 20.405902, -89.529166, 10),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-19', '09:10:29', 20.405846, -89.529248, 3),
    ('Samu', 'Entrada', 'Entrada a trabajo', '2026-06-19', '09:21:43', 20.40585, -89.529256, 4),
    ('Samu', 'Salida', 'Salida a comer', '2026-06-19', '13:59:58', 20.405853, -89.529246, 3),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-06-19', '14:09:09', 20.405879, -89.52919, 6),
    ('Angélica', 'Salida', 'Salida a comer', '2026-06-19', '14:15:22', 20.40585, -89.529254, 4),
    ('Angélica', 'Entrada', 'Regreso de comida', '2026-06-19', '15:24:33', 20.405699, -89.529156, 16),
    ('Samu', 'Entrada', 'Regreso de comida', '2026-06-19', '15:29:16', 20.405859, -89.529245, 4),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-19', '17:37:55', 20.405857, -89.529242, 3),
    ('Samu', 'Salida', 'Fin de jornada', '2026-06-19', '18:21:20', 20.405845, -89.529256, 4),
    ('Citlaly', 'Salida', 'Fin de jornada', '2026-06-19', '20:58:23', 20.405656, -89.529181, 20),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-06-20', '09:08:10', 20.405873, -89.529178, 6),
    ('Citlaly', 'Salida', 'Fin de jornada', '2026-06-20', '13:02:32', 20.405871, -89.529179, 6),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-22', '07:53:47', 20.405862, -89.529245, 4),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-06-22', '07:54:13', 20.405872, -89.529189, 6),
    ('Samu', 'Entrada', 'Entrada a trabajo', '2026-06-22', '08:35:11', 20.405873, -89.529166, 7),
    ('Samu', 'Salida', 'Salida a comer', '2026-06-22', '13:43:35', 20.405855, -89.529239, 3),
    ('Samu', 'Entrada', 'Regreso de comida', '2026-06-22', '15:09:52', 20.405849, -89.529255, 4),
    ('Samu', 'Salida', 'Fin de jornada', '2026-06-22', '18:26:10', 20.405852, -89.529205, 3),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-22', '19:06:02', 20.405784, -89.52925, 6),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-06-23', '08:46:26', 20.405877, -89.529179, 7),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-23', '08:49:06', 20.405852, -89.529251, 4),
    ('Samu', 'Salida', 'Fin de jornada', '2026-06-23', '17:56:27', 20.405855, -89.529258, 4),
    ('Citlaly', 'Salida', 'Fin de jornada', '2026-06-23', '17:57:26', 20.405878, -89.529182, 7),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-23', '17:58:03', 20.405829, -89.529261, 4),
    ('Citlaly', 'Entrada', 'Regreso de permiso', '2026-06-24', '09:10:16', 20.405878, -89.529177, 7),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-24', '09:15:25', 20.406005, -89.529239, 19),
    ('Citlaly', 'Salida', 'Salida a comer', '2026-06-24', '13:30:43', 20.40588, -89.529177, 7),
    ('Angélica', 'Salida', 'Salida a comer', '2026-06-24', '14:17:59', 20.405856, -89.52925, 4),
    ('Citlaly', 'Entrada', 'Regreso de comida', '2026-06-24', '14:26:08', 20.40588, -89.529178, 7),
    ('Angélica', 'Entrada', 'Regreso de comida', '2026-06-24', '15:21:23', 20.40586, -89.529234, 3),
    ('Citlaly', 'Salida', 'Fin de jornada', '2026-06-24', '17:16:07', 20.405879, -89.529177, 7),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-24', '17:52:26', 20.405854, -89.529252, 4),
    ('Jorge', 'Salida', 'Fin de jornada', '2026-06-24', '20:59:51', 20.405895, -89.529153, 10),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-06-25', '09:10:00', 20.405878, -89.529175, 7),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-25', '09:11:20', 20.405805, -89.529023, 21),
    ('Samu', 'Entrada', 'Entrada a trabajo', '2026-06-25', '09:12:00', 20.405854, -89.529251, 4),
    ('Jorge', 'Entrada', 'Entrada a trabajo', '2026-06-25', '13:49:39', 20.405895, -89.529153, 10),
    ('Samu', 'Salida', 'Salida a comer', '2026-06-25', '14:04:14', 20.405836, -89.529259, 4),
    ('Angélica', 'Salida', 'Salida a comer', '2026-06-25', '14:17:29', 20.40585, -89.529245, 3),
    ('Citlaly', 'Salida', 'Salida a comer', '2026-06-25', '14:17:53', 20.405874, -89.529172, 7),
    ('Angélica', 'Entrada', 'Regreso de comida', '2026-06-25', '15:22:13', 20.405853, -89.52925, 4),
    ('Citlaly', 'Entrada', 'Regreso de comida', '2026-06-25', '15:34:03', 20.405877, -89.529177, 7),
    ('Samu', 'Salida', 'Fin de jornada', '2026-06-25', '17:12:26', 20.405845, -89.52925, 3),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-25', '17:13:43', 20.405863, -89.52924, 4),
    ('Citlaly', 'Salida', 'Fin de jornada', '2026-06-25', '17:15:58', 20.405877, -89.529176, 7),
    ('Jorge', 'Salida', 'Fin de jornada', '2026-06-25', '21:01:52', 20.405896, -89.529155, 10),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-06-26', '09:05:43', 20.405669, -89.529172, 19),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-26', '09:15:08', 20.405841, -89.529254, 3),
    ('Samu', 'Entrada', 'Entrada a trabajo', '2026-06-26', '09:17:42', 20.405819, -89.528936, 30),
    ('Samu', 'Salida', 'Salida a comer', '2026-06-26', '14:14:30', 20.405784, -89.529071, 17),
    ('Angélica', 'Salida', 'Salida a comer', '2026-06-26', '14:21:31', 20.405846, -89.529266, 5),
    ('Citlaly', 'Salida', 'Salida a comer', '2026-06-26', '14:22:20', 20.405877, -89.529177, 7),
    ('Samu', 'Entrada', 'Regreso de comida', '2026-06-26', '15:25:17', 20.405862, -89.529228, 3),
    ('Angélica', 'Entrada', 'Regreso de comida', '2026-06-26', '15:31:49', 20.405812, -89.529218, 2),
    ('Citlaly', 'Entrada', 'Regreso de comida', '2026-06-26', '15:34:48', 20.405622, -89.528982, 34),
    ('Samu', 'Salida', 'Fin de jornada', '2026-06-26', '17:35:01', 20.405855, -89.529247, 4),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-26', '17:35:39', 20.405843, -89.529256, 4),
    ('Citlaly', 'Salida', 'Fin de jornada', '2026-06-26', '17:36:31', 20.405877, -89.529178, 7),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-06-27', '08:13:32', 20.405861, -89.529178, 6),
    ('Samu', 'Entrada', 'Entrada a trabajo', '2026-06-27', '08:16:46', 20.405757, -89.529182, 9),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-27', '08:35:08', 20.405853, -89.529202, 3),
    ('Citlaly', 'Salida', 'Fin de jornada', '2026-06-27', '11:23:05', 20.405877, -89.529178, 7),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-27', '13:11:42', 20.405857, -89.529227, 3),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-06-29', '09:06:18', 20.405877, -89.529177, 7),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-29', '09:15:16', 20.405723, -89.529066, 20),
    ('Samu', 'Entrada', 'Entrada a trabajo', '2026-06-29', '09:29:33', 20.405861, -89.529227, 3),
    ('Samu', 'Salida', 'Salida a comer', '2026-06-29', '13:13:13', 20.405854, -89.529244, 3),
    ('Angélica', 'Salida', 'Salida a comer', '2026-06-29', '14:14:28', 20.40586, -89.529242, 4),
    ('Samu', 'Entrada', 'Regreso de comida', '2026-06-29', '14:52:21', 20.405838, -89.52926, 4),
    ('Angélica', 'Entrada', 'Regreso de comida', '2026-06-29', '15:28:11', 20.405648, -89.529015, 30),
    ('Citlaly', 'Salida', 'Fin de jornada', '2026-06-29', '16:20:00', 20.405876, -89.529178, 7),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-29', '17:32:22', 20.405845, -89.52924, 2),
    ('Jorge', 'Salida', 'Fin de jornada', '2026-06-29', '21:02:37', 20.405895, -89.529161, 9),
    ('Samu', 'Entrada', 'Entrada a trabajo', '2026-06-30', '08:51:23', 20.405839, -89.529258, 4),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-06-30', '09:12:01', 20.405876, -89.529187, 6),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-06-30', '09:15:02', 20.405559, -89.528944, 42),
    ('Jorge', 'Entrada', 'Entrada a trabajo', '2026-06-30', '13:51:22', 20.40589, -89.529158, 9),
    ('Angélica', 'Salida', 'Salida a comer', '2026-06-30', '14:23:13', 20.405831, -89.529265, 4),
    ('Samu', 'Salida', 'Salida a comer', '2026-06-30', '14:24:34', 20.405851, -89.529242, 3),
    ('Angélica', 'Entrada', 'Regreso de comida', '2026-06-30', '15:34:44', 20.405765, -89.529108, 14),
    ('Samu', 'Entrada', 'Regreso de comida', '2026-06-30', '15:35:29', 20.405841, -89.529258, 4),
    ('Citlaly', 'Entrada', 'Regreso de comida', '2026-06-30', '15:47:03', 20.405805, -89.529177, 6),
    ('Samu', 'Salida', 'Fin de jornada', '2026-06-30', '18:10:12', 20.405837, -89.529244, 2),
    ('Angélica', 'Salida', 'Fin de jornada', '2026-06-30', '18:15:36', 20.405854, -89.52924, 3),
    ('Citlaly', 'Salida', 'Fin de jornada', '2026-06-30', '18:16:06', 20.405874, -89.529182, 6),
    ('Jorge', 'Salida', 'Fin de jornada', '2026-06-30', '20:56:39', 20.405786, -89.529179, 7),
    ('Citlaly', 'Entrada', 'Entrada a trabajo', '2026-07-01', '09:05:31', 20.405876, -89.529179, 7),
    ('Angélica', 'Entrada', 'Entrada a trabajo', '2026-07-01', '09:15:52', 20.405877, -89.529197, 6),
    ('Samu', 'Entrada', 'Entrada a trabajo', '2026-07-01', '09:42:00', 20.405846, -89.529255, 4)
) as v(clave, type, reason, date, time, lat, lng, distance_m)
join public.users u on u.nexus_clave = v.clave
on conflict (user_id, reason, date, time) do nothing;
