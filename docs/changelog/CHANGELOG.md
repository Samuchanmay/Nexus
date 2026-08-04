# Changelog · Emet

> Formato: `[fecha] - descripción (commit)`. El historial por migraciones de DB está en `docs/changelog/MIGRATIONS.md`.

## 2026-08-04 · Rediseño UI/UX: Módulo de Personas y Biblioteca - Estilo Linear/Notion

### Personas (Directorio)
- **Header compacto**: Título 32px con contadores de estado (activos, incompletos) con iconos de color.
- **Buscador Spotlight**: 44px alto, icono de lupa, placeholder descriptivo, focus ring sutil.
- **Filtros mejorados**: Pills con contadores, activo con fondo sólido y sombra.
- **Tarjetas rediseñadas**: Padding 20px, border-radius 16px, avatares 48px.
- **Jerarquía visual**: Nombre 16px bold domina, metadata 13px secundaria.
- **Badge "Incompleto"**: Más discreto con fondo warning-tint.
- **Grupos**: 32px de espaciado entre grupos, headers con contador en badge.
- **Animaciones**: Hover con elevación 2px y sombra suave.

### Biblioteca
- **Header compacto**: Título 32px con subtítulo descriptivo.
- **Buscador Spotlight**: Mismo patrón que Personas.
- **Filtros discretos**: Pills con contadores, transiciones suaves.
- **Estado vacío**: Icono 64px, mensaje humano, descripción max-width 360px.
- **Lista tipo Notion**: Filas compactas con columnas (Actividad, Tipo, Responsable, Fecha).
- **Hover states**: Cambio de fondo sutil, título cambia a color de acento.
- **Badges semánticos**: Verde para "Completado".

### Design System Actualizado
- **Patrón 10.6.2**: Directorio de Personas con Buscador Spotlight.
- **Patrón 10.6.3**: Biblioteca con Lista Tipo Notion.
- **Archivos**: `src/app/admin/empleados/client.tsx`, `src/app/admin/biblioteca/client.tsx`, `docs/design/EMET-DESIGN-PRINCIPLES.md`.

## 2026-08-04 · Rediseño UI/UX: Módulo de Configuración - Progressive Disclosure

### Mejoras de jerarquía visual y experiencia
- **Dashboard superior eliminado**: Removidas las 4 tarjetas de estadísticas que ocupaban espacio innecesario.
- **Header compacto**: Título "Configuración" a 32px con espaciado optimizado.
- **Sidebar mejorado**: Grupos con labels uppercase, items con radios de 12px y transiciones suaves.
- **Otros accesos integrados**: Links rápidos movidos al sidebar con separador visual.
- **Panel de contenido mejorado**: Título de sección a 20px, icono más grande (40px), mejor jerarquía visual.
- **Progressive disclosure**: Solo una sección expandida a la vez, reduciendo ruido visual en ~70%.
- **Animaciones sutiles**: Transiciones de 200ms en hover, chevron indicador en sección activa.
- **Archivos**: `src/app/admin/config/hub-client.tsx`.

## 2026-08-04 · Rediseño UI/UX: Módulo de Solicitudes estilo Linear/Notion

### Mejoras de jerarquía visual y experiencia
- **Header compacto**: Título "Solicitudes" a 40px con espaciado optimizado (8px título-subtítulo, 24px subtítulo-contenido).
- **Tabs rediseñados**: Segmented control estilo Linear con contadores animados y transición suave.
- **Estado vacío mejorado**: Icono de 64px, mensajes más humanos ("Todo está al día"), ancho máximo de 360px.
- **Tarjetas informativas**: Dos tarjetas auxiliares en estado vacío ("Responde rápido" y "Trabajo colaborativo").
- **Tarjetas de solicitudes**: Radio de 24px, padding de 32px, hover con elevación y sombra.
- **Badges mejorados**: Colores semánticos más suaves, padding y radios consistentes.
- **Metadata con iconos**: Fechas y ubicaciones con iconos de calendario y mapa.
- **Animaciones de entrada**: Fade + slide desde arriba (200ms) al cargar solicitudes.
- **Tipografía con contraste**: Títulos de 18px, metadata de 13px, mejor jerarquía visual.
- **Estados de hover**: Tarjetas con elevación y cambio de color en título.
- **Archivos**: `src/app/admin/solicitudes/client.tsx`.

## 2026-08-04 · Rediseño UI/UX: Módulo de Actividades estilo Linear/Plane/Notion

### Mejoras de jerarquía visual y experiencia
- **Encabezado rediseñado**: Título "Actividades" a 40px con subtítulo descriptivo, contadores separados visualmente.
- **Botones mejorados**: Un botón principal azul con sombra y hover elevado, botones secundarios ghost más discretos.
- **Selector Lista/Pipeline**: Rediseñado estilo Apple con animación deslizante y padding mejorado.
- **Vista Lista tipo Notion**: Convertida de tarjetas grandes a filas compactas con columnas (Actividad, Estado, Responsable, Entrega, Prioridad).
- **Colores por estado**: Solicitada (gris), Aprobada (azul), En progreso (morado), En revisión (amarillo), Completada (verde).
- **Hover states**: Filas con hover sutil, tarjetas con elevación y sombra en hover.
- **Acciones en hover**: Botón de menú (⋯) aparece solo al pasar el cursor.
- **Pipeline rediseñado**: Inspirado en Plane, columnas más anchas (300px), tarjetas con padding 16px y bordes redondeados 16px.
- **Tarjetas Pipeline mejoradas**: Padding interno aumentado, avatares de 24px, fechas con icono de calendario.
- **Scroll horizontal invisible**: Pipeline con scroll suave sin scrollbar visible.
- **Animaciones sutiles**: Transiciones de 200ms en hover, elevación de tarjetas, escalas en botones.
- **Tipografía con contraste**: Títulos de 15px en filas, 14px en tarjetas, mejor jerarquía visual.
- **Eliminadas líneas divisorias**: Reemplazadas con espacio y hover states.
- **Archivos**: `src/app/admin/proyectos/client.tsx`.

## 2026-08-04 · Rediseño UI/UX: Dashboard principal estilo Linear/Apple

### Mejoras de jerarquía visual y experiencia
- **Hero principal rediseñado**: Título "¿Cómo va el día?" a 48px, tiempo trabajado a 64px, barra de progreso gruesa (8px) con gradiente.
- **Tarjeta de jornada simplificada**: Solo información esencial (estado, tiempo, progreso, datos clave), eliminado ruido visual.
- **Botón principal mejorado**: 48px de alto, sombra prominente, hover con elevación y transición suave.
- **Métricas rediseñadas**: Cards más grandes con iconos en contenedores de color, números a 32px.
- **Sección de equipo mejorada**: Chips de estado más grandes y visibles, lista con avatares de 48px, indicadores de estado animados.
- **Actividades y solicitudes**: Filas más espaciadas con hover states, barras de progreso con colores, badges semánticos.
- **Animaciones sutiles**: Ping en indicadores de estado, transiciones de 200ms en hover, escalas en chips.
- **Tipografía con más contraste**: Diferencias marcadas entre niveles (48px → 32px → 22px → 15px → 13px).
- **Espaciados aumentados**: 40px entre secciones principales, 24px entre elementos relacionados.
- **Archivos**: `src/app/os/page.tsx`.

## 2026-08-04 · Fase 4: Reportes unificados con colores y ausencias

### Reportes unificados (admin + RH)
- **Componente compartido**: `src/components/shared/xlsx-report.tsx` — mismo formato Excel para admin y RH.
- **Colores por empleado**: cada bloque usa el `nexus_color` del empleado.
- **Ausencias con colores semánticos**: Vacaciones (morado), Incapacidad (rojo), Permiso (amarillo), Comisión (azul), Home office (verde), etc.
- **RH ahora tiene el mismo reporte**: botón "Excel semanal" junto al CSV, con toda la información de asistencia + ausencias.
- **Attendance Status Resolver integrado**: muestra automáticamente el motivo de ausencia (vacaciones, permiso, día inhábil, etc.) cuando no hay entrada.
- **Archivos**: `src/components/shared/xlsx-report.tsx`, `src/app/admin/asistencia/xlsx-weekly-report.tsx`, `src/app/rh/client.tsx`.

## 2026-08-04 · Fase 3: Sincronización bidireccional con Google Calendar

### Sincronización de eventos con Google Calendar (migración 0031)
- **Nuevas tablas**: `event_google_mapping` (mapeo eventos Emet ↔ Google), `google_calendar_webhooks` (webhooks activos), `google_sync_logs` (logs de sincronización).
- **Nuevos campos en institutional_events**: `sync_to_google` (boolean), `google_calendar_id` (ID del calendario destino).
- **Edge Functions**:
  - `gcal-sync-event`: crea/actualiza/elimina eventos en Google Calendar
  - `gcal-webhook`: recibe notificaciones push de Google Calendar
  - `gcal-register-webhook`: registra webhook con Google
  - `gcal-unregister-webhook`: cancela webhook
- **UI**: switch "Sincronizar con Google Calendar" en el formulario de eventos.
- **Flujo bidireccional**: 
  - Emet → Google: al crear/editar evento con sync activado
  - Google → Emet: vía webhooks (cada 5 min verifica cambios)
- **Archivos**: `supabase/migrations/0031_google_calendar_sync.sql`, `supabase/functions/gcal-sync-event/`, `supabase/functions/gcal-webhook/`, `supabase/functions/gcal-register-webhook/`, `supabase/functions/gcal-unregister-webhook/`, `src/app/admin/calendario/client.tsx`, `src/app/admin/calendario/page.tsx`.

## 2026-08-04 · Fase 2: Check-in/out en eventos con validación GPS

### Check-in/out de eventos (migración 0030)
- **Funciones RPC**: `event_check_in()` con validación GPS, `event_check_out()` con cálculo de duración, `get_event_coverage_status()`, `get_event_coverage_summary()`.
- **Validación GPS**: calcula distancia entre usuario y ubicación del evento usando fórmula Haversine simplificada. Valida radio configurable (default 150m).
- **Estados de cobertura**: `not_checked_in`, `in_coverage`, `coverage_completed`.
- **UI**: sheet de cobertura al hacer clic en evento de hoy. Muestra estado, duración en tiempo real, botones "Iniciar cobertura" / "Finalizar cobertura".
- **GPS automático**: solicita ubicación al abrir el sheet si el evento es externo.
- **Historial**: registra check-in/out en `event_history` con coordenadas y distancia.
- **Archivos**: `supabase/migrations/0030_event_checkin_gps.sql`, `src/app/admin/calendario/client.tsx`.

## 2026-08-04 · Fase 1: Eventos ampliados + sistema de auditoría de negocio

### Eventos ampliados (migraciones 0028 + 0029)
- **Nuevos campos en eventos**: hora inicio/fin, cliente, departamento solicitante, ubicación (interno/externo, nombre, dirección, GPS, radio), responsable, estado (pendiente/confirmado/cancelado), prioridad (alta/media/baja), descripción.
- **Nuevas tablas**: `event_participants` (responsable + equipo asignado), `event_attendance` (check-in/out en eventos), `event_history` (historial de cambios).
- **Funciones helper**: `get_event_participants()`, `get_event_coverage_duration()`.
- **UI actualizada**: formulario de eventos con secciones (información general, fecha/hora, cliente/departamento, ubicación, descripción).
- **Archivos**: `supabase/migrations/0028_events_extended.sql`, `supabase/migrations/0029_event_participants_attendance.sql`, `src/app/admin/calendario/client.tsx`, `src/app/admin/calendario/page.tsx`.

### Sistema de auditoría de negocio
- **BUSINESS_RULES.md**: 38 reglas de negocio documentadas (asistencia, eventos, vacaciones, permisos, chat, usuarios, proyectos, auditoría). Incluye transiciones de estado prohibidas y casos extremos.
- **docs/testing/**: casos de prueba extremos por módulo (asistencia.md, chat.md, calendario.md).
- **DEPENDENCIAS.md**: mapa de dependencias entre módulos (qué afecta qué al modificar).
- **Checklist de auditoría**: 15 puntos obligatorios antes de mergear cambios.

## 2026-08-04 · Asistencia — edición de días pasados + formato dd/mm/aaaa

- **Selector de fecha**: ahora puedes ver y editar cualquier día pasado, no solo el día actual. Input de fecha en el header de `/admin/asistencia`.
- **Edición sin restricciones**: el botón "Corregir" aparece siempre (no solo cuando falta entrada o salida). Si ya existe registro, hace UPDATE; si no, hace INSERT.
- **Formato de fechas**: cambiado de dd/mm/yy a dd/mm/aaaa (estándar mexicano completo) en la función `dmy()` de `src/lib/tz.ts`.
- **Archivos**: `src/app/admin/asistencia/page.tsx`, `src/app/admin/asistencia/client.tsx`, `src/lib/tz.ts`.

## 2026-08-04 · Asistencia — edición de horarios por admin (solo cuando falta entrada o salida)

- **Nueva funcionalidad**: el admin puede corregir entrada/salida cuando el empleado olvidó marcar.
- **Restricción**: solo se puede editar cuando **falta entrada o falta salida**. Si ya marcó ambas, no hay botón de edición.
- **Componente**: `EditAttendanceSheet` con TimePicker estilo Apple (hora/minutos/AM-PM).
- **Validaciones inteligentes en tiempo real**:
  - Detecta si la salida es anterior a la entrada
  - Alerta si la jornada es mayor a 16 horas
  - Alerta si la jornada es menor a 15 minutos
  - Muestra el total trabajado en tiempo real mientras se edita
- **Historial de correcciones**: tabla `attendance_corrections` registra quién corrigió, cuándo, qué cambió y el motivo.
- **Migración**: `supabase/migrations/0027_attendance_corrections_history.sql` (aditiva, idempotente).
- **Archivos**: `src/components/os/edit-attendance-sheet.tsx`, `src/app/admin/asistencia/client.tsx`, `supabase/migrations/0027_attendance_corrections_history.sql`.

## 2026-08-04 · Design System — Emet Design Principles v1 (especificación oficial)

- **Nuevo documento**: `docs/design/EMET-DESIGN-PRINCIPLES.md` — especificación obligatoria para todo el proyecto basada en Apple HIG + Linear + Notion + Stripe.
- **Principios clave**:
  - Eliminar antes que agregar
  - Una sola acción principal por pantalla
  - Una sola fuente de atención (jerarquía clara)
  - Menos tarjetas, más texto
  - Padding consistente (escala de 8 puntos)
  - Tipografía antes que color
  - Mucho menos texto
  - Toda pantalla debe responder 3 preguntas en 3 segundos
- **Reglas visuales**: máximo 3 colores de énfasis, escala tipográfica 12-40px, radios 8-20px, sombras por tokens
- **Checklist de revisión**: 10 puntos obligatorios antes de mergear cualquier pantalla nueva
- **Motivo**: Emet debe dejar de sentirse como un conjunto de pantallas y empezar a percibirse como un producto cohesionado de nivel profesional.

## 2026-08-04 · Chat — revertir paleta oscura a tonos originales más profundos

- **Revertido**: La paleta oscura del workspace del chat vuelve a los tonos originales `#05070B → #08111E → #101827 → #151D2B` (más oscuros, menos azulados) en lugar de `#0A121F → #0C1626 → #151D2B → #1A2434` que se aplicó en `fc0f948`.
- **Archivos**: `src/app/globals.css` — variables `--chat-ws-frame`, `--chat-list-bg`, `--chat-header-bg`, `--chat-bg` revertidas a valores originales.
- **Motivo**: Los tonos originales (`#05070B` negro profundo, `#08111E` azul muy oscuro) tienen mejor contraste y profundidad visual que los tonos intermedios azulados.

## 2026-08-04 · Asistencia — quitar "Solicitar validación RH" + fix tema chat

- **Popup de salida olvidada**: se eliminó el botón "Solicitar validación RH" de `resolve-pending-exit.tsx` y `jornada-watcher.tsx`. Ahora el empleado solo puede **Guardar** la hora de salida (sin pedir validación a RH). El admin verá el historial de cambios.
- **Fix tema en chat**: `ThemeProvider` ahora usa inicializador perezoso (lazy init) que lee `data-theme` directamente en `useState` en vez de sincronizar en `useEffect`. Esto elimina el flash de tema claro al entrar al chat cuando el usuario tiene modo oscuro activado.
- **Archivos**: `src/components/os/resolve-pending-exit.tsx`, `src/components/os/jornada-watcher.tsx`, `src/lib/theme.tsx`.

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
