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

### Chat · Niveles de pulido (dirección: mezcla Signal + WhatsApp Desktop + Apple Messages)

La dirección de diseño del chat NO es clonar una app: es sentirse como un cliente de mensajería **nativo de macOS/Windows** — mecánica de Signal, densidad y panel informativo de WhatsApp Desktop, pulido de Apple Messages. Los niveles marcan qué se considera "imprescindible" (N1), "premium" (N2) y "identidad" (N3).

**N1 · Imprescindible (previo a lanzamiento)** — implementado en la entrega del 2026-08-03:
- ✅ Scrim Signal unificado en TODOS los overlays (Sheet/Dialog/CenteredOverlay/DateSheet/Notificaciones/PausaActiva/calendario): `rgba(0,0,0,.42)` + `blur(18px) saturate(.75) brightness(.72)`, scroll bloqueado, `pointer-events` corregido (causa raíz de clics fantasma).
- ✅ Burbujas 72% máx., radio 18px, cola sutil al cambiar de remitente, espaciado 4–6px, imágenes 14px sin sombras pesadas.
- ✅ Reacciones solo a mensajes de OTROS (Signal); franja de reacciones de solo lectura en propios.
- ✅ Skeleton con shimmer en imágenes (nunca "Cargando imagen…" a secas) + fade en `SmartImage`.
- ✅ Estados de envío (pendiente/enviado/entregado/leído/error) con ticks animados.
- ✅ Indicador "está escribiendo…" con tres puntos animados (lista + header).
- ✅ Menús contextuales de clic derecho: mensaje (Reaccionar/Responder/Reenviar/Copiar/Fijar/Editar/Eliminar/Info) y conversación (Fijar/Silenciar/Archivar/Marcar leído/Abrir).
- ✅ Lista plana estilo Signal (sin tarjetas/sombras), buscador pastilla, compositor compacto con focus ring, header compacto.
- ✅ Panel informativo por secciones SIN tarjetas (avatar grande, miembros, perfil, detalles, notificaciones, archivos).
- ✅ Micro-animaciones 120–220ms (nunca >300ms), solo ease-out/ease-in-out/spring.
- ✅ SPEC-004: emojis Apple en todo el app (ver `EMET_CANON.md`).
- 🟡 Pendientes menores: silenciar por duración (8h/semana/siempre), "marcar como no leído" y vaciar/eliminar conversación (requieren RPCs nuevos), acciones solo-hover en escritorio.

**N2 · Premium** (decidir post-lanzamiento):
- Gestor/tienda de stickers con packs (Recientes/Favoritos/Empresa/Memes/Trabajo/Animados/GIF/Buscar); WebP 512×512 transparente <100KB; APNG/WebP animado.
- **Creador de stickers (diferenciador)**: subir PNG → quitar fondo con IA → recortar → borde → sombra → texto → guardar/añadir a paquete; paquetes privados/compartidos/empresa.
- Encuestas, eventos, mensajes temporales, archivos compartidos filtrables (Fotos/Videos/PDF/Excel/Word/ZIP/Audio/Links).
- Drag & drop de archivos, pegado de portapapeles y de capturas de pantalla.
- Compresión perceptual ~90% (HEIC→JPEG→WebP→AVIF), EXIF solo si el usuario lo pide.

**N3 · Identidad Emet** (visión de producto):
- Temas por conversación (fondos, colores de burbuja por organización), packs corporativos.
- Integración con tareas/calendario/documentos desde el chat.
- Resúmenes IA y búsqueda semántica IA de mensajes.

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
