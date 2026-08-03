# Changelog · Emet

> Formato: `[fecha] - descripción (commit)`. El historial por migraciones de DB está en `docs/changelog/MIGRATIONS.md`.

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
