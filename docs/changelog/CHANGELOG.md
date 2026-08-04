# Changelog · Emet

> Formato: `[fecha] - descripción (commit)`. El historial por migraciones de DB está en `docs/changelog/MIGRATIONS.md`.

## 2026-08-04 · Chat — revertir paleta oscura a tonos originales más profundos

- **Revertido**: La paleta oscura del workspace del chat vuelve a los tonos originales `#05070B → #08111E → #101827 → #151D2B` (más oscuros, menos azulados) en lugar de `#0A121F → #0C1626 → #151D2B → #1A2434` que se aplicó en `fc0f948`.
- **Archivos**: `src/app/globals.css` — variables `--chat-ws-frame`, `--chat-list-bg`, `--chat-header-bg`, `--chat-bg` revertidas a valores originales.
- **Motivo**: Los tonos originales (`#05070B` negro profundo, `#08111E` azul muy oscuro) tienen mejor contraste y profundidad visual que los tonos intermedios azulados.

## 2026-08-03 · Chat — bloque de plataforma de mensajería moderna (grabando · outbox multi-pestaña · silencio por duración · lectura con hora)

- **Indicador "X está grabando un audio"**: `use-typing` extendido con evento broadcast `recording` (mismo canal efímero que "escribiendo…", auto-stop 3s). `use-audio-recorder` anuncia `on:true/false` al iniciar/soltar/cancelar; punto rojo pulsante + texto en lista (`conversation-row.tsx`) y header de la conversación.
- **Outbox multi-pestaña**: `BroadcastChannel` (`emet-chat-outbox`) en `use-outbox.ts` — el optimista que encola una pestaña y el fallo (`failed`) se reflejan al instante en las demás pestañas de la misma conversación (el INSERT confirmado ya lo cubre Realtime con dedupe por `client_id`).
- **Silencio por duración (8h / 1 semana / siempre)**: migración 0025 añade `conversation_participants.muted_until`; RPCs `nx_enlace_set_mute` (vencimiento opcional) y `nx_enlace_unmute`. Menú del header con las 3 duraciones, InfoPanel con chips + fecha de vencimiento ("Silenciado hasta 5 ago"), fila de la lista y menú contextual con el criterio de silencio efectivo. Push (`send-chat-push`) y watcher de no-leídos respetan `muted_until` en el futuro (el badge de no-leídos NO se oculta, solo se calla sonido/notificación).
- **Lectura con hora**: migración 0025 añade `messages.read_at`; `nx_enlace_mark_read` lo rellena (`coalesce(read_at, now())` solo desde sent/delivered). Los ticks de burbujas propias muestran "✓✓ Leído · HH:MM" (`MessageStatusIcon` + `readAt`).
- **Migración**: `supabase/migrations/0025_chat_mute_duration_read_at.sql` (aditiva, idempotente).

## 2026-08-03 · Roadmap del chat — checklist de plataforma de mensajería profesional (24 puntos)

- **Nuevo bloque en `docs/03-ROADMAP.md` (Fase 3)**: "Requisitos de plataforma de mensajería moderna" — los 24 puntos del equipo mapeados contra código real (✅/🟡/🟢): tiempo real, push (navegador ✅ / móvil 🟢), configuración por conversación, sonidos, vibración, estados del mensaje, confirmaciones de lectura, escribiendo/grabando, progreso de subida, editar/eliminar, responder/reenviar/copiar, búsqueda, fijados, online, sincronización, historial, reconexión, cola offline, presencia y checklist de terminado por área.
- **Confirmado contra el repo** (auditoría `src/app/chat/CHAT-DESIGN-SYSTEM-REVIEW.md`): tiempo real (Realtime Supabase), estados del mensaje (`message-state.ts`), escribiendo (`use-typing`), push VAPID, progreso de subida, editar/eliminar, reenviar, fijados, cola offline (`use-outbox`) y sonido de recibido ya existen.
- **Próximo bloque sugerido** (los 4 pendientes que llevaron a la migración 0025): indicador "grabando…", outbox multi-pestaña (BroadcastChannel), silenciar por duración y confirmaciones de lectura con hora — implementados el mismo día (ver entrada de arriba).

## 2026-08-03 · Feedback N3 del chat — arquitectura visual y Design Language

- **Layout de 4 columnas full-bleed** (patrón Signal Desktop): sin marco ni contenedor centrado — el módulo ocupa todo el ancho (`Shell` `wide` → `main md:p-0` + `max-w-none`). Sidebar 220 · Lista 380 · Conversación flexible · InfoPanel 340 como 3.ª columna SIEMPRE visible en desktop (antes overlay), colapsable en pantallas medianas. Altura del chat `calc(100dvh-3.5rem)`.
- **Header completo**: Avatar · Nombre · Estado + acciones búsqueda, llamada, videollamada y menú "more" (`Menu`/`MenuItem` de `os/ui`) con Información / Silenciar / Cerrar.
- **Iconos unificados Lucide**: stroke 2 (antes 1.75) en todo el chat; nuevos `phone` y `video` en `os/icons.tsx`.
- **Compositor con pesos iguales**: todos los botones a 34px, mismo radio y sin el círculo azul protagonista del micrófono/enviar; se agrega el botón de emoji/stickers al mismo nivel que `+`/adjuntar.
- **Burbujas premium**: borde hairline (`inset 0 0 0 0.5px`), sombra exterior sutil, padding `px-3.5 pt-2 pb-1.5`, gap avatar→burbuja 8px.
- **Reacciones literalmente pegadas** a la burbuja (`-mt-2.5`, solapan su borde inferior) estilo Signal.
- **Lista densa**: filas ~66px (avatar 48, `py-2.5`), dot de presencia "en línea" en conversaciones directas (heartbeats desde el layout).
- **Fondo con patrón**: `nx-msg-panel` — base + puntos a 2–4% de opacidad (como Signal); tema oscuro menos negro (`#0A121F → #0C1626 → #151D2B → #1A2434`, nunca negro puro).
- **Swipe blindado**: franjas de acciones con `z-index: 0`, tarjeta `z-[1]`, `will-change: transform` durante el arrastre — el texto nunca asoma sobre las acciones.
- **Animación nativa** de entrada de la conversación (`nx-panel-in`, 200ms).
- Docs: nuevo `docs/design/CHAT-DESIGN-LANGUAGE.md` (principios Apple HIG + Signal + Linear/Notion + Stripe), `docs/modules/CHAT.md` actualizado, CHANGELOG.

## 2026-08-03 · Feedback N2 del chat — swipe estructural, aire y estados visibles

- **Root cause del swipe corregido**: la tarjeta era `transparent`, así que las dos franjas de acciones (Leído/Archivar + Fijar/Silenciar, 312px en total) se veían SIEMPRE a través del texto. Ahora `.conv-card` tiene fondo opaco igual al de la lista: las acciones quedan ocultas detrás y la fila se ve plana; durante el gesto la tarjeta solo se traslada con `transform` (GPU), nunca se comprime ni refluja. Avatar 56×56 `object-cover` `shrink-0`.
- **Acciones 72–84px** (se mantienen a 78px cada una), esquinas conservadas por el shell `rounded-[14px] overflow-hidden`.
- **Profundidad hover sutil**: la fila se eleva 2px con borde hairline y sombra ligera (spec: sin sombras fuertes), transición 180ms.
- **Ancho**: lista de conversaciones 330→380px; el módulo chat ahora llega a **1700px** vía prop `wide` nueva en `Shell`/`AppShell` (el resto de la app conserva 1140px).
- **Estado vacío del panel derecho**: ilustración SVG propia, "No hay conversación seleccionada", subtítulo y 3 accesos rápidos (Crear chat / Buscar compañero / Crear grupo) — el de grupo abre el sheet en modo grupo.
- **Buscador completo**: Ctrl+K/⌘K lo enfoca (el Shell cede el atajo en `/chat`), botón de limpiar, hint ⌘K, pulso del icono mientras busca mensajes.
- **Botón "Nuevo mensaje" estilo Signal**: gradiente con brillo superior, hover elevado, active con presión (`nx-new-btn`).
- **Estados visibles**: pill "Sin conexión — reconectando…" en la lista cuando el navegador está offline (suma al no-leído/silenciado/fijado/escribiendo/en línea/subiendo/error ya presentes).
- **Aire/spacing**: más separación entre título/botón/tabs/buscador/conversaciones y en la lista.
- **Animación** de apertura del panel derecho (`nx-panel-in`, 200ms) al abrir una conversación.

## 2026-08-03 · Polaco N1 del chat (Signal + WhatsApp Desktop + Apple Messages)

- **Scrim Signal unificado** en todos los overlays (Sheet, Dialog, CenteredOverlay, DateSheet, Notificaciones móviles, PausaActiva, calendario): `rgba(0,0,0,.42)` + `blur(18px) saturate(.75) brightness(.72)`. Corrige la clase completa de clics fantasma (`pointer-events`) en overlays que faltaban (Dialog, PausaActiva, date-sheet móvil). ADR-0016.
- **Burbujas premium**: máx 72%, radio 18px, cola sutil al cambiar de remitente, imágenes 14px sin sombras pesadas, gap reducido.
- **Reacciones estilo Signal**: solo a mensajes de OTROS; la franja es de solo lectura en mensajes propios (`ReactionStrip` con `onToggle` opcional).
- **Skeletons en imágenes**: el fallback "Cargando imagen…" ahora es `Skel` con shimmer + fade de carga en `SmartImage`.
- **Compositor compacto**: 46px, padding reducido, focus ring, micrófono 2px menor que enviar, placeholder tenue.
- **Lista de conversaciones**: filas planas (sin tarjetas/sombras/elevación), avatars 48px, separación 2px, buscador pastilla estilo Signal (icono 14, placeholder gris).
- **Header compacto** (52px, avatar 36) y **panel informativo por secciones sin tarjetas** (miembros, perfil, detalles, notificaciones, archivos).
- **Animaciones**: ticks de leído con pop (220ms), indicador de escritura con tres puntos animados (`typing-indicator.tsx`, keyframe `nx-typing-dot`) en lista y header.
- **Menús contextuales de clic derecho**: mensaje (Reaccionar/Responder/Reenviar/Copiar/Fijar/Editar/Eliminar/Info) y conversación (Fijar/Silenciar/Archivar/Marcar leído/Abrir), vía `context-menu.tsx` (portal, recorte a viewport, Esc/scroll cierra).
- **SPEC-004**: emojis Apple únicamente (canon), reacciones solo a otros.
- Docs: ROADMAP con Niveles 1/2/3, DECISIONES-PENDIENTES P-008/P-009, ADR-0016, EMOJIS.md, EMET_CANON.md, CHANGELOG.

## 2026-08-03 · Rebrand completo Nexus → Emet (`be31144`)

- Rename de ruta visible `/admin/nexus` → `/admin/asistencia` (10 edits de rutas/textos).
- README raíz reescrito a EMET, apuntando al índice `docs/00-README.md`.
- Eliminación de `NexusMark` muerto de `src/components/os/icons.tsx`.
- `package.json` → `name: emet`.
- ~22 edits de comentarios en `src/` y `supabase/`; 14 edits de Edge Functions y calendario (`EMET · Edge Function`, URLs `emet.uno`, `admin/asistencia`, boundary `emet-`, deps `from: "Emet"`).
- Build verificado (`/admin/asistencia` presente, `/admin/nexus` ausente).

## 2026-07 · Documentación canónica (esta entrega)

- Estructura completa de docs: raíz (7), `architecture/` (8), `design/` (21), `modules/` (11), `coding/` (10), `decisions/` (15 ADRs), `changelog/` (2).
- Deuda de branding registrada en `docs/DECISIONES-PENDIENTES.md` (P-001…P-007).

## 2026 · Base del producto (antes del rebrand)

Fases que llevaron al estado actual; el detalle de DB en `MIGRATIONS.md`.

- **Núcleo**: personas y roles (admin, empleado, coordinador, departamento, rh); auth Supabase SSR.
- **Tiempo**: fichaje, asistencia, saldos de vacaciones, días inhábiles, estados de jornada, pausa activa.
- **Trabajo**: proyectos, actividades, `task_time_logs`.
- **Solicitudes**: cobertura/diseño con aprobación y validación server-side.
- **Calendario**: agenda de equipo + Google Calendar (Edge Functions `gcal-*`).
- **Chat**: conversaciones, mensajes con estados/read receipts, reacciones, stickers, adjuntos con pipeline WebP en bucket privado, Web Push (VAPID), outbox offline.
- **Recorridos/preptour**: demos de recorridos y tour de onboarding.
- **Reportes**: asistencia semanal + exportación Excel (exceljs) y PDF (print CSS).
- **EMU Fase 1**: asistente determinista (context + decision engine, sin LLM).
