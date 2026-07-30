# Revisión: EMET Chat Design System (vs. código real)

> Comparación del documento generado por ChatGPT contra el código fuente existente.
> Julio 2026.

---

## 1. Errores del documento

### "Morado EMET como color principal"

**Falso.** El acento principal de EMET es `--accent: #0066FF` (azul). El morado (`--purple: #5856D6`) aparece solo en tokens secundarios y en el mesh gradient del rol RH. El chat ya usa `--accent` (azul) para el botón enviar, checkmarks de leído, reacciones propias y pinned messages — esto no debe cambiarse a morado.

### "Sidebar colapsada 88-96px / expandida 240px"

No aplica. EMET ya tiene un AppShell con sidebar (`Nexus OS`). El chat vive dentro de ese shell. No debe tener su propia sidebar — contradice la integración nativa que acabamos de hacer.

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
| **Adjuntar archivos** | ✅ Existe `AttachmentSheet` con galería y documento (cámara/ubicación/audio deshabilitados con "Próximamente") |
| **Agrupar mensajes consecutivos** | ✅ Existe con `prevSameSender`, avatar spacing, márgenes reducidos |
| **Máximo 70-78% del ancho** | ✅ `max-w-[78%]` en cada mensaje |
| **Enter envía, Shift+Enter nueva línea** | ✅ Implementado en `onKeyDown` |
| **Burbuja propia vs. recibida** | ✅ Recién migrado a `--accent-tint` / `--surface` |

---

## 3. Lo que NO existe y debería priorizarse

Priorizado por impacto vs. esfuerzo:

### Alta prioridad (bloqueante para experiencia real)

| # | Funcionalidad | Notas |
|---|---|---|
| 1 | **Push notifications** | No hay sistema de notificaciones push del navegador. Las notificaciones actuales son toasts internos (cuando la app está abierta). |
| 2 | **Badge en favicon/tab** | El contador de no leídos no se refleja en el título de la pestaña ni en el favicon. |
| 3 | **Sonido al recibir mensaje** | No hay reproducción de audio al recibir un mensaje nuevo. |
| 4 | **Contador global de no leídos** | El sidebar no muestra un badge "N" en el icono de Chat cuando hay mensajes sin leer. |
| 5 | **Buscar dentro del chat** | La búsqueda actual es global (personas/grupos/mensajes en la lista). No hay búsqueda dentro de una conversación específica. |

### Media prioridad (mejora significativa)

| # | Funcionalidad | Notas |
|---|---|---|
| 6 | **Editar mensajes** | No existe UI ni RPC para editar. La columna `edited` existe en la BD pero no se usa. |
| 7 | **Eliminar mensajes** | La columna `deleted_at` existe en la BD pero no hay UI para eliminar. |
| 8 | **Panel contextual rico** | El InfoPanel actual muestra miembros, muted toggle y archivos recientes. ChatGPT sugiere eventos, tareas, solicitudes relacionadas — información que YA existe en otras tablas de EMET. |
| 9 | **Skeletons / loading states** | El chat muestra "Cargando imagen…" y "Cargando mensajes anteriores…" como texto. No hay skeletons visuales. |
| 10 | **Centro de notificaciones** | No hay un `/notifications` que centralice todos los eventos (mensajes, solicitudes, incidencias, vacaciones). |

### Baja prioridad (nice to have)

| # | Funcionalidad | Notas |
|---|---|---|
| 11 | **Reenviar mensajes** | Requiere UI de selección + lógica de duplicación |
| 12 | **Audio messages** | Requiere `getUserMedia`, MediaRecorder, almacenamiento y reproductor |
| 13 | **Integración con EMU** | Depende de que EMU exista como agente/módulo |
| 14 | **Sincronización entre pestañas** | El outbox actual es por pestaña (memoria). Con BroadcastChannel se podría sincronizar. |
| 15 | **Ripple en botones** | Micro-interacción de bajo esfuerzo pero alto impacto percibido |

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
FASE 1 (ahora mismo)
├── Push notifications (supabase functions + service worker)
├── Badge en favicon/tab
├── Sonido al recibir mensaje
└── Contador global de no leídos en sidebar

FASE 2 (siguiente)
├── Buscar dentro del chat
├── Editar / Eliminar mensajes
├── Panel contextual rico (info de EMET cruzada)
└── Skeletons

FASE 3 (después)
├── Centro de notificaciones
├── Reenviar
├── Audio messages
├── Integración EMU
└── Ripple + micro-interacciones
```
