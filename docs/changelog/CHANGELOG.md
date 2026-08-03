# Changelog · Emet

> Formato: `[fecha] - descripción (commit)`. El historial por migraciones de DB está en `docs/changelog/MIGRATIONS.md`.

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
