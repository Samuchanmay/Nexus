# Emet · Permisos

## Roles

Definidos en `src/lib/nav.ts` y en el `check` de `users.role`:

| Rol | Qué ve | Acceso |
|---|---|---|
| `admin` | Todo: `/admin/*`, Personas, Tiempo, Reportes, Config, Recorridos | MFA obligatorio |
| `empleado` | `/comunicacion/*` (Mi día, Actividades, Calendario, Biblioteca, Vacaciones, Incidencias) y `/chat` | Sesión Google |
| `coordinador` | `/coordinador` (solicita trabajo al equipo) | Sesión Google |
| `departamento` | `/coordinador` (igual que coordinador, vista de solicitante) | Sesión Google |
| `rh` | `/rh` (directorio + vacaciones del equipo) | MFA obligatorio |

Los roles `coordinador` y `departamento` son "solicitantes": no viven dentro del tablero de operación, solo registran solicitudes y ven su estado.

## Middleware (frontera)

`src/middleware.ts`:
1. Host legacy → `emet.uno` (308).
2. Ruta pública? `/login`, `/auth`, `/legal`, `/contact`, `/`, `/robots.txt`, `/sitemap.xml`, `/manifest.json`.
3. Sesión: sin user → `/login`. Maneja la "refresh race" (`refresh_token_already_used` / `not_found`) para no expulsar a nadie con sesión válida.
4. MFA: si `users.role` ∈ {admin, rh} y `aal.currentLevel === "aal1"` → `/mfa/setup` o `/mfa/verify` (con `next` para volver). `/mfa/*` queda exento del gate.

## RLS (base de datos)

Patrón: `my_role()` y `my_user_id()` (security definer) + policies por tabla. Resumen:

| Tabla | Lectura | Escritura |
|---|---|---|
| `users` | todos | admin; el propio usuario solo en su onboarding (update) |
| `schedules` | todos | admin |
| `attendance` | propio + admin/rh | propio (insert), admin |
| `vacations` | propio + admin + rh (solo aprobadas) | propio (insert); admin (update vía `approve_vacation`) |
| `incidents` | propio + admin/rh | propio (insert); admin |
| `holidays` | todos | admin |
| `requests` | propio + admin/empleado | propio + admin |
| `projects` | admin, asignados, o el solicitante de la request | admin; lead puede update |
| `project_assignments` | todos | admin |
| `checklist_templates/items` | todos | admin (templates) |
| `project_checklist` | admin o asignado | admin o asignado |
| `task_time_logs` | admin/rh o asignado | admin/rh o asignado |
| `time_edit_requests` | propio o admin | propio (insert); admin |
| `evidences` / `comments` | admin o asignado al proyecto | admin o asignado |
| `notifications` | propio | propio |
| `activity_logs` | admin | todos (insert) |
| `employee_availability` | todos | admin |
| `catalog_items` | todos | admin |
| `guards` | — (sin policies funcionales) | admin |

## Invariantes protegidas en el servidor (no confiar en el cliente)

- `trg_users_protect_self_update`: un usuario no se autoescala ni toca campos protegidos.
- `vacations_check_balance`: no se aprueban más días de los que hay de saldo.
- `requests_check_min_hours`: respeta el mínimo de horas de una solicitud.
- `one_active_task` / `project_start_on_time`: consistencia del flujo de trabajo.
- Chat RPC `nx_enlace_*`: mute/archivar/pin/leído se ejecutan contra el participante correcto, no por update libre.

## Almacenamiento

- `chat-files`: bucket **privado**, acceso por URL firmada/proxy; RLS en `storage.objects`.

## Notas de seguridad heredadas

- Las migraciones 0009 y 0010 (`w5`/`w5b_security_hardening`, `w5b_security_findings`) endurecieron: rechazo explícito (no silencioso) de cambios a `active`/`email`/`nexus_clave`, y cobertura de columnas protegidas.
- MFA es obligatorio para Admin/RH por decisión registrada (ver ADR-0004).
- El email de whitelist es la puerta: si el correo de Google no existe en `users`, el login no crea cuenta.
