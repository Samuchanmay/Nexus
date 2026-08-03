# Revisión: EMET Chat Design System (vs. código real)

> Comparación del documento generado por ChatGPT contra el código fuente existente.
> Julio 2026.

---

## 1. Errores del documento

### "Morado EMET como color principal"

**Falso.** El acento principal de EMET es `--accent: #0066FF` (azul). El morado (`--purple: #5856D6`) aparece solo en tokens secundarios y en el mesh gradient del rol RH. El chat ya usa `--accent` (azul) para el botón enviar, checkmarks de leído, reacciones propias y pinned messages — esto no debe cambiarse a morado.

### "Sidebar colapsada 88-96px / expandida 240px"

No aplica. EMET ya tiene un AppShell con sidebar (`Emet OS`). El chat vive dentro de ese shell. No debe tener su propia sidebar — contradice la integración nativa que acabamos de hacer.

### "Llamada / Video en la cabecera"

No existen esos módulos en EMET. No hay VoIP, videollamada ni infraestructura de tiempo real para eso. Ponerlos como botones "Próximamente" sería ruido visual.

---

## 2. Lo que YA existe en el código (y ChatGPT no detectó)

| Requisito del documento | Estado real en el código |
|---|---|
| **Estados de mensaje** (enviando, enviado, entregado, leído, error) | ✅ Existe `message-state.ts` con máquina de estados: pending→sent→delivered→read→failed. Ya migrado a SVGs inline. |
| **Escribiendo...** | ✅ Existe `use-typing.ts` con Supabase Realtime broadcast, auto-stop 2.5s, soporte multi-usuario |
| **Online / última conexión** | ✅ Existe `formatPresence()` en `format-presence.ts`. Se muestra en la cabecera del chat y en el InfoPanel |
| **Reacciones** | ✅ Existe `ReactionStrip` + `ReactionPicker` con 7 emojis: 👍❤️😂😮😢👏🎉 |
| **Responder mensajes** (reply) | ✅ Existe swipe-to-reply con `useSwipeGesture` y reply-to bar en el composer |
| **Fijar mensajes** | ✅ Existe `togglePin` con RPC `nx_enlace_toggle_pin`, banner de pinned message |
| **Separadores Hoy/Ayer/Fecha** | ✅ Existe `dayLabel()` — recién migrado de píldora flotante a línea horizontal |
| **Adjuntar archivos** | ✅ Existe `AttachmentSheet` con **todas** las opciones funcionando (0022): cámara, galería, documento, ubicación, stickers y nota de audio |
| **Agrupar mensajes consecutivos** | ✅ Existe con `prevSameSender`, avatar spacing, márgenes reducidos |
| **Máximo 70-78% del ancho** | ✅ `max-w-[78%]` en cada mensaje |
| **Enter envía, Shift+Enter nueva línea** | ✅ Implementado en `onKeyDown` |
| **Burbuja propia vs. recibida** | ✅ Recién migrado a `--accent-tint` / `--surface` |

---

## 3. Lo que NO existe y debería priorizarse

Priorizado por impacto vs. esfuerzo:

### Alta prioridad (bloqueante para experiencia real)

> ✅ **FASE 1 implementada (Jul 2026)** — sonido, notificaciones de navegador,
> badges y contador global quedaron cableados; ver "FASE 1" en §6.
>
> ✅ **FASE 2 implementada (Jul 2026)** — push real, búsqueda en conversación,
> editar/eliminar, panel contextual rico y skeletons; ver "FASE 2" en §6.

| # | Funcionalidad | Estado real en el código |
|---|---|---|
| 1 | **Push notifications** | ✅ **FASE 2 implementada**: push real vía service worker (`public/sw.js`) con Edge Function `send-chat-push` (entrega a participantes no-silenciados con la app cerrada, VAPID), suscripción automática tras el permiso del banner (`use-push-notifications`), y supresión cuando la conversación ya está abierta/enfocada. Se complementa con la notificación in-app (Notifications API) cuando la pestaña está en segundo plano. |
| 2 | **Badge en favicon/tab** | ✅ `useChatUnread` actualiza el título de la pestaña: `(N) EMET …` |
| 3 | **Sonido al recibir mensaje** | ✅ `playMessageReceived()` (Web Audio) en conversación abierta + watcher global (`useChatUnread`) para mensajes en otras conversaciones; respeta silenciados. |
| 4 | **Contador global de no leídos** | ✅ Badge "N" en el item Chat del sidebar, tab bar móvil y Spotlight; badge numérico por conversación en `ConversationRow`. |
| 5 | **Buscar dentro del chat** | ✅ `ConversationSearch` (overlay en la conversación, debounce 250ms, mínimo 2 letras, solo texto no-eliminado, nombres vía `users_directory`) con salto al mensaje: `jumpToMessage` carga historial hasta encontrarlo (tope 14 intentos) y resalta la burbuja 2.4s. |

### Media prioridad (mejora significativa)

| # | Funcionalidad | Notas |
|---|---|---|
| 6 | **Editar mensajes** | ✅ RPC `nx_enlace_edit_message` (migración 0021: solo autor, solo type text, no-eliminado, no-vacío). UI: menú ⋯ → "Editar" abre `EditMessageInline` en lugar de la burbuja; guarda con Enter, cancela con Esc; la burbuja muestra "editado". |
| 7 | **Eliminar mensajes** | ✅ RPC `nx_enlace_delete_message` (migración 0021+0022: borrado suave `deleted_at`+`content=null`, solo autor, text/image/file/location/sticker, desfija si estaba fijado, refresca el preview de la lista). UI: menú ⋯ → "Eliminar" con confirmación inline en el mismo popover; los demás participantes ven "🚫 Mensaje eliminado" en vivo vía realtime. |
| 8 | **Panel contextual rico** | ✅ InfoPanel ampliado: sección "Perfil" (área/puesto/teléfono del otro lado en directas vía `users_directory`) y "Detalles" (tipo, fecha y creador de la conversación). |
| 9 | **Skeletons / loading states** | ✅ `SkelRow` en "cargar mensajes anteriores", `Skel` en los resultados de búsqueda y en la lista de reenviar; el placeholder de imagen ya no es texto plano. |
| 10 | **Centro de notificaciones** | ✅ Página `/notificaciones` (centro ampliado: hasta 200, "marcar todo leído" fijo, filtros por kind, en vivo) + botón "Ver todas" en la campana. Reusa `kindMeta`/`dayLabel`/`timeAgo` de `notifications.tsx`. |

### Baja prioridad (nice to have)

| # | Funcionalidad | Notas |
|---|---|---|
| 11 | **Reenviar mensajes** | ✅ `ForwardSheet`: selección de conversación destino (excluye la actual, Anuncios solo para admin), copia del objeto en Storage para image/file, insert + `triggerChatPush` best-effort. Corregido el lookup de nombres por `user_id`. |
| 12 | **Audio messages** | ✅ `use-audio-recorder` (MediaRecorder webm/opus, flujo explícito tocar-grabar / enviar-cancelar, error de permisos con toast). Composer muestra franja de grabación con temporizador; la burbuja renderiza `<audio controls>` cuando `mime_type` es audio/*. |
| 13 | **Integración con EMU** | ✅ Señal `chatUnreadCount` en `EmuContext` (solo admin/empleado, mismo criterio que `isUnread` de la lista) + regla `chat-sin-leer` (prioridad medium/high según cantidad, CTA a /chat). No tapa solicitudes pendientes. |
| 14 | **Sincronización entre pestañas** | El outbox actual es por pestaña (memoria). Con BroadcastChannel se podría sincronizar. |
| 15 | **Ripple en botones** | ✅ `initRipple()` (listener delegado sobre `[data-ripple]`) + token CSS `.nx-ripple`. Aplicado en compositor (+/mic/enviar), "Nuevo" y CTAs principales del chat. |
| 16 | **Stickers** | ✅ Migración 0022 + `StickerPicker`: paquete de 32 emoji grandes (sin assets en Storage — el emoji viaja en `content`, la burbuja lo renderiza a ~80px con sombra). Se envían con `sendSticker` (outbox) y se reenvían igual que el texto. |
| 17 | **Compartir ubicación** | ✅ Migración 0022 (tipo `location` + columnas `lat`/`lng`) + `shareLocation` (Geolocation del dispositivo, errores traducidos a toast). La burbuja renderiza mapa por iframe OSM (sin API key) + link "Ver en Google Maps". |
| 18 | **Foto con cámara** | ✅ `CameraCapture` (getUserMedia → canvas → blob → tubería de adjuntos existente como image). Estados de arranque/denegado/sin-cámara dentro de la hoja, interruptor de cámara frontal/trasera. Requiere contexto seguro (https/localhost). |

---

## 4. Lo que ChatGPT sugiere bien (pero hay que adaptar)

### "La conversación debe ser el protagonista"

**YA se hizo** con el rediseño actual: el fondo beige y burbujas verdes desaparecieron. El área de mensajes usa `--surface-2` y ocupa todo el espacio disponible. El layout de dos paneles (lista + conversación) ya prioriza el contenido. Lo que falta: el **estado vacío** en `/chat` (root) podría ser mejor.

### "Jerarquía visual en la lista de chats"

El ConversationRow actual tiene: avatar 44px → nombre bold → preview → timestamp → badge. Es una jerarquía funcional pero podría mejorarse:
- Avatar más grande (48px) en escritorio
- Badge de no leídos con número (no solo punto)
- Preview con truncamiento más agresivo

### "No existe sensación de tiempo real"

**Sí existe en el código** (Realtime subscriptions, typing indicator), pero la UI no lo comunica visualmente:
- No hay animación al recibir un mensaje nuevo (el mensaje simplemente aparece)
- No hay "pulse" en la conversación cuando llega algo nuevo
- El typing indicator está implementado pero solo cambia texto en la cabecera

### "Panel contextual útil"

El InfoPanel actual es funcional pero limitado. Podría mostrar:
- Si es conversación de grupo: lista de miembros con roles, fecha de creación
- Archivos compartidos con vista previa
- Si hay una solicitud/incidencia/vacaciones vinculada (EMET tiene esos datos en otras tablas)

---

## 5. Recomendación: 4 documentos separados

ChatGPT sugiere bien la separación:

1. **Chat Design System** (ya existe en el código + este documento)
2. **Chat UX Specification** → flujos: crear conversación, enviar mensaje, adjuntar archivo, reaccionar, responder, buscar
3. **Realtime Architecture** → cómo funcionan las suscripciones, broadcasts, presence, notificaciones push
4. **Messaging State Machine** → ya existe en `message-state.ts`, solo documentarlo formalmente

---

## 6. Prioridad de implementación

```
FASE 1 ✅ (implementada — Jul 2026)
├── Notificaciones de navegador (Notifications API + banner de permiso en /chat)
├── Badge en título de la pestaña (useChatUnread)
├── Sonido al recibir mensaje (conversación abierta + watcher global, respeta muted)
├── Contador global de no leídos en sidebar / tab bar / spotlight
└── Badge numérico de no-leídos por conversación + animación de burbuja entrante

FASE 2 ✅ (implementada — Jul 2026)
├── Push real vía service worker (cubrir la app cerrada):
│   ├── Edge Function send-chat-push (participantes no-silenciados, VAPID,
│   │   limpieza de suscripciones 404/410) — requiere VAPID_PRIVATE_KEY y
│   │   VAPID_SUBJECT como secrets de la función (ver cabecera del archivo)
│   ├── public/sw.js: showNotification + tag por conversación + supresión
│   │   si la conversación ya está abierta y enfocada
│   ├── use-push-notifications.ts: registro tras el permiso (sin auto-prompt),
│   │   nudge desde el banner de /chat
│   └── triggerChatPush() en use-outbox y use-attachment-upload (best-effort)
├── Buscar dentro del chat (ConversationSearch + salto con carga de historial)
├── Editar / Eliminar mensajes (migración 0021: RPCs + borrado suave + preview)
├── Panel contextual rico (perfil del otro lado + detalles de la conversación)
└── Skeletons (historial, búsqueda, reenviar)

FASE 3 ✅ (implementada — Jul 2026)
├── Centro de notificaciones (/notificaciones + "Ver todas" en la campana)
├── Reenviar (ForwardSheet con copia en Storage para adjuntos)
├── Audio messages (use-audio-recorder + reproductor en burbuja)
├── Integración EMU (señal chatUnreadCount + regla chat-sin-leer)
└── Ripple + micro-interacciones (initRipple + data-ripple en CTAs del chat)

FASE CIERRE ✅ (implementada — Ago 2026, migración 0022)
├── Stickers (StickerPicker, emoji en content, sin Storage)
├── Ubicación (Geolocation → type location con lat/lng + mapa OSM)
├── Cámara (CameraCapture getUserMedia → upload como image)
└── Previews honestos por tipo (nx_enlace_preview_for) + borrado de location/sticker

Pendiente (fuera de alcance de estas fases)
└── Sincronización del outbox entre pestañas (BroadcastChannel)
```
