# Historial de migraciones · Emet

> Migraciones **additivas** en `supabase/migrations/` (0002 … 0037). El schema canónico del núcleo vive en `supabase/schema.sql` (473 líneas; las tablas y RPCs del chat NO están ahí — el esquema canónico del chat son las propias migraciones 0011–0037). Reglas en `docs/coding/SUPABASE.md`.

## Resumen por fases

| Rango | Fase | Contenido |
|---|---|---|
| 0002–0010 | Núcleo y tiempo | Personas/roles, auth, proyectos, actividades, tareas, `task_time_logs`, solicitudes y cobertura, saldo de vacaciones, asistencia, días inhábiles, configuración global, horarios, dispositivos GPS, estados de jornada, pausa activa |
| 0011 | Enlace / nota multi-tenant | Base del módulo "enlace"; **nota single-tenant** con intención de futuro `organization_id` |
| 0012–0014 | Chat (schema) | `conversations`, `conversation_participants`, `messages` (status `sent/delivered/read`, `client_id`), `message_attachments`, `message_reactions`, `push_subscriptions` |
| 0015 | Chat (RPC) | RPC `nx_enlace_*` (8): toggle mute/pin/archived, mark read/delivered, toggle pin (mensaje), toggle reaction, etc. |
| 0016–0020 | Chat (funcionalidades) | Realtime, presencia/typing, sonido, ubicación, búsqueda |
| 0021 | Chat (edición) | Editar y eliminar mensajes |
| 0022 | Chat (stickers) | Pack propio de stickers |
| 0023–0024 | Storage y pipeline de imágenes | Bucket `chat-files` **privado** + pipeline WebP `thumb/medium/original` (0024; la cabecera interna dice 0023) |
| 0025 | Chat — silencio por duración + hora de lectura | `conversation_participants.muted_until`, `messages.read_at`, RPCs `nx_enlace_set_mute` / `nx_enlace_unmute`, `nx_enlace_mark_read` reescrito |
| 0036 | Chat — búsqueda cross-conversación | Índice GIN trigram sobre `messages.content` + RPC `nx_search_messages` (remitente y conversación pre-unidos, escapa comodines) |
| 0037 | Chat — recibos de lectura + "Eliminar para mí" | `message_reads` (un recibo por lector por mensaje → "Leído por …" en grupos), `message_hidden` (ocultar por usuario → RLS de `messages` lo excluye de todos los SELECTs), RPCs `nx_enlace_mark_messages_read` / `nx_enlace_message_reads` / `nx_enlace_hide_message` / `nx_enlace_show_message`; Realtime + REPLICA IDENTITY FULL |

## Notas por migración destacada

- `0011_enlace_mvp.sql` — documento la intención multi-tenant: si se va multi-org, se añade `organization_id` con migración propia (ver `ADR-0002`).
- `0015_chat_rpc.sql` — las mutaciones del chat pasan por RPC atómicos (`nx_*`), nunca INSERT directo del cliente.
- `0024_chat_storage_and_image_pipeline.sql` — storage privado; el acceso a archivos es por URL firmada o `proxy-asset`.
- `0025_chat_mute_duration_read_at.sql` — silencio con vencimiento (`muted_until`; un participante está silenciado si `muted` o `muted_until` está en el futuro — el push y el watcher de no-leídos replican el criterio) y hora de lectura (`read_at`, expuesta como "✓✓ Leído · HH:MM"). `nx_enlace_mark_read` ya no es el de 0015: ahora rellena `read_at` y solo avanza desde `sent/delivered`.
- `0037_chat_reads_and_hidden.sql` — `message_reads` NO guarda al autor (nadie "lee" su propio mensaje); `nx_enlace_mark_messages_read` es el lote que reemplaza el bucle por mensaje del cliente. El filtro de `message_hidden` va en la política `messages_select` (recreada) y en `nx_search_messages` (security definer no lo hereda).

## Reglas

1. Nunca editar una migración aplicada: agregar `0026_*.sql` y reflejarlo en `schema.sql`.
2. Cada migración es idempotente en la medida de lo posible (migración de datos, no destructiva).
3. RPC nuevos llevan prefijo `nx_`; buckets/storage se versionan como migración.
4. El schema canónico (`schema.sql`) es la referencia de lectura; las migraciones cuentan la historia.
