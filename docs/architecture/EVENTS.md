# Emet · Eventos

## Catálogo de eventos del sistema

| Evento | Disparador | Consumidor | Mecanismo |
|---|---|---|---|
| Auth user creado | Google login (primer registro de email en whitelist) | Trigger `on_auth_user_created` → `handle_new_auth_user()` vincula `auth_id` a `users` | DB trigger |
| Checada | Edge `fichar` | `attendance` insert; UI vía refetch / Realtime | DB + cliente |
| Aprobación de vacaciones | Admin en `/admin/vacaciones` | `approve_vacation` (validación de saldo) → Edge `notify-vacation` (correo + Google Calendar) | RPC + Edge |
| Nuevo mensaje de chat | Usuario escribe | Realtime → lista/conversación; si destinatario inactivo → Edge `send-chat-push` | Realtime + Web Push |
| Mensaje leído/entregado | Receptor abre conversación / llega al cliente | RPC `nx_enlace_mark_delivered/read` → ticks en `MessageStatus` | RPC |
| Reacción / pin / mute / archive | Acciones de la conversación | RPC `nx_enlace_*` | RPC |
| Notificación interna | `create_notification` / `notify_admins` | `NotificationBell` (`notifications`) | Insert + polling/Realtime |
| Reporte semanal | `pg_cron` (lunes) o botón "Enviar ahora" | Edge `weekly-attendance-report` → Resend | Cron/Edge |
| Pausa activa | Tiempo de jornada continuo (config) | `PausaActivaPopup` | Timer en cliente |
| Salida pendiente | Fin de jornada sin checar salida | `JornadaWatcher` + `ResolvePendingExit` | Timer en cliente |
| Recorrido visto | Player termina demo | `/api/demos/view` → `nexus:recorridos:visto` | API + localStorage |

## Realtime (chat)

- Suscripción a `conversations`/`messages` por usuario (RLS filtra qué conversaciones ve cada uno).
- Los mensajes propios no se "doblan": el outbox marca el `client_id` y la UI reconciliar por id.

## Triggers (base de datos)

Lista completa y propósito en `docs/architecture/DATABASE.md` → "Triggers". Resumen: auth→users, saldo de vacaciones, horas mínimas de solicitudes, una tarea activa, no arrancar proyecto sin setup, protección de auto-escalado.

## Web Push (VAPID)

1. `use-push-notifications` pide permiso y registra `PushManager.subscribe` con la clave pública VAPID.
2. La suscripción se guarda en `push_subscriptions` vía `/api/push/subscribe`.
3. Edge `send-chat-push` encuentra la suscripción del destinatario (que no esté activo), arma el payload (icono EMET, título, cuerpo) y envía.

## Eventos de UI

- **Ripple**: `src/lib/ripple.ts` inyecta un nodo `.nx-ripple` sobre `[data-ripple]` al primer toque (Fase 3).
- **Toast**: éxito/error; los de error añaden `.nx-toast-shake`.
- **Swipe**: `use-swipe-gesture` (chat) → transform del row + botones revelados.
- **Saludo 👋**: `.wave-emoji` una vez por carga del header de Hoy.
- **Nota**: todo movimiento respeta `prefers-reduced-motion` (ver `globals.css` y `.chat-ws`).

## Ver también

- `docs/architecture/API.md` — endpoints que disparan varios de estos eventos
- `docs/modules/CHAT.md` — flujo completo del chat
- `docs/modules/TIME.md` — flujo de jornada/pausa/salida
