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
| Actividad con comentario nuevo | Empleado o admin (`comments`) | Admins (el lado admin todavía no tiene su propio comentario) | Campana | ❌ Nunca notificaba | ✅ Corregido |
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
| Corrección enviada por empleado | — | — | — | Esta función **no existe** — hoy solo el admin corrige asistencia directamente (`edit-attendance-sheet.tsx`), no hay flujo de "el empleado pide, el admin aprueba" | ⚠️ Gap de producto, sin implementar |
| Corrección aplicada por admin | Admin | Empleado afectado | Campana | ❌ Quedaba registrada en `attendance_corrections` (bitácora) pero el empleado nunca se enteraba | ✅ Corregido |
| Jornada corregida | Ídem | Ídem | Ídem | Ídem | ✅ Corregido (mismo fix) |
| **Calendario** | | | | | |
| Evento creado | Admin | — | — | Sin canal — razonable, el admin es quien lo crea | Sin cambios |
| Evento actualizado | Admin | Participantes ya invitados | Campana | ❌ Nunca notificaba | ✅ Corregido |
| Evento cancelado (status→cancelado, o eliminado del todo) | Admin | Participantes | Campana | ❌ Nunca notificaba | ✅ Corregido (ambos casos) |
| Invitación a evento (agregar participante) | Admin (`addParticipant`) | Persona invitada | Campana | ❌ Nunca notificaba | ✅ Corregido |
| **Administración** | | | | | |
| Usuario creado | Admin | — | — | Sin canal | ⚠️ Decisión de producto, no implementado (ver Hallazgos) |
| Usuario desactivado | Admin | — | — | Sin canal | Ídem |
| Cambio de rol | Admin | El propio usuario | Campana | ❌ Nunca notificaba | ✅ Corregido (solo dispara si el rol realmente cambió, no en cada edición de perfil) |
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

## Qué falta (de verdad no implementado — son features nuevas, no huecos de notificación)

Todo lo que era "falta conectar un notifyUser" ya se cerró (9 fixes, ver
abajo). De los 3 gaps de producto detectados en esta auditoría, 2 ya se
cerraron (decisión confirmada por el usuario, 6 ago 2026) y 1 queda
diferido a propósito:

1. ✅ **"Devuelta con cambios" como estado de actividad** — cerrado.
   Coordinador puede devolver una actividad en `en_revision` con
   comentario obligatorio; vuelve a `en_progreso`, el motivo queda como
   comentario visible (tabla `comments`) y se notifica a los asignados.
   Botón "Devolver con cambios" en Lista y Pipeline
   (`src/app/admin/proyectos/client.tsx`, `confirmReturn()`). No se
   inventó un estado nuevo — se reutiliza `en_progreso`, que ya es donde
   vive una actividad mientras el empleado la trabaja.
2. ✅ **Corrección de asistencia solicitada por el empleado** — cerrado.
   Tabla nueva `attendance_correction_requests` (migración 0043, no
   `requests` — esa tabla es específicamente el pipeline de Actividades,
   con checklist/asignados/deadline, no encaja para un pedido de "esta
   hora está mal"). Empleado pide desde `/comunicacion/jornada`
   (`request-attendance-correction.tsx`), admin revisa desde
   `/admin/asistencia` y al aprobar abre el mismo Sheet de corrección que
   ya existía (`edit-attendance-sheet.tsx` — no se duplicó esa lógica),
   o rechaza con motivo obligatorio que se notifica al empleado.
3. ⏸️ **Roles intermedios (Director/Coordinador/Supervisor/RH) como
   destinatarios distintos de "admin"** — diferido a propósito, decisión
   del usuario (no es prioridad ahora). El sistema tiene `admin`/
   `empleado`/`rh` (confirmado vía RLS de `vacations`, `my_role()`), sin
   granularidad más fina. Implementar un rol real tipo Coordinador toca
   ~19 políticas RLS que hoy chequean `role = 'admin'` literal en
   `projects`, `requests`, `attendance`, etc. — alcance de semanas, no de
   una sesión, y cualquier error en una política RLS puede filtrar datos
   que no debería ver. Queda documentado aquí para cuando se priorice.

## Cambios aplicados (código) — 9 huecos cerrados

- `src/app/comunicacion/tasks.tsx` — `markReview()`: notifica al
  solicitante (si tiene cuenta interna) + a todos los admins. **Este era
  el bug reportado.**
- `src/app/comunicacion/tasks.tsx` — `addComment()`: notifica a los
  admins cuando se comenta una actividad.
- `src/app/admin/proyectos/client.tsx` — `markCompleted()`: notifica a
  todos los asignados del proyecto.
- `src/app/admin/proyectos/client.tsx` — `createProject()`: notifica a
  los asignados al crear una actividad directa (ruta paralela a
  Solicitudes que se había quedado sin este aviso).
- `src/app/admin/vacaciones/client.tsx` — `cancelVacation()`: notifica al
  empleado.
- `src/app/admin/calendario/client.tsx` — `addParticipant()`: notifica a
  la persona invitada a un evento.
- `src/app/admin/calendario/client.tsx` — `saveEvent()`: notifica a los
  participantes cuando se edita un evento existente, con mensaje distinto
  si el cambio fue justo pasar el status a "cancelado".
- `src/app/admin/calendario/client.tsx` — `deleteEvent()`: notifica a los
  participantes cuando se elimina el evento por completo (la lista de a
  quién avisar se guarda ANTES de borrar, porque el borrado en cascada se
  lleva `event_participants` junto con el evento).
- `src/components/os/edit-attendance-sheet.tsx` — al guardar una
  corrección de asistencia: notifica al empleado afectado.
- `src/app/admin/empleados/client.tsx` — `saveEdit()`: notifica al propio
  usuario cuando su rol cambia (solo si el rol realmente cambió — editar
  el teléfono no dispara nada).

Los 9 siguen exactamente el patrón ya establecido (`notifyUser`/
`notifyAdmins` desde `src/lib/notify.ts`, mismo `kind`, mismo estilo de
`link`) — cero infraestructura nueva, solo cerrar las llamadas que
faltaban.

## Infraestructura de IA — verificado y corregido (fuera del alcance original de esta auditoría, pero el usuario trajo un checklist a revisar)

Se encontró que `docs/DEPLOY-INFRASTRUCTURE.md` tenía información
desactualizada: afirmaba que las migraciones 0025-0039 (lecturas/ocultar
en chat, corrección de asistencia, eventos con participantes) estaban
"documentadas pero no aplicadas". Verificado contra la base de datos real
(`list_migrations`): **las 15 sí estaban aplicadas** — el documento no se
había actualizado después de aplicarlas.

Lo que SÍ era una brecha real y se cerró hoy:
- pgvector: no estaba habilitado → habilitado.
- Migración `0040_ai_configuration.sql` (RPCs `nx_get_ai_config`/
  `nx_set_ai_config`, tabla `message_embeddings`, búsqueda semántica): no
  estaba aplicada → aplicada.
- Edge Functions `ai-summarize` y `ai-embed`: no estaban desplegadas →
  desplegadas y activas.
- La pantalla `/admin/config/ia` ya estaba bien construida (llama a
  `/api/admin/ai-config`, que a su vez llama a los RPCs correctos) —
  ahora sí tiene backend real detrás.

**Encontrado, no resuelto (fuera del checklist original)**: ninguna
pantalla del chat tiene un botón "Resumir conversación" — `ai-summarize`
ya funciona si lo llamas, pero no hay ningún lugar en la UI que lo llame
todavía. Si quieres el botón, es un cambio aparte y rápido.
