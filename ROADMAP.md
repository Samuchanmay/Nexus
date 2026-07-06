# ROADMAP.md — Plan de ejecución Nexus v1 → v1.5

Arquitectura intacta: Next.js App Router + Supabase (Postgres/Auth/Edge Functions/Storage) + Vercel.
Sin funcionalidades inventadas: todo lo listado proviene de la auditoría (AUDIT.md) o del backlog solicitado por el cliente.
Orden diseñado para que **cada fase deje el sistema desplegable**.

---

## F0 · Correcciones críticas (antes que nada)
1. **Zona horaria** (B1): `lib/tz.ts` con `todayMerida()`, `nowMeridaHM()`, `toMeridaDate()`; reemplazo de los 14 usos UTC; Edge Function `fichar` calcula `date`/`time` explícitos en `America/Merida`; `alter database set timezone='America/Merida'` en schema.
2. **B2** closure /fichar · **B3** promoción a `en_progreso` al iniciar tiempo.
3. **Postgres como fuente de verdad** (B4, B5, S1):
   - RPC `approve_vacation(vacation_id, note)` — valida saldo y descuenta atómico.
   - Trigger `vacations_check_balance` en insert.
   - Trigger `requests_check_min_hours` (72/168 h) en insert.
   - Trigger `one_active_task_per_user`.
   - Trigger que impide a `users_self_onboard` tocar `role`/`vacation_balance`.
4. **B6** enfriamiento en Edge Function (`COOLDOWN_MIN`, configurable por secret).
5. Limpieza D1–D4, B7.
6. **I14 — Migración de datos históricos**: script que lee el Excel `REGISTRO_DE_ENTRADA` y genera `supabase/migrations/xxxx_attendance_history.sql` con los **108 fichajes reales** (17-jun → 1-jul, con lat/lng), mapeando claves (Samu→samuel.chan@…) a `user_id`. Verificación: conteo por empleado contra las hojas individuales del Excel.
**Entrega:** schema v2 (migración incremental `supabase/migrations/`), build verde, smoke tests.

## F1 · Restauración de diseño + fusión del legado (U1–U4, L1–L7) — prioridad del cliente
**Principio de fusión** (instrucción del cliente): el **diseño principal es el ya trabajado (v6)**; el legado `cert_nexus.html` aporta **estructura y piezas funcionales** (Gantt, alertas, feed, heatmap, panel contextual, drawers, ⌘K). Los tokens son los mismos en ambos → la fusión es estructural, sin inventar estética nueva. Todo lee/escribe Supabase (nada de Sheets ni del JSON del Apps Script).
- **/fichar** = diseño `checador.html` del cliente (logo CERT, fecha/hora viva, quote del día, botones Entrada/Salida→motivos, pantalla de éxito con quote) con: empleado tomado de la sesión, GPS + confirmación por UUID de Nexus, y **fix del bug de quotes** (limpiar todos los `.quote-resultado` antes de insertar).
- **/empleado** = v6 fiel: hero v6 ("Samuel Chan 👋", métricas), tarjetas de tarea v6; navegación por **pestañas**: Mi Día · Jornada · Vacaciones · Incidencias (rutas existentes, se re-skinean).
- **/admin** = v6 fiel: sidebar con vistas separadas Resumen · Solicitudes · Proyectos · Calendario · Equipo · Empleados · Asistencia · Vacaciones · Incidencias · Días inhábiles. El "Mi Día" del admin se mueve a su tarjeta propia en Resumen (compacta), no fusionado. **Piezas del legado que se fusionan aquí:**
  - Resumen ← L1 banda de alertas + KPIs en vivo (En jornada/En comida/Completaron/Vacaciones) y L3 feed de actividad.
  - Asistencia ← L2 Vista del día: tabla por empleado + **toggle Gantt diario con línea "Ahora"**.
  - Equipo ← L4 panel contextual deslizante (clic en persona → detalle sin salir).
  - Calendario ← L5 heatmap mensual.
  - Transversal ← L7 drawers de alta y command palette ⌘K.
- **/fichar** además incorpora **I15 cola offline**: si no hay red o Supabase no confirma, el registro se guarda en `localStorage` y se reintenta automáticamente; el empleado ve "pendiente de enviar", jamás un éxito falso (traspaso §5).
- **/coordinador** y **/rh**: alinear detalles visuales al v6.
- Extracción simultánea de componentes (C1–C7): `ui-maps.ts`, `gcal.ts`, `PageHeader`, `PersonRow`, `StatCard`, `Field`, `EmptyState`; `router.refresh()` en vez de `location.reload()`.

## F2 · Google Calendar + Drive (API real, service account)
Cuenta controladora: **macgenio55@gmail.com** (calendarios Vacaciones y Eventos CERT compartidos a la service account como editor).
- Edge Function **`gcal-sync`**: crear evento al aprobar (vacaciones→cal. Vacaciones; proyectos con fecha→cal. Eventos CERT), **actualizar** si cambia la solicitud, **eliminar** si se cancela; guarda `calendar_event_id`. JWT RS256 firmado en Deno (sin librerías externas de Google).
- Edge Function **`gdrive-project`**: al crear proyecto → carpeta en Drive (dentro de carpeta raíz configurada), **copia de plantilla** según tipo (mapa de template IDs por tipo en secrets), guarda `drive_folder_url`; botón "Abrir carpeta" en proyecto (UI ya diseñada en v6). Errores: mensaje claro + el proyecto se crea igual y se marca `drive_pending` para reintento.
- Documentación completa: `docs/GOOGLE.md` (crear service account, compartir calendarios/carpeta, secrets).
- El enlace de un-clic actual queda como *fallback* si la API no está configurada.

## F3 · Automatizaciones (Edge Functions + `pg_cron`/Scheduled Functions)
Todas configurables por secrets (`REMINDER_DAYS_BEFORE_VACATION`, `DIGEST_HOUR`, etc.) y documentadas en `docs/AUTOMATIONS.md`:
- `remind-vacations` (X días antes) · `remind-pending-permits` · `remind-incapacities` · **`remind-no-checkin`** (I16: aviso si un empleado no ha fichado pasada su hora de entrada + tolerancia — informativo, sin concepto de retardo).
- `daily-close` (resumen del día a Samuel) · `weekly-close` · `monthly-close` (+ escalamiento de prioridad 48/24 h — cierra I7).
- `vacation-anniversary-reset` (I9): reinicio por aniversario usando `hire_date`/`vacation_days_per_year`, historial en `activity_logs`.
- Reintento de correos con `notification_sent=false` (I13).

## F4 · Dashboard completo + Reportes
- Indicadores: horas trabajadas, horas extra, **cumplimiento de objetivo** y **días sin registro** (⚠️ ver conflicto retardos/faltas en AUDIT §8 — pendiente de confirmación), vacaciones disponibles/utilizadas, próximos permisos, próximas incapacidades, solicitudes pendientes, proyectos activos, tiempo por proyecto.
- Gráficas ligeras (SVG propio, sin librerías pesadas, estilo v6 intacto).
- Reportes: **CSV + Excel (SheetJS) + PDF (print-css dedicado)** para vacaciones, permisos, incapacidades, asistencias, horas, extras y proyectos; filtros por fecha/empleado/proyecto. RH y Admin.

## F5 · NotificationService centralizado
- `lib/notify.ts` + Edge Function `notify-dispatch`: canal único hoy (tabla `notifications` + correo Resend), interfaz `send(event, payload)` con eventos: solicitud creada/aprobada/rechazada/modificada, vacaciones próximas, permiso próximo, incapacidad próxima.
- Arquitectura por *providers* para futuros canales (WhatsApp/Teams **no** se implementan).
- Campana de notificaciones en topbar (v6 ya la contempla).

## F6 · Módulos finales
- **Time tracking**: Pausar/Reanudar (sesiones múltiples por log), tiempo por proyecto y por tarea, estadísticas diario/semanal/mensual (I10). Sin tocar la interfaz existente: se amplían los botones actuales.
- **Vacaciones motor completo** (I9 + validaciones): antigüedad, saldo usado, pendientes, vencidos si aplica — todo calculado en Postgres (vistas + RPC).
- **Permisos**: crear/editar/cancelar/aprobar/rechazar (completar CRUD sobre incidents kind=permiso).
- **Salidas**: ya registradas por el checador (Salida/Regreso de diligencia); se añade vista de duración e historial.
- **Incapacidades**: adjuntos PDF/imagen vía Supabase Storage (bucket privado + RLS), fechas, estado, historial (I11).
- **Guardias** (L6, del legado): vista de rotación de sábados con asignación e intercambios (drawer: con quién, fecha del cambio, motivo) sobre la tabla `guards` ya existente en el schema.
- Todo alimenta los indicadores del Dashboard (F4).
- **Validación de actividades manuales por admin** (I1) + UI de `time_edit_requests` (I2).

## F7 · Producción
Variables de entorno auditadas y fail-closed (middleware exige env en prod) · manejo de errores homogéneo (`useSupabaseMutation`) · logs (`activity_logs` sistemático — I5) · seguridad (revisión RLS §6) · backups (documentar PITR de Supabase + export mensual automático) · optimización (revisión de queries, índices) · README actualizado · **DEPLOY.md** paso a paso.

---

## Dependencias y datos que necesito del cliente
1. **Confirmar §8** (retardos/faltas → cumplimiento/días sin registro).
2. Para F2: acceso a crear la service account en un proyecto de Google Cloud, y que **macgenio55@gmail.com** comparta los 2 calendarios y la carpeta raíz de Drive (guía incluida en docs/GOOGLE.md — 10 min).
3. Para F2 (Drive): las **plantillas** por tipo (o confirmar que la carpeta se crea vacía con subcarpetas estándar).
4. Para F3: horarios preferidos de los cierres (por defecto: diario 21:30, semanal viernes 18:00, mensual día 1 08:00, recordatorio de vacaciones 3 días antes).

---

## ✅ Actualización — F0 y F1 completados (sesión de continuación)

### F0 · Cierre
- **I14 — Migración de fichajes históricos** → `supabase/migrations/0003_attendance_history.sql`.
  108 fichajes reales del Excel (17 jun → 1 jul 2026). Conteos verificados:
  Angélica 39 · Citlaly 31 · Samu 29 · Jorge 9. `distance_m` recalculado con
  haversine (todos ≤ 50 m). `device_id='migracion-excel'`. Idempotente (ON CONFLICT).
- **Bug latente corregido — catálogo de motivos.** El checador del cliente y la
  Edge Function `fichar` manejan 12 motivos, pero el `schema.sql` solo permitía 6:
  la mitad de los fichajes habrían fallado al insertar. Se amplió el CHECK
  `attendance_reason_check` al catálogo completo (schema + migración 0003).
- Smoke test estructural: build verde, 21 rutas, columnas de todas las queries
  validadas contra el esquema real.

### Des-duplicación (C1–C7)
- `src/lib/ui-maps.ts` — mapas de tono/etiqueta como fuente única
  (STATUS_TONE, PRIORITY_TONE, PRIORITY_LABELS, VACATION_TONE, INCIDENT_TONE, KIND_LABELS).
- `src/lib/gcal.ts` — URLs de Google Calendar (vacaciones / solicitudes).
- `src/components/shared.tsx` — PageHeader, StatCard, PersonRow, EmptyState, Field
  y el hook `useSupabaseMutation` (saving + toast + `router.refresh()`).
- Eliminados los 12 `location.reload()` → `router.refresh()` en 9 archivos.

### F1 · Restauración de diseños del legado (§6)
- **L1 · Alertas inteligentes** + **L3 · Pulso en vivo y feed de actividad** →
  `src/app/admin/page.tsx` (Resumen reescrito, todo derivado de Supabase).
- **L2 · Gantt diario** con línea "Ahora" viva → `src/app/admin/nexus/{page,client}.tsx`
  (toggle Tabla ⇄ Gantt).
- **L4 · Panel contextual** de la Carga del equipo → `src/app/admin/equipo/{page,client}.tsx`
  (clic en persona → Sheet con jornada, tareas, vacaciones e incidencias).
- **L5 · Calendario mensual** (heatmap fichaje/vacaciones/inhábil/sin-registro) →
  `src/app/admin/calendario/page.tsx` (ruta nueva, añadida al nav).
- **L7 · Command palette ⌘K** → `src/components/command-palette.tsx`
  (montado en el sidebar de admin; abre con ⌘K / Ctrl+K / "/").
- Firma "Hecho con ❤️ por Samu Chan" verificada en los 4 layouts.
