# Emet · Roadmap

Documento vivo. Cada fila responde a código real: ✅ existe en el repo, 🟡 existe a medias / en curso, 🟢 planeado. Las fases se actualizan en cada cambio que las toque.

## Leyenda de estado

- ✅ **Existe** — implementado y funcionando en producción (emet.uno).
- 🟡 **En curso** — parcial, en fase de retrofit o con pendientes conocidos.
- 🟢 **Planeado** — decidido pero sin implementar.

---

## Fase 0 · Base (completada)

| Item | Estado | Notas |
|---|---|---|
| Login Google con whitelist por email | ✅ | Trigger `on_auth_user_created` vincula auth → users |
| MFA (TOTP) para Admin/RH | ✅ | Gate en `src/middleware.ts` |
| Shell Emet OS (AppShell, tema, glass) | ✅ | `src/components/os/` |
| Navegación por dominios + hubs | ✅ | `src/lib/nav.ts` (menú reorganizado 2026-07-31) |
| Sistema de tokens v6 + Fundación OS | ✅ | `src/app/globals.css` |
| RLS completa por tabla y rol | ✅ | `supabase/schema.sql` + migraciones 0009/0010 |
| Single-tenant | ✅ | Decisión registrada (ver ADR-0003) |

## Fase 1 · Operación

| Item | Estado | Notas |
|---|---|---|
| Solicitudes → Proyectos → Checklist → Evidencias | ✅ | Flujo completo en `admin/proyectos` |
| Seguimiento de tiempo por tarea (`task_time_logs`) | ✅ | Con peticiones de edición de tiempo |
| Actividades (vista del colaborador) | ✅ | `comunicacion/actividades` |
| Biblioteca (proyectos + entregables) | ✅ | `comunicacion/biblioteca` |
| Calendario de equipo (Asistencia/Actividades/Vacaciones) | ✅ | Motor en `src/lib/calendar-core.ts` + eventos de Google |
| Notificaciones internas | ✅ | `notifications` + `create_notification`/`notify_admins` |

## Fase 2 · Tiempo (el pulso del equipo)

| Item | Estado | Notas |
|---|---|---|
| Checador entrada/salida con GPS | ✅ | Edge Function `fichar` + tablero `fichar/` |
| Mi Día (jornada) con horario | ✅ | `comunicacion/jornada` + `JornadaWatcher` |
| Vacaciones (saldo, aprobación, correo) | ✅ | Edge `notify-vacation`; exportado por RRHH |
| Incidencias (permisos, home office, etc.) | ✅ | `admin/incidencias` |
| Asistencia semanal + reporte XLSX | ✅ | Edge `weekly-attendance-report`; `xlsx-weekly-report` |
| Días inhábiles | ✅ | Migración 0019 |
| Pausa activa (recordatorio de estiramiento) | ✅ | `PausaActivaPopup` + config |
| Horarios por persona (tabla `schedules`) | ✅ | `admin/config/horarios` |
| **Retrofit de tipografía canónica (W2/W3)** | 🟡 | La escala `--fs-*` existe; queda normalizar tamaños sueltos históricos |
| **Reorganización del menú — Fase 3 (ripple global)** | 🟢 | Mecánica `src/lib/ripple.ts` lista, falta extender `[data-ripple]` |

## Fase 3 · Chat (módulo premium)

| Item | Estado | Notas |
|---|---|---|
| Conversaciones 1:1 y en grupo, RLS + RPC | ✅ | Migraciones 0011-0016 |
| Estados (enviado/entregado/leído) con RPC | ✅ | `nx_enlace_mark_*` |
| Reacciones, editar, eliminar, fijar, archivar, silenciar | ✅ | Migraciones 0015, 0021 |
| Adjuntos, cámara, stickers, ubicación | ✅ | Migración 0022 |
| Pipeline de imágenes (WebP thumb/medium/original) | ✅ | Worker + migración 0024, bucket `chat-files` privado |
| Push notifications (VAPID + Edge `send-chat-push`) | ✅ | Migración 0017 |
| Workspace premium (`.chat-ws`) | ✅ | Paleta Linear/Discord/Slack |
| Swipe actions estilo Signal | ✅ | `use-swipe-gesture` |
| Cola offline con reenvío (`use-outbox`) | ✅ | `src/lib/chat/use-outbox.ts` |
| Outbox: retry automático con backoff | 🟢 | Existe la cola; pulir reintentos programados |
| Búsqueda global de mensajes | 🟡 | Hay `conversation-search`; falta búsqueda cross-conversación |

## Fase 4 · EMU (inteligencia contextual)

| Item | Estado | Notas |
|---|---|---|
| Context Engine + Decision Engine + Surface | ✅ | `src/lib/emu/` (Fase 1: determinista, sin LLM) |
| Reglas de jornada (abrir, horas, objetivo) | ✅ | `src/lib/emu/rules.ts` |
| Regla de bandeja de solicitudes | ✅ | Count para admin |
| Memoria (≥3 ignoradas → oferta de recordatorio) | ✅ | `offerAutoRemind` |
| Señales de Calendario/Documentos/Proyectos | 🟢 | Context se amplía módulo por módulo |
| LLM opcional por organización | 🟢 | Decisión abierta (ver `DECISIONES-PENDIENTES.md`) |

## Fase 5 · Recorridos (onboarding)

| Item | Estado | Notas |
|---|---|---|
| Editor de recorridos para admin (`/preptour`) | ✅ | Migración 0023 + `demos-*` Edge Functions |
| Player con diffs de DOM | ✅ | `src/lib/recorridos/player/` |
| Publicación por rol | ✅ | `demos-public`/`demos-list` |
| Métricas de recorridos vistos | 🟢 | `recorridos:visto` es local por usuario hoy |

## Fase 6 · Reportes y RRHH

| Item | Estado | Notas |
|---|---|---|
| Reportes (semanales, exportables, PDF) | ✅ | `admin/reportes` + print styles |
| Export XLSX asistencia | ✅ | `xlsx-weekly-report` (exceljs) |
| Módulo RH (directorio, vacaciones del equipo) | ✅ | `/rh` |
| Reporte de productividad por persona/mes | 🟢 | |

## Fase 7 · Plataforma

| Item | Estado | Notas |
|---|---|---|
| Dominio canónico `emet.uno` + redirección de alias | ✅ | `src/middleware.ts` |
| PWA (manifest, sw, instalable) | ✅ | `public/manifest.json` |
| Multi-tenant (organizaciones) | 🟢 | No antes de consolidar v1 (ADR-0003) |
| i18n (idioma configurablo) | 🟢 | Hoy solo `es_MX` |
| Legal: términos / privacidad / contacto | ✅ | `/legal/*`, `/contact` |
| Scripts de test automatizados | 🟢 | No existe framework aún (ver `coding/TESTING.md`) |

---

## Próximo hito sugerido

Consolidar **Fase 2 (retrofit tipográfico W2/W3)** y **Fase 3 (búsqueda cross-conversación)**, que son los únicos items 🟡 con código ya existente a medias. Ambos son puramente de UX y no requieren cambios de esquema.
