# Módulo · Chat

Rutas: `/chat` (lista) · `/chat/[id]` (conversación) · Roles: admin, empleado.

## Qué es

El chat de Emet es un **módulo del sistema** (no una app aparte): comparte login, tema y estética, y su paleta remapea los tokens dentro de un scope propio `.chat-ws` (workspace premium). En oscuro es la paleta `#0A121F → #0C1626 → #151D2B → #1A2434` (azul-negro, nunca negro puro); en claro, superficies frías con el mismo acento azul.

**Design Language del chat (2026-08-03):** arquitectura de 4 columnas a ancho completo (Sin margen externo) — Sidebar 220px · Lista 360–380px · Conversación flexible · InfoPanel 340–380px — inspirada en **Signal Desktop** para resolver cada problema: jerarquía de Apple HIG, refinamiento de Linear/Notion, pulido de Stripe. No es un clon: se copia la *resolución del problema* (espacio, estados, detalle), nunca el look de otra marca. Ver `docs/design/CHAT-DESIGN-LANGUAGE.md`.

## Capacidades

| Feature | Detalle |
|---|---|
| Conversaciones 1:1 y en grupo | Tablas `conversations` + `conversation_participants` (RLS + Realtime) |
| Estados de mensaje | `sent → delivered → read` (RPC `nx_enlace_mark_*`; ticks en `MessageStatus`, pop al confirmar leído) |
| Reacciones | `message_reactions`, pop animado (0.9→1.1→1.0). **Solo a mensajes de otros** (Signal); la franja es de solo lectura en propios |
| Editar / eliminar | Migración 0021 |
| Fijar / silenciar / archivar | `nx_enlace_toggle_*` + pinned message en la conversación |
| Adjuntos e imágenes | `message_attachments`; pipeline WebP thumb/medium/original en bucket privado `chat-files` |
| Cámara | `CameraCapture` con recorte (`ImageCropper`) |
| Stickers | Pack propio (migración 0022) |
| Ubicación | Envío de punto de mapa |
| Push | Web Push (VAPID) vía Edge `send-chat-push` a destinatarios inactivos |
| Offline | `use-outbox`: cola con `client_id` idempotente; estados de envío visibles |
| Swipe | `use-swipe-gesture` (estilo Signal): revela acciones en la fila sin comprimir la tarjeta |
| Búsqueda | `ConversationSearch` dentro de la conversación (overlay en la columna, salto con resaltado) |
| Presencia/typing | `use-typing` (broadcast Realtime), `TypingDots` animados, `format-presence` |
| Sonido | `sound.ts` (notificaciones suaves) |
| Menús contextuales | `context-menu.tsx` (clic derecho): mensaje y conversación |
| Scrim unificado | Todos los overlays con `rgba(0,0,0,.42)` + `blur(18px) saturate(.75) brightness(.72)` (ADR-0016) |

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

- **Layout**: 4 columnas a ancho completo (sin contenedor centrado con márgenes) — Sidebar 220px · Lista 380px · Conversación flexible · InfoPanel 340px como 3.ª columna SIEMPRE visible en desktop (patrón Signal), no como overlay. En pantallas medianas el InfoPanel colapsa.
- **Iconos**: Lucide unificado — 24px, stroke 2, esquinas redondeadas — en todo el chat, sin excepciones (`Icon` en `os/icons.tsx`). Header: Avatar/Nombre/Estado → búsqueda, llamada, video, info, menú "more" (`Menu`/`MenuItem`).
- **Compositor**: todos los botones con el MISMO peso visual (34px, mismo radio, sin círculo azul protagonista): `+` adjuntar, input, emoji/stickers, adjuntar archivo, y envío/grabar al final.
- **Burbujas**: radio 18px, máx. 72%, borde hairline (sombra `inset 0 0 0 0.5px`) + sombra 1px sutil, padding `px-3.5 pt-2 pb-1.5`, cola sutil al cambiar de remitente. Imágenes `rounded-[14px]` dentro de la burbuja.
- **Reacciones**: cápsulas PEGADAS a la burbuja (`-mt-2.5`, solapan su borde inferior) estilo Signal; solo a mensajes de otros; solo lectura en propios.
- **Lista de conversaciones**: filas planas (`conv-card`) de 64–68px (avatar 48), con estados vivos — hover, activo (`data-active`), no leído (pill de conteo), fijado (pin), silenciado (bellOff), escribiendo (TypingDots), en línea (dot de presencia en directas).
- **Fondo del panel de mensajes**: color base + patrón de puntos sutil (2–4% de opacidad, `nx-msg-panel`) para que la conversación respire sin caer en plano.
- **Swipe**: la tarjeta se traslada solo con `transform` (GPU) sobre franjas de acciones con `z-index` por debajo (`z-[1]` vs `z-0`), fondo opaco y `will-change` durante el arrastre — el texto jamás asoma sobre las acciones.
- Header compacto (52px) y panel informativo por secciones **sin tarjetas**.
- Scrollbar fina dentro del workspace (se insinúa al hover).
- `prefers-reduced-motion` respetado dentro del workspace.
- Sheets modales (adjuntos, reenvío, stickers, cámara) se portalan al body y usan el tema global (fuera del scope).
- Emojis: siempre diseño Apple (SPEC-004).

## Ver también

- `docs/decisions/ADR-0001.md` — por qué el chat es un módulo del sistema
- `docs/decisions/ADR-0012.md` — pipeline de imágenes (bucket privado)
- `docs/architecture/STATE.md` — outbox y estado offline
- `docs/design/MOTION.md` — swipe y pops
- `docs/design/CHAT-DESIGN-LANGUAGE.md` — lenguaje de diseño del chat (N3)
