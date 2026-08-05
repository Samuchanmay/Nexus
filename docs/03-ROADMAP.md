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
| **Retrofit de tipografía canónica (W2/W3)** | ✅ | Escala registrada como utilidades Tailwind; tamaños sueltos normalizados (423 reemplazos); excepciones documentadas: <11px micro-densidad y ≥34px hero |
| **Reorganización del menú — Fase 3 (ripple global)** | ✅ | `initRipple` + `data-ripple` en el menú (sidebar, tab bar móvil, spotlight, domain tabs, fichar) y en Button/IconButton; ripple.ts robustecido (position seguro, reduced-motion, botón izquierdo, teclado) |

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
| Búsqueda global de mensajes | ✅ | `conversation-search` intra + cross-conversación con RPC `nx_search_messages` (0036, índice trigram), agrupada por conversación y con salto directo al mensaje (`/chat/:id?msg=…` + resaltado) |
| "Leído por …" en grupos | ✅ | Tabla `message_reads` (por miembro) + RPCs `nx_enlace_mark_messages_read` / `nx_enlace_message_reads` (0037); bajo la burbuja propia "Leído por Ana, Luis +3". Directas siguen con ✓✓ + hora |
| "Eliminar para mí" | ✅ | Tabla `message_hidden` (por usuario) + RPCs `nx_enlace_hide_message` / `nx_enlace_show_message` (0037); RLS de `messages` excluye lo ocultado para mí en feed, scroll, búsqueda y fijado |

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
- ✅ Silenciar por duración (8h/semana/siempre) en menú del header + panel de notificaciones (`nx_enlace_set_mute`/`nx_enlace_unmute`, migración 0025); pendientes: "marcar como no leído" y vaciar/eliminar conversación (requieren RPCs nuevos), acciones solo-hover en escritorio.

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

### Chat · Requisitos de plataforma de mensajería moderna (checklist de terminado)

Bloque de requisitos para que el chat deje de ser "un apartado de mensajería" y se convierta en una **plataforma de comunicación de nivel profesional** integrada a Emet (referencia: Slack/Teams/Signal/WhatsApp). Estado mapeado contra código real (`src/lib/chat/`, `src/app/chat/`). La sección §24 agrupa lo que se considera "terminado".

**1 · Mensajería en tiempo real (CRÍTICO)** — sin recargas
| Sub-punto | Estado | Notas |
|---|---|---|
| Aparece instantáneamente en el remitente | ✅ | `use-outbox` inserta en local antes que en el servidor |
| Aparece instantáneamente en el destinatario | ✅ | Realtime Supabase (`postgres_changes` en `messages`) |
| Actualiza la lista de conversaciones | ✅ | Realtime en `conversations` + `use-unread-count` |
| Último mensaje, hora y contador | ✅ | Preview/hora/badge se refrescan en vivo |
| Estado del mensaje | ✅ | `message-state.ts` (pending→sent→delivered→read→failed) |

**2 · Notificaciones push**
| Sub-punto | Estado | Notas |
|---|---|---|
| Navegador minimizado (notificación del SO) | ✅ | `public/sw.js` + VAPID + Edge `send-chat-push`; avatar/nombre/mensaje/hora/icono Emet |
| PWA / Notification Center (Win/macOS/Linux) | ✅ | Emet ya es instalable (manifest + sw); el SO nativo entrega las notificaciones del navegador |
| Móvil nativo (FCM Android / APNs iOS) | 🟢 | Requiere app nativa (Electron/Tauri/Flutter/RN); sonido, vibración, badge y abrir conversación quedan para esa fase |

**3 · Configuración de notificaciones por conversación**
| Opción | Estado | Notas |
|---|---|---|
| Silenciar (simple on/off) | ✅ | `nx_enlace_toggle_mute` |
| Silenciar por duración (8 h / 1 semana / siempre) | 🟡 | Pendiente (ya anotado en N1) — requiere RPC con duración |
| Sonido / vibración / vista previa / banner / contador | 🟢 | No existe toggle fino por conversación |
| Notificar menciones únicamente | 🟢 | Requiere parser de menciones + RPC de preferencias |

**4 · Sonidos** — propios de Emet, nunca los del navegador
| Sonido | Estado |
|---|---|
| Recibido | ✅ `playMessageReceived()` (Web Audio, sintetizado — propio de Emet) |
| Enviado / error / reacción / mención / nuevo grupo / archivo / llamada / videollamada | 🟢 |

**5 · Vibración (móvil)**
| Evento | Estado |
|---|---|
| Mensaje (20 ms) | 🟡 | Solo hay háptica del swipe (8 ms) hoy |
| Llamada (patrón largo) / mención (doble) | 🟢 |

**6 · Estados del mensaje** (Enviando → ✓ → ✓✓ gris → ✓✓ azul) — ✅ completo en `message-state.ts` + `MessageStatusIcon`.

**7 · Confirmaciones de lectura**
| Sub-punto | Estado | Notas |
|---|---|---|
| Enviado/entregado/leído por mensaje | ✅ | RPCs `nx_enlace_mark_*` |
| Hora de la lectura | ✅ | `read_at` (0025) + "✓✓ Leído · HH:MM" en burbujas propias |
| "Leído por … (con hora)" en grupos | 🟢 | Requiere lectura de `message_reads` por participante |

**8 · Escribiendo…** — ✅ `use-typing` (broadcast Realtime, auto-stop 2.5s, multi-usuario) con `TypingDots` animados en lista y header.

**9 · Grabando un audio** — ✅ `use-typing` extendido con evento `recording` (mismo broadcast Realtime, auto-stop 3s): "X está grabando un audio" + punto rojo pulsante en lista y header, disparado por `use-audio-recorder`.

**10 · Subiendo archivo con progreso** — ✅ Porcentaje real + estado "Subiendo archivo… N%" en el composer; nunca "Cargando…" a secas.

**11 · Editar mensajes**
| Sub-punto | Estado | Notas |
|---|---|---|
| Solo mensajes propios, marca "editado" | ✅ | RPC `nx_enlace_edit_message` (0021) + `EditMessageInline` |
| Ventana de edición configurable (15 min / 30 / 1 h / siempre) | 🟢 | |
| Historial para administradores (si la empresa lo activa) | 🟢 | Requiere tabla de versiones |

**12 · Eliminar mensajes**
| Sub-punto | Estado | Notas |
|---|---|---|
| Eliminar (para todos), borrado suave + aviso en vivo | ✅ | RPC `nx_enlace_delete_message` (0021/0022); "Eliminaste este mensaje" / "X eliminó un mensaje" |
| "Eliminar para mí" | 🟢 | Requiere estado por participante |
| Ventana de eliminación configurable | 🟢 | |

**13 · Responder con miniatura estilo Signal** — 🟡 El swipe-to-reply existe y cita el mensaje; falta la miniatura/preview rica del original.

**14 · Reenviar** — ✅ `ForwardSheet` a 1 conversación; 🟢 selección múltiple (varias conversaciones, grupos, canales).

**15 · Copiar (texto/imagen/link/código)** — ✅ Menú contextual → "Copiar" (texto). Copiar imagen/link/código 🟢.

**16 · Buscar mensajes**
| Sub-punto | Estado | Notas |
|---|---|---|
| Texto dentro de la conversación | ✅ | `ConversationSearch` (debounce, salto + resaltado) |
| Cross-conversación | ✅ | RPC `nx_search_messages` (0036) agrupado por conversación, deep-link `?msg=` con scroll + resaltado del mensaje exacto |
| Por persona / archivo / fecha / reacción | 🟢 | Requiere filtros + índices |

**17 · Mensajes fijados arriba** — ✅ `togglePin` + banner de pinned message en la conversación (con preview).

**18 · Indicador online**
| Estado | Status |
|---|---|
| "En línea" / "Hace N min" | ✅ `formatPresence` (header, InfoPanel, dot en lista desde N3) |
| "Escribiendo…" | ✅ |
| "Grabando…" | ✅ |

**19 · Sincronización multi-dispositivo (PC/móvil/tablet)** — ✅ El estado llega por Realtime en vivo; el outbox usa `BroadcastChannel` (`emet-chat-outbox`) para que enqueue/fallo de una pestaña se refleje en las demás de la misma conversación.

**20 · Historial persistente (cerrar sesión / cambiar de dispositivo)** — ✅ Los mensajes viven en Supabase (RLS); nunca se pierden.

**21 · Reconexión** — ✅ Pill "Sin conexión — reconectando…" en la lista cuando el navegador se va offline; 🟡 falta el estado "Conectado" explícito al volver.

**22 · Cola offline (envío automático al reconectar)** — ✅ `use-outbox` con `client_id` idempotente; 🟢 retry automático con backoff (anotado en la tabla Fase 3).

**23 · Estados de presencia (Activo/Ausente/No molestar/Fuera/Invisible)** — 🟢 No existen más allá de online/last_seen; requiere tabla `presence` + heartbeat por estado.

**24 · Requisitos para que el chat se considere terminado**

| Área | Estado |
|---|---|
| Mensajería (tiempo real, estados, escribiendo/grabando, editar, eliminar 1/1, responder/reenviar/reacciones, búsqueda) | 🟡 Faltan: "eliminar para mí", miniatura en responder |
| Notificaciones (push navegador, móvil, sonidos, vibración, badges, config por conversación) | 🟡 Push navegador ✅; silencio por duración ✅ (0025); móvil/APNs 🟢; sonidos/vibración/config 🟡🟢 |
| Sincronización (realtime multi-dispositivo, cola offline, reconexión, sin pérdida) | 🟡 Realtime + outbox ✅; outbox multi-tab ✅ (BroadcastChannel); retry backoff 🟢 |
| Archivos (WebP/AVIF compresión, video transcodificado + miniaturas, docs con preview, audio player, stickers y GIF) | 🟡 Imágenes WebP + audio player + stickers ✅; video/GIF 🟢; docs con preview 🟢; AVIF 🟢 |

Con eso, el chat pasa de "apartado de mensajería" a plataforma de comunicación profesional integrada a Emet.

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

Fase 2 quedó cerrada (2026-08-05) y la **búsqueda cross-conversación** del chat ya está ✅ (RPC 0036 + deep-link). También quedaron ✅ **"Leído por …" en grupos** y **"eliminar para mí"** (migración 0037, docs `MIGRACIONES-APLICAR-0037-…sql` — pendiente de aplicar en el SQL Editor de emet.uno). Queda de la Fase 3 el retry con backoff del outbox.
