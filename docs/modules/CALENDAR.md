# Módulo · Calendario de equipo

Rutas: dominio "Calendario" (vista del equipo) · Roles: admin, coordinador, departamento, rh.

## Qué es

Agenda compartida del equipo: eventos de trabajo, guardias/cobertura y vínculo con **Google Calendar** mediante Edge Functions.

## Edge Functions del calendario

| Función | Rol |
|---|---|
| `gcal-list-events` | Lista eventos del calendario conectado (filtro por rango `[start, end)`) |
| `gcal-create-event` | Crea evento en Google Calendar |
| `gcal-delete-event` | Borra/libera evento en Google Calendar |
| `notify-vacation` | Notifica vacaciones al conectar/actualizar (ver `modules/TIME.md`) |

Zona horaria fija: `America/Merida` (todos los cómputos de rango y visualización).

## Modelo de datos

- `calendario` — cabecera/instancias del calendario de equipo.
- `eventos` — eventos de la agenda (título, rango `[start, end)`, tipo, color, ubicación).
- `cobertura` / `guardias` — turnos de cobertura por persona (solicitudes de cobertura vinculadas).

## UI

- Grid de agenda propio del motor de calendario (no librería de terceros; ver `docs/design/PICKERS.md`).
- Los eventos se pintan con la paleta de eventos `--ev-*` y un stripe de color a la izquierda en las filas.
- Vista Semana/Mes con `SlidingSegments`.

## Reglas

1. Rango de fechas siempre `[start, end)` en el dominio y en Google; la UI lo muestra inclusivo.
2. Los eventos de Google traídos por RPC se cachean; la creación/borrado va por la Edge Function correspondiente.
3. Las vacaciones del calendario se sincronizan con el equipo y con `notify-vacation`.

## Ver también

- `docs/modules/TIME.md` — jornada y vacaciones
- `docs/modules/REQUESTS.md` — solicitudes de cobertura/guardia
- `docs/architecture/API.md` — lista de RPC y Edge Functions
