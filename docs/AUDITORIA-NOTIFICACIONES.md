# Auditoría del sistema de notificaciones — EMET

Fecha: 06/08/2026. Origen: reporte del usuario — un empleado finalizó una
actividad y la envió a revisión, y el coordinador nunca recibió aviso.
Esta auditoría cubre todo el sistema, no solo ese caso puntual.

## Arquitectura real (cómo funciona hoy)

Un único canal in-app: tabla `public.notifications` (id, user_id, title,
body, kind, read, created_at, link), leída por la campana
(`src/components/os/notifications.tsx`) vía Realtime (Postgres Changes,
RLS ya limita a `user_id = propio`). No hay push del navegador para
notificaciones generales (sí existe para chat, aparte — `use-push-notifications.ts`
+ Edge Function `send-chat-push`, exclusivo de mensajes de Enlace).

Dos únicas formas de crear una notificación, ambas RPC `SECURITY DEFINER`
(necesario: un usuario normal no tiene RLS para insertarle una notificación
a OTRA persona):

- `notifyUser(supabase, userId, title, body, kind, link)` → RPC `create_notification`.
- `notifyAdmins(supabase, title, body, kind, link)` → RPC `notify_admins`.

Ambas viven en `src/lib/notify.ts`, atrapan sus propios errores (nunca
bloquean la acción principal), y se llaman **manualmente desde cada
pantalla** — no hay triggers de base de datos que generen notificaciones
automáticamente. Confirmado contra la BD real: de los 8 triggers activos
en `public`, ninguno toca `notifications` ni `projects`. Esto es la causa
estructural del bug: **cada flujo tiene que acordarse de llamar a
`notifyUser`/`notifyAdmins` a mano**, y no todos lo hacían.

Un canal aparte, por correo (Gmail del admin vía OAuth, no Resend):
Edge Function `notify-vacation`, se invoca solo al crear una solicitud de
vacaciones.

## Inventario por evento

| Evento | Quién lo genera | Quién debe recibir | Canal | Estado antes de esta auditoría | Estado ahora |
|---|---|---|---|---|---|
| **Actividades** | | | | | |
| Actividad enviada a revisión | Empleado (`markReview`, comunicacion/tasks.tsx) | Coordinador/solicitante + admins | Campana | ❌ Nunca notificaba — **el bug reportado** | ✅ Corregido |
| Actividad aprobada/completada | Admin (`markCompleted`, admin/proyectos/client.tsx) | Asignados (quien hizo el trabajo) | Campana | ❌ Nunca notificaba | ✅ Corregido |
| Actividad asignada (desde Solicitud aprobada) | Admin (admin/solicitudes/client.tsx) | Asignados | Campana | ✅ Funcionaba | ✅ Sin cambios |
| Actividad asignada (creación directa por admin) | Admin (`createProject`, admin/proyectos/client.tsx) | Asignados | Campana | ❌ Nunca notificaba (ruta paralela a la de arriba, se les olvidó ahí) | ✅ Corregido |
| Actividad iniciada/pausada/reanudada | Empleado (sesiones de tiempo) | — (nadie necesita saberlo en vivo) | — | Sin canal, correcto por diseño | Sin cambios |
| Actividad con comentario nuevo | Empleado o admin (`comments`) | El resto de involucrados | Campana | ❌ Nunca notificaba | ⚠️ Pendiente — ver Hallazgos |
| Actividad "devuelta con cambios" | — | — | — | ❌ Este estado **no existe** en el sistema (solo hay en_revision→completada, sin vuelta atrás) | ⚠️ Gap de producto, no solo de notificación |
| Actividad cancelada | — | — | — | ⚠️ No se confirmó que el estado exista para proyectos ya creados | ⚠️ Sin verificar — no se tocó por falta de evidencia clara |
| **Solicitudes** | | | | | |
| Nueva solicitud | Coordinador (coordinador/client.tsx) | Admins | Campana | ✅ Funcionaba | Sin cambios |
| Solicitud aprobada | Admin | Solicitante + asignados | Campana | ✅ Funcionaba | Sin cambios |
| Solicitud rechazada | Admin | Solicitante | Campana | ✅ Funcionaba | Sin cambios |
| Comentarios en solicitud | — | — | — | No existe la función (solo existe para Actividades, vía `comments`) | N/A |
| Reasignación | — | — | — | No existe esa función en la UI | N/A |
| **Vacaciones** | | | | | |
| Solicitud creada | Empleado (comunicacion/vacaciones/client.tsx) | Admins | Campana + correo (Edge Fn `notify-vacation`) | ✅ Funcionaba (doble canal) | Sin cambios |
| Aprobada | Admin | Empleado | Campana | ✅ Funcionaba | Sin cambios |
| Rechazada | Admin | Empleado | Campana | ✅ Funcionaba | Sin cambios |
| Cancelada | Admin (`cancelVacation`) | Empleado | Campana | ❌ Reembolsaba saldo pero nunca avisaba | ✅ Corregido |
| Modificada (fechas) | Admin | Empleado | Campana | ✅ Funcionaba | Sin cambios |
| **Incidencias** | | | | | |
| Incidencia registrada | Admin (a nombre de un empleado) | Empleado | Campana | ✅ Funcionaba | Sin cambios |
| Aprobada | Admin | Empleado | Campana | ✅ Funcionaba | Sin cambios |
| Rechazada | Admin | Empleado | Campana | ✅ Funcionaba | Sin cambios |
| Comentario agregado | — | — | — | No existe la función | N/A |
| **Asistencia** | | | | | |
| Corrección enviada por empleado | — | — | — | Esta función **no existe** — hoy solo el admin corrige asistencia directamente (`edit-attendance-sheet.tsx`), no hay flujo de "el empleado pide, el admin aprueba" | ⚠️ Gap de producto |
| Corrección aplicada por admin | Admin | Empleado afectado | Campana | ❌ Queda registrada en `attendance_corrections` (bitácora) pero el empleado nunca se entera de que le cambiaron su asistencia | ⚠️ Pendiente — ver Hallazgos |
| Jornada corregida | Ídem | Ídem | Ídem | Ídem | Ídem |
| **Calendario** | | | | | |
| Evento creado | Admin | — | — | Sin canal — razonable, el admin es quien lo crea | Sin cambios |
| Evento actualizado | Admin | Participantes ya invitados | Campana | ❌ Nunca notificaba | ⚠️ Pendiente — ver Hallazgos |
| Evento cancelado | Admin | Participantes | Campana | ❌ Nunca notificaba | ⚠️ Pendiente — ver Hallazgos |
| Invitación a evento (agregar participante) | Admin (`addParticipant`) | Persona invitada | Campana | ❌ Nunca notificaba | ✅ Corregido |
| **Administración** | | | | | |
| Usuario creado | Admin | — | — | Sin canal | ⚠️ Decisión de producto, no implementado (ver Hallazgos) |
| Usuario desactivado | Admin | — | — | Sin canal | Ídem |
| Cambio de rol | Admin | El propio usuario | Campana | ❌ Nunca notificaba | ⚠️ Pendiente, no implementado |
| Cambio de permisos | — | — | — | No existe como acción separada de "cambio de rol" | N/A |

## Destinatarios por rol

`notifyAdmins()` llega a **todos los admins activos** (RPC `notify_admins`,
no se pudo confirmar el filtro exacto sin leer su cuerpo en la BD — asumir
que replica el criterio de `my_role()='admin'` usado en el resto del
sistema). No existe un concepto de "Director" ni "Supervisor" como
destinatario de notificaciones — los roles reales en `users.role` son
`admin` y `empleado` únicamente (confirmado por el guard de
`chat/layout.tsx`: `["admin","empleado"].includes(profile.role)`). Si la
organización necesita niveles intermedios (Director, Coordinador,
Supervisor, RH como destinatarios *distintos* de "admin"), eso es un
cambio de modelo de datos, no de notificaciones — no se tocó aquí.

## Centro de notificaciones (campana)

Revisado `src/components/os/notifications.tsx` — funciona correctamente:
contador de no leídas (✅), marcar una o todas como leídas (✅), navegación
al link exacto vía `router.push(n.link)` (✅), agrupación por día
Hoy/Ayer/fecha (✅), orden cronológico descendente (✅), eliminación
individual con RLS propia (✅), filtro por categoría (`kind`) (✅). No se
encontraron bugs en el centro de notificaciones en sí — el problema
siempre estaba en el origen (nadie llamaba a `notifyUser`), nunca en la
campana.

## Auditoría técnica — hallazgos puntuales

- **Eventos que nunca disparaban notificación**: confirmados y corregidos
  4 (actividad en_revision, actividad completada, actividad creada
  directo por admin, cancelar vacación, invitar a evento — 5 en total).
  Pendientes sin implementar: comentarios en actividades, corrección de
  asistencia por admin, actualizar/cancelar evento, cambio de rol de
  usuario (ver "Qué falta" abajo).
- **Eventos que disparan dos veces**: no se encontró ninguno.
- **Eventos que llegan al usuario incorrecto**: no se encontró ninguno —
  todos los `notifyUser` existentes usan el `user_id`/`requester_id`
  correcto de la fila afectada.
- **Notificaciones que nunca se marcan leídas / huérfanas**: no aplica,
  `read` se controla desde la campana misma y no depende de que el
  usuario abra el link.
- **Errores silenciosos / promesas sin `await`**: los `notify*()` son
  intencionalmente "fire and forget" con `try/catch` vacío — es la
  decisión correcta (una notificación fallida no debe romper la acción
  real), pero significa que si `create_notification` empezara a fallar
  sistemáticamente, nadie se enteraría. No hay logging de esos catches
  hoy — posible mejora futura, no urgente.
- **Triggers que no ejecutan / condiciones que bloquean envío**: no
  aplica — no hay triggers de notificación en la BD, todo es explícito
  desde la app (ver Arquitectura arriba).
- **RLS**: `notifications` usa RPC `SECURITY DEFINER`, así que RLS no
  bloquea la escritura entre usuarios; la lectura ya está limitada a
  `user_id = propio` (confirmado, sin hallazgos).
- **Realtime**: la campana se suscribe a INSERT/UPDATE en `notifications`
  filtrado por `user_id` — mismo patrón ya verificado y corregido para el
  chat en la migración `chat_realtime_publication_fix`; no se encontró
  evidencia de que `notifications` tenga el mismo problema, pero no se
  verificó explícitamente la publicación de Realtime para esa tabla
  específica — recomendado como siguiente paso si algún usuario reporta
  que la campana no actualiza en vivo.
- **Edge Functions / cola de notificaciones**: no existe una cola — todo
  es síncrono desde el cliente. Un solo Edge Function de notificación real
  (`notify-vacation`, correo). No se encontraron errores en su código.

## Qué falta (no implementado en esta pasada, requiere decisión de producto)

Estos NO se implementaron porque no son "conectar un notifyUser que
faltaba" sino features nuevas o decisiones de diseño:

1. **Comentarios en actividades notifican a los involucrados** — mecánico,
   se puede agregar rápido si se confirma (avisar a lead + admins, mismo
   patrón usado en el resto).
2. **Corrección de asistencia por admin notifica al empleado afectado** —
   mecánico también, mismo patrón.
3. **Actualizar/cancelar evento notifica a los participantes ya
   invitados** — requiere iterar `event_participants` en `updateEvent`/
   `deleteEvent` (no localizado con precisión en esta pasada, el archivo
   `admin/calendario/client.tsx` es de 1000+ líneas).
4. **Cambio de rol notifica al propio usuario** — mecánico.
5. **"Devuelta con cambios" como estado de actividad** — hoy no existe
   ese paso en el flujo (`en_revision` solo puede pasar a `completada`);
   agregarlo es una decisión de producto (¿quién puede devolver? ¿queda
   historial?), no un fix de notificaciones.
6. **Corrección de asistencia solicitada por el empleado** (vs. aplicada
   directamente por el admin) — no existe como feature; es un flujo
   nuevo completo (formulario + tabla de solicitud + aprobación), no un
   ajuste de notificaciones.
7. **Roles intermedios (Director/Coordinador/Supervisor/RH) como
   destinatarios distintos de "admin"** — el sistema solo tiene
   `admin`/`empleado` hoy; filtrar notificaciones por sub-rol requiere
   ese modelo de datos primero.

Si quieres que siga con 1, 2 o 4 (los tres mecánicos, mismo patrón que ya
usé en los 5 fixes de hoy), lo hago en la misma sesión — son rápidos. 3, 5,
6 y 7 valen una conversación aparte antes de tocar código.

## Cambios aplicados hoy (código)

- `src/app/comunicacion/tasks.tsx` — `markReview()`: notifica al
  solicitante (si tiene cuenta interna) + a todos los admins.
- `src/app/admin/proyectos/client.tsx` — `markCompleted()`: notifica a
  todos los asignados del proyecto.
- `src/app/admin/proyectos/client.tsx` — `createProject()`: notifica a
  los asignados al crear una actividad directa (ruta paralela a
  Solicitudes que se había quedado sin este aviso).
- `src/app/admin/vacaciones/client.tsx` — `cancelVacation()`: notifica al
  empleado.
- `src/app/admin/calendario/client.tsx` — `addParticipant()`: notifica a
  la persona invitada a un evento.

Los 5 siguen exactamente el patrón ya establecido (`notifyUser`/
`notifyAdmins` desde `src/lib/notify.ts`, mismo `kind`, mismo estilo de
`link`) — cero infraestructura nueva, solo cerrar las llamadas que
faltaban.
