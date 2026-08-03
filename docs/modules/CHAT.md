# Módulo · Chat

Rutas: `/chat` (lista) · `/chat/[id]` (conversación) · Roles: admin, empleado.

## Qué es

El chat de Emet es un **módulo del sistema** (no una app aparte): comparte login, tema y estética, y su paleta remapea los tokens dentro de un scope propio `.chat-ws` (workspace premium inspirado en Linear/Discord/Slack/Apple Messages). En oscuro es la paleta `#05070B → #08111E → #101827 → #151D2B`; en claro, superficies frías con el mismo acento azul.

## Capacidades

| Feature | Detalle |
|---|---|
| Conversaciones 1:1 y en grupo | Tablas `conversations` + `conversation_participants` (RLS + Realtime) |
| Estados de mensaje | `sent → delivered → read` (RPC `nx_enlace_mark_*`; ticks en `MessageStatus`) |
| Reacciones | `message_reactions`, pop animado (0.9→1.1→1.0) |
| Editar / eliminar | Migración 0021 |
| Fijar / silenciar / archivar | `nx_enlace_toggle_*` + pinned message en la conversación |
| Adjuntos e imágenes | `message_attachments`; pipeline WebP thumb/medium/original en bucket privado `chat-files` |
| Cámara | `CameraCapture` con recorte (`ImageCropper`) |
| Stickers | Pack propio (migración 0022) |
| Ubicación | Envío de punto de mapa |
| Push | Web Push (VAPID) vía Edge `send-chat-push` a destinatarios inactivos |
| Offline | `use-outbox`: cola con `client_id` idempotente; estados de envío visibles |
| Swipe | `use-swipe-gesture` (estilo Signal): revela acciones en la fila |
| Búsqueda | `ConversationSearch` dentro de la conversación |
| Presencia/typing | `use-typing`, `format-presence` |
| Sonido | `sound.ts` (notificaciones suaves) |

## Modelo de datos (resumen)

- `conversations` — cabecera, último mensaje, mensaje fijado.
- `conversation_participants` — `muted/pinned/archived/last_read_at` por usuario.
- `messages` — `status`, `client_id` (idempotencia), tipo de contenido, `sender_id`.
- `message_attachments` — `thumb/medium/original` del pipeline.
- `message_reactions` — emoji + user.
- `push_subscriptions` — suscripciones Web Push.

## RLS y RPC

- Lectura: solo participantes (RLS en `conversation_participants`).
- Mutaciones vía RPC `nx_enlace_*` (atómicas y validadas server-side): `toggle_mute`, `toggle_conversation_pin`, `toggle_conversation_archived`, `mark_conversation_read`, `mark_delivered`, `mark_read`, `toggle_pin` (mensaje), `toggle_reaction`.

## Flujo de un mensaje

1. El usuario escribe → `use-outbox` encola con `client_id` → insert en `messages`.
2. Realtime entrega a los participantes en línea → tick "entregado" (RPC).
3. El receptor lee → RPC `mark_read` → tick "leído" doble azul.
4. Si el receptor está inactivo, Edge `send-chat-push` envía notificación (solo conversaciones sin silenciar).

## Imágenes

- Subida por el cliente → Edge/storage procesa a WebP (thumb ~200px, medium ~1000px, original) → `SmartImage` elige según tamaño de viewport.
- El bucket es **privado**; el acceso es por URL firmada o proxy (`proxy-asset`).

## Convenciones de UI

- Burbuja propia: acento sólido + texto blanco. Burbuja recibida: superficie del panel.
- Pastilla de fecha centrada; tarjetas dentro de burbujas entrantes (`--chat-card-inner`).
- Lista de conversaciones: `conv-card` con hover/activo (`data-active`).
- Scrollbar fina dentro del workspace (se insinúa al hover).
- `prefers-reduced-motion` respetado dentro del workspace.
- Sheets modales (adjuntos, reenvío, stickers, cámara) se portalan al body y usan el tema global (fuera del scope).

## Ver también

- `docs/decisions/ADR-0001.md` — por qué el chat es un módulo del sistema
- `docs/decisions/ADR-0012.md` — pipeline de imágenes (bucket privado)
- `docs/architecture/STATE.md` — outbox y estado offline
- `docs/design/MOTION.md` — swipe y pops
