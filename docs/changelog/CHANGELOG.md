# Changelog · Emet

> Formato: `[fecha] - descripción (commit)`. El historial por migraciones de DB está en `docs/changelog/MIGRATIONS.md`.

## 2026-08-05 · W2/W3 cerrados: retrofit tipográfico completo + última pasada de tamaños sueltos

### Última pasada (6 archivos, 18 tamaños normalizados)
- `src/app/admin/calendario/client.tsx`: 3 tamaños (13px→13.5px, 2× 11px→12px)
- `src/components/os/edit-attendance-sheet.tsx`: 3 tamaños (13px→13.5px)
- `src/components/ui.tsx`: 1 tamaño (fontSize: 13 → 13.5)
- `src/app/globals.css`: 4 tamaños en v6 (13px→13.5px, 18px→19px, 17px→16px)
- `src/app/admin/proyectos/client.tsx`: 4 tamaños en plantillas de impresión (13px→13.5px, 22px→21px)
- `src/app/rh/client.tsx`: 9 tamaños en reportes (11px→12px, 13px→13.5px, 20px→21px, 22px→21px)

### Auditoría final
- **0 tamaños fuera de escala** en todo `src/` (excepciones <11px documentadas en `TYPOGRAPHY.md`)
- Escala canónica `--fs-*` aplicada consistentemente: 12/12.5/13.5/14/15/16/19/21/24/28/42

## 2026-08-05 · Chat Fase 3: "Leído por …" en grupos + "Eliminar para mí" + cierre Fase 3

### Qué cambió
- **Migración 0037** (`supabase/migrations/0037_chat_reads_and_hidden.sql`):
  - `message_reads(message_id, user_id, read_at)` — un recibo por lector por mensaje; alimenta el "Leído por Ana, Luis +3" bajo las burbujas propias en grupos. En directas no cambia nada (sigue el ✓✓ con hora de 0025).
  - `message_hidden(user_id, message_id)` — "Eliminar para mí": borrado suave POR USUARIO. La política RLS `messages_select` se recrea para excluir de todos los SELECTs (feed, scroll, fijado) lo que el usuario ocultó; los demás lo siguen viendo.
  - RPCs nuevos (patrón security definer): `nx_enlace_mark_messages_read(uuid[])` (lote, reemplaza el bucle por mensaje que hacía el cliente), `nx_enlace_message_reads(uuid[])` (recibos con membrecía explícita), `nx_enlace_hide_message(uuid)` / `nx_enlace_show_message(uuid)`. `nx_search_messages` (0036) se recrea para no devolver mensajes ocultados.
  - `message_reads`/`message_hidden` agregadas a la publicación Realtime + `REPLICA IDENTITY FULL` (mismo criterio que 0026): "Leído por" se actualiza en vivo cuando otro miembro abre el chat.
- **`src/app/chat/[id]/client.tsx`**: al abrir marca el lote visible con el RPC nuevo y carga los recibos; listener Realtime de `message_reads` (insert/delete) para lecturas en vivo; en grupos las burbujas propias muestran "Leído por …" (máx. 2 nombres + "+N") cuando hay lectores; `MessageMenu` gana "Eliminar para mí" (todos) y el de "Eliminar" propio pasa a llamarse "Eliminar para todos".
- **`src/lib/chat/use-outbox.ts`**: backoff exponencial con jitter (1s/2s/4s, cap 8s, ±20% aleatorio) para evitar thundering herd cuando múltiples usuarios reintentan al mismo tiempo. **Cierra la Fase 3 del chat.**
- **`src/app/chat/[id]/page.tsx`**: sin cambios — el filtro de ocultados lo aplica la RLS en el SELECT del feed.

### Para la nube
- **Pendiente de aplicar en el SQL Editor de emet.uno**: `docs/MIGRACIONES-APLICAR-0037-CHAT-LECTURAS-Y-OCULTAR.sql` (idempotente).

### Archivos
- `supabase/migrations/0037_chat_reads_and_hidden.sql`, `docs/MIGRACIONES-APLICAR-0037-CHAT-LECTURAS-Y-OCULTAR.sql`
- `src/app/chat/[id]/client.tsx`, `src/lib/chat/use-outbox.ts`, `docs/03-ROADMAP.md`

## 2026-08-05 · Chat: búsqueda cross-conversación (cierre Fase 3 §16)

### Qué cambió
- **Migración 0036** (`supabase/migrations/0036_chat_search_messages.sql`): índice GIN trigram sobre `messages.content` + RPC `nx_search_messages(query, limit)`. Busca en TODAS las conversaciones del usuario con un solo round-trip, remitente y conversación pre-unidos, y escapa comodines SQL (`%`/`_`) para que se busque literal. Para la nube: `docs/MIGRACIONES-APLICAR-0036-CHAT-SEARCH.sql`.
- **`src/app/chat/client.tsx`**: la caja "Buscar conversaciones y mensajes…" usa el RPC; resultados agrupados por conversación (avatar + nombre + conteo, máx. 3 hits por grupo). Cae a la consulta directa si la migración aún no está en la nube.
- **Deep-link al mensaje exacto**: el hit navega a `/chat/:id?msg=…`; `page.tsx` pasa `initialJumpTarget` y el cliente de la conversación salta y resalta el mensaje aunque esté fuera de la página cargada (reusa la maquinaria de `loadMore`/`jumpTarget` existente).

### Archivos
- `supabase/migrations/0036_chat_search_messages.sql`, `docs/MIGRACIONES-APLICAR-0036-CHAT-SEARCH.sql`
- `src/app/chat/client.tsx`, `src/app/chat/[id]/page.tsx`, `src/app/chat/[id]/client.tsx`
- `docs/03-ROADMAP.md`

## 2026-08-05 · Fase 2 cerrada: retrofit tipográfico canónico + ripple global

### Retrofit tipográfico W2/W3 (normalización de tamaños sueltos)
- La escala `--fs-*` (12/12.5/13.5/14/15/16/19/21/24/28/42) se registró como utilidades de Tailwind (`text-tag`, `text-base`, `text-title`, `text-display`, …) en `tailwind.config.ts` — el token se vuelve real, no solo documentado.
- 423 tamaños sueltos normalizados en 75 archivos: 11/11.5→12, 13→13.5, 14.5→14, 15.5→15, 17→16, 18→19, 20→19, 22→21, 23→24, 26/27/30/32→28. Los títulos de página inline (32px) ahora coinciden con `PageHeader` (28px, `--fs-display`).
- Excepciones documentadas y congeladas en `TYPOGRAPHY.md`: <11px (micro-densidad del calendario) y ≥34px (tier hero/bienvenida).

### Ripple global (menú + botones)
- `ripple.ts` robustecido: `position:relative` solo si el host es estático (no pisa absolute/fixed), `overflow:hidden` condicional, respeta `prefers-reduced-motion` (JS + CSS), solo botón izquierdo del ratón, ignora hosts deshabilitados y responde a Enter/Espacio (paridad de accesibilidad).
- Selector extendido al vocabulario de botones del sistema (`.btn-primary/.btn-secondary/.btn-tertiary/.btn-ok`) + `data-ripple` en el menú: sidebar, tab bar móvil, Spotlight (⌘K), DomainTabs, botón central de fichar, avatar y buscadores del header — y en `Button`/`IconButton` (`components/os/ui.tsx`).

### Archivos
- `tailwind.config.ts`, `src/lib/ripple.ts`, `src/components/os/{ui,shell,domain-tabs}.tsx`, `src/app/globals.css`, 75 archivos con tamaños normalizados, `docs/design/TYPOGRAPHY.md`, `docs/03-ROADMAP.md`.

## 2026-08-05 · Fix: la corrección de asistencia no se guardaba (RLS)

### Bug
- **Síntoma**: al guardar una corrección de entrada/salida aparecía "No se pudo guardar la corrección" (mensaje genérico que ocultaba el error real).

### Causa raíz
- **`public.attendance` no tiene política RLS de UPDATE y su única política de INSERT (`att_insert_own`) solo permite registros propios**. El admin escribe asistencia de OTRO empleado → RLS rechaza con `42501 new row violates row-level security policy`, que el catch convertía en el mensaje genérico.
- Afectaba también a `adminResolvePendingExit` (mismo insert ajeno).

### Solución
- **Migración 0035**: políticas `att_admin_update` (UPDATE) y `att_admin_insert_any` (INSERT) para admin/rh, alineadas con `att_read`.
- **Cliente** (`edit-attendance-sheet.tsx`): el toast muestra ahora el error real de Supabase + `console.error`, log del payload antes de escribir, y normalización `timeCol("HH:MM"|"HH:MM:SS") → "HH:MM:SS"` (defensiva contra el doble `:00`).
- Verificado: el formato del TimePicker (`"HH:MM"` 24h) y `logAdminAction` (fire-and-forget) **no** eran la causa.

### Archivos
- `supabase/migrations/0035_attendance_admin_write_rls.sql`, `docs/MIGRACIONES-APLICAR-0035-ATTENDANCE-RLS.sql`, `docs/MIGRACIONES-PENDIENTES-SUPABASE.md`, `src/components/os/edit-attendance-sheet.tsx`, `docs/audits/attendance-correction-save.md`.

## 2026-08-05 · Fix: TimePicker no renderizaba las ruedas (hora · minuto · AM/PM)

### Bug
- **Síntoma**: Al abrir el TimePicker (Tiempo → Asistencia → Corregir → Seleccionar hora), el modal mostraba título y botones pero las **columnas de ruedas salían vacías**.

### Causa raíz
- **`Wheel` (ruedas iOS) colapsaba a `width: 0`**: todos sus hijos están posicionados en `absolute` (máscaras + scroll container), así que el div raíz no tiene ancho intrínseco; como item flex en `justify-between`, su base size era 0. Además `overflow-y:auto` computa `overflow-x:auto`, recortando los números.
- Confirmado con render headless (Chrome + CSS compilado real): `w=0` antes, `w=72` después.

### Fix
- `minWidth: 72` en la raíz de `Wheel` (`src/components/scheduling/time-picker.tsx`). Cubre los 12 usos (TimePicker, DateTimePicker, editor de calendario) por ser el único componente de rueda.

### Archivos
- `src/components/scheduling/time-picker.tsx`, `docs/audits/time-picker-render-bug.md`.

## 2026-08-05 · Rediseño UI/UX: Portal Coordinador - Wizard 3 pasos + lista de solicitudes

### Lista de solicitudes
- **CTA primaria protagonista**: 48px de alto, radio 12px, `IconPlus`, glow de acento con hover elevado.
- **Sección "Mis solicitudes"**: Label uppercase + badge con contador.
- **Tarjetas Notion-style**: Radio 16px, hover con elevación 2px y sombra, título cambia a accent en hover.
- **Badges semánticos** (patrón 10.8): Tipo en neutro, estado con color por `STATUS_TONE` (solicitada=warn, completada=ok, cancelada=danger…).
- **Eliminar**: Botón ghost con `IconTrash`, aparece hover en danger; confirmación inline "¿Eliminar? Sí, eliminar / No".
- **Estado vacío compacto**: Icono 64px `rounded-2xl` sobre accent-tint + copia humana.

### Wizard (3 pasos)
- **Header**: Título 28px tracking-tight + subtítulo contextual por paso.
- **Barra de progreso**: Segmentos de 5px rounded-full, accent cuando completado.
- **Paso 1 (tipo)**: Tarjetas con icono 48px en `rounded-2xl`, hover elevado, chip "mín. X días".
- **Paso 2 (detalle)**: Chips multiselect con sombra al activarse, alerta de anticipación `rounded-xl` con `IconAlert`, pickers oficiales.
- **Paso 3 (resumen)**: Tarjeta resumen + notice `--ok-tint` con `IconCheck` + envío con glow accent.
- **Transiciones**: `fade-in slide-in-from-top-2` entre pasos.
- **Sin tarjetas anidadas**: Se eliminó el `Card` contenedor (Regla 4).

### Design System
- **Patrón 10.11**: Wizard Multifase con Progressive Disclosure.

### Archivos
- `src/app/coordinador/client.tsx`, `docs/design/EMET-DESIGN-PRINCIPLES.md`.

## 2026-08-05 · Migraciones pendientes 0025-0034 documentadas para Supabase

- **Script único**: `docs/MIGRACIONES-APLICAR-0025-0034.sql` (0025→0034 en orden, aditivo/idempotente) listo para pegar en el SQL Editor.
- **Guía actualizada**: `docs/MIGRACIONES-PENDIENTES-SUPABASE.md` con tabla de bloques, verificación post-aplicación y despliegue de Edge Functions `gcal-*`.
- **Archivos**: `docs/MIGRACIONES-APLICAR-0025-0034.sql`, `docs/MIGRACIONES-PENDIENTES-SUPABASE.md`.

## 2026-08-05 · Rediseño UI/UX: Vistas del Calendario (Semana, Día, Agenda, Asistencia, Año + Panel derecho)

### Semana
- **Header sticky de días**: Día actual con círculo de acento + glow, demás días con hover sutil.
- **Fila all-day mejorada**: Eventos como chips con borde-left de color y hover con elevación.
- **Línea "ahora" rediseñada**: Roja con punto de 12px y glow suave para localizarla al instante.
- **Eventos**: Border-radius 10px, borde-left 3px del color del tipo, altura mínima 24px.

### Día
- **Eventos all-day**: Chips con punto de color + borde-left, distinguibles de los horarios.
- **Línea "ahora"**: Mismo patrón que Semana (punto + glow).
- **Altura dinámica**: Mínimo 28px; si cabe, muestra título + tipo en dos líneas.
- **Estado vacío**: Icono 64px con mensaje "Tu día está libre".

### Agenda
- **Agrupación editorial**: Hoy / Mañana / Esta semana / Después.
- **Tarjetas por día**: Header clickable, eventos con franja vertical de color, hora en 12px.
- **Estado vacío**: Icono 64px y copia humana.

### Asistencia
- **Celdas 24px**: Número de día, avatares 32px superpuestos.
- **Resumen de asistencia**: Porcentaje con color semaforizado (≥80 ok, ≥60 warn, <60 danger).
- **Leyenda compacta**: Chips de 16px por estado.

### Año
- **Heatmap de 12 meses**: Celdas con radio 6px, hover con escala y sombra.
- **Mes actual**: Nombre en color de acento + celdas con glow.
- **Día actual**: Outline de acento + glow de 3px.
- **Separación entre meses reducida** para mejor densidad.

### Panel derecho
- **Secciones Hoy / Próximos**: Labels con badges de conteo; "Hoy" en color de acento.
- **Tarjetas de evento**: Border 1px, padding 8px, hora en chip monospace, franja de color 4px.
- **Espaciado 24-32px** entre bloques (gap-6).

### Archivos
- `src/components/calendar/week.tsx`, `day.tsx`, `agenda.tsx`, `year.tsx`, `right-panel.tsx`, `src/app/admin/calendario/client.tsx`.

## 2026-08-04 · Rediseño UI/UX: Módulo de Calendario - Estilo Apple Calendar

### Mejoras de jerarquía visual y experiencia
- **Header rediseñado**: Título 32px con subtítulo descriptivo, padding reducido para dar más espacio al calendario.
- **Navegación mejorada**: Botones de 36px con bordes redondeados 8px, botón "Hoy" con fondo sutil.
- **Segmented controls mejorados**: Border-radius 12px, padding 4px, sombra más pronunciada en el thumb.
- **Botón "Crear evento"**: 40px alto, padding generoso, sombra con color de acento, hover con elevación.
- **Dos barras de controles**: Separación clara entre navegación (arriba) y acciones (abajo).
- **Animaciones mejoradas**: Transiciones de 200ms en hover, spring en segmented controls.
- **Responsive**: Texto adaptativo en botón "Crear" (completo en desktop, corto en móvil).
- **Archivos**: `src/components/calendar/header.tsx`, `src/app/globals.css`, `src/app/admin/calendario/client.tsx`.

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
- **Patrón 10.6.4**: Calendario con Header de Dos Barras.
- **Archivos**: `src/app/admin/empleados/client.tsx`, `src/app/admin/biblioteca/client.tsx`, `docs/design/EMET-DESIGN-PRINCIPLES.md`.

## 2026-08-04 · Rediseño UI/UX: Módulo de Tiempo - Mi jornada con más contexto

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
