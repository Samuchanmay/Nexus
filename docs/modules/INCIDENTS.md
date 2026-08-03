# Módulo · Incidencias

Rutas: dominio "Tiempo" → `Incidencias` · Roles: empleado (crea), admin/coordinador/rh (gestiona).

## Qué es

Registro de **desviaciones** de la jornada: retardos, faltas, salidas temprano, incapacidades y notas correctivas. Es el flujo hermano de las solicitudes, pero de **reporte** (ya ocurrió) en vez de petición (va a ocurrir).

## Modelo de datos (resumen)

- `incidencias` — `persona_id`, `tipo`, `fecha`, `descripcion`, `estado`, `resuelto_por`, `resuelto_at`.
- Tipos: retardo, falta, salida temprano, incapacidad, observación.
- Vínculo opcional con `asistencia` (el día afectado) y con `task_time_logs` (horas no trabajadas).

## Estados

`abierta → en_revision / resuelta / descartada`. Siempre conserva el autor y el auditor.

## Flujo

1. Empleado (o admin) reporta la incidencia con fecha y descripción.
2. Bandeja del gestor (admin/coordinador/rh) con badge de pendientes.
3. Al resolver se anota `resuelto_por`/`resuelto_at` y, si aplica, se ajusta la asistencia o el saldo (vía trigger).
4. La incidencia resuelta queda visible en el historial de la persona (perfil, `modules/PEOPLE.md`).

## Reglas

1. Las incidencias **nunca se borran**: solo se resuelven o descartan (auditoría).
2. Una incidencia resuelta con ajuste de saldo es transaccional (todo o nada).
3. El copy distingue "reportar" (incidencia) de "solicitar" (solicitud) para no confundir flujos.

## Ver también

- `docs/modules/TIME.md` — dónde encaja en el tiempo
- `docs/modules/REQUESTS.md` — el flujo de petición hermano
