# Emet · Base de datos

Supabase (Postgres). Esquema canónico: `supabase/schema.sql`. Evolución incremental: `supabase/migrations/00NN_*.sql` (0002 → 0024). RLS habilitada en **todas** las tablas.

## Tablas

### Personas y organización

| Tabla | Descripción | Notas |
|---|---|---|
| `users` | Persona del equipo | `auth_id` única por sesión; `role` en `admin/empleado/rh/coordinador/departamento`; `nexus_clave`/`nexus_color` (nombres heredados del rebrand, ver P-005); saldo/antigüedad de vacaciones |
| `catalog_items` | Catálogos: licenciaturas, niveles, departamentos | `unique(catalog, label)` |
| `employee_availability` | Bloques de disponibilidad del colaborador | |

### Tiempo

| Tabla | Descripción |
|---|---|
| `schedules` | Horario por persona (días, horas, `target_min`, tolerancia, vigencia) |
| `attendance` | Checadas entrada/salida con motivo, fecha, hora, GPS (`lat/lng/distance_m`), `device_id` |
| `vacations` | Solicitudes de vacaciones (saldo, fechas, status `Pendiente/Aprobada/Rechazada/Cancelada`) |
| `incidents` | Permisos/incapacidades/home office/comisión/faltas justificadas/cambio de jornada |
| `holidays` | Días inhábiles (nacional/estatal/empresa/puente) |
| `guards` | Guardias (diseñada, **no activa** — no tiene policies funcionales) |

### Operación

| Tabla | Descripción |
|---|---|
| `requests` | Solicitudes de trabajo (tipo: cobertura/diseño/lona/video/difusión; prioridad; `min_hours_required`) |
| `projects` | Proyecto derivado de una solicitud (lead, deadline, drive_folder_url, calendar_event_id) |
| `project_assignments` | Personas por proyecto (`is_lead`, unique project+user) |
| `checklist_templates` / `checklist_items` | Plantillas de checklist por tipo de solicitud |
| `project_checklist` | Checklist por asignación (`done`, `done_at`) |
| `task_time_logs` | Tiempo invertido por asignación (`started_at/ended_at/minutes`, `is_manual`) |
| `time_edit_requests` | Petición de corrección de tiempo (`new_minutes`, status) |
| `evidences` | Entregables del proyecto (`drive_url`, `publish_url`) |
| `comments` | Comentarios por proyecto |

### Comunicación

| Tabla | Descripción |
|---|---|
| `notifications` | Campana interna (`title/body/kind/read`) |
| `activity_logs` | Auditoría (`entity/entity_id/action/detail jsonb`) |

### Chat (migraciones 0011–0024)

| Tabla | Descripción |
|---|---|
| `conversations` | 1:1 y grupo (`created_by`, `last_message_*`, `pinned_message_id/pinned_by/pinned_at`) |
| `conversation_participants` | Miembros (`muted`, `muted_until`, `pinned`, `archived`, `last_read_at`) |
| `messages` | `status` (sent/delivered/read), `read_at`, `client_id` (idempotencia de outbox), tipo (text/image/…) |
| `message_attachments` | Adjuntos (thumb/medium/original, bucket `chat-files`) |
| `message_reactions` | Emoji por usuario |
| `push_subscriptions` | Suscripciones Web Push por usuario |

## Funciones clave

**Security helpers (definidas en schema.sql, `security definer`)**:
- `my_role()` → rol del usuario autenticado.
- `my_user_id()` → id en `public.users`.

**Triggers**:
- `on_auth_user_created` → `handle_new_auth_user()`: al crear un auth.user, vincula `auth_id` a `public.users` por email (whitelist). La cuenta solo "existe" si su email ya está en `users`.
- `vacations_check_balance` → `trg_vacations_check_balance()`: no permite aprobar más días de los que hay de saldo (vía `approve_vacation`).
- `requests_check_min_hours` → `trg_requests_check_min_hours()`: valida `min_hours_required`.
- `one_active_task` → `trg_one_active_task()`: solo una tarea activa a la vez.
- `project_start_on_time` → `trg_project_start_on_time()`: no dejar avanzar un proyecto sin su asignación/checklist.
- `users_protect_self_update` → `trg_users_protect_self_update()`: un usuario no puede escalar su propio rol ni tocar campos protegidos.

**RPC (chat, migración 0015)**:
- `nx_enlace_toggle_mute`, `nx_enlace_toggle_conversation_pin`, `nx_enlace_toggle_conversation_archived`, `nx_enlace_mark_conversation_read`, `nx_enlace_mark_delivered`, `nx_enlace_mark_read`, `nx_enlace_toggle_pin` (mensaje), `nx_enlace_toggle_reaction`.

**RPC (tiempo)**:
- `approve_vacation(p_vacation_id, p_note)`, `edit_vacation(...)`, `register_vacation_direct(...)` (migraciones 0002/0004).
- `create_notification(...)`, `notify_admins(...)` (migración 0006).

## Buckets de Storage

- `chat-files` — **privado** (RLS), pipeline de imágenes: thumb/medium/original en WebP (migración 0024). Renderizado con `SmartImage`; acceso vía URL firmada o proxy (Edge `proxy-asset`).

## Convenciones

- Toda tabla usa `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()` y FK con `on delete cascade` donde aplica.
- Nombres en `snake_case`; roles y status en texto con `check(...)` (no enums Postgres) para poder evolucionar el catálogo sin `ALTER TYPE`.
- El schema canónico (schema.sql) y las migraciones conviven: las migraciones 0001 no existen (se consolidó el base); las 0002+ son incrementales. Un cambio de esquema **siempre** es una migración nueva, nunca una edición retroactiva de schema.sql sin nota.

## Ver también

- `docs/decisions/ADR-0003.md` — single-tenant y futuro `organization_id`
- `docs/architecture/PERMISSIONS.md` — RLS, roles, MFA
- `docs/changelog/MIGRATIONS.md` — historial migración por migración
- `docs/decisions/ADR-0012.md` — pipeline de imágenes del chat (bucket privado)
