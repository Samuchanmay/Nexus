# Módulo · Solicitudes

Rutas: dominio "Solicitudes" (crear + bandeja de aprobación) · Roles: admin, coordinador, empleado.

## Qué es

Bandeja de solicitudes del equipo: **cobertura** y **diseño** como tipos principales (extensibles), con flujo de aprobación por rol y validación server-side.

## Tipos

| Tipo | Subtipos | Qué pide |
|---|---|---|
| Cobertura | Guardia, Sustitución, Apoyo | Fecha/hora/lugar, quién la cubre |
| Diseño | y demás subtipos según catálogo | Título, descripción, archivos |

Los tipos de solicitud viven en el catálogo (`tipos_solicitud`) y se amplían desde config.

## Modelo de datos (resumen)

- `solicitudes` — cabecera: `tipo`, `subtipo`, `titulo`, `estado`, `prioridad`, `solicitante_id`, `fecha_hora`, `lugar`, `min_hours_required`.
- `solicitud_detalles` — datos específicos por subtipo.
- `solicitud_archivos` — adjuntos de la solicitud (pipeline de storage).
- `cobertura` — al aprobar cobertura, se genera el turno de guardia/sustitución.

## Estados

`pendiente → aprobada / rechazada / cancelada`. Aprobaciones con `aprobado_por` + timestamp (auditoría).

## Reglas (server-side)

1. `min_hours_required` se valida en trigger/Edge: una solicitud que exija N horas mínimas no puede aprobarse si la cobertura no las cubre.
2. La prioridad se ordena por `prioridad` y fecha en la bandeja.
3. Un empleado ve solo sus solicitudes; admin/coordinador ven la bandeja del equipo.
4. Solo admin puede borrar definitivamente; el resto cancela (histórico intacto).

## Flujo

1. Colaborador crea solicitud (form en `FORMS.md`; adjuntos en Sheets).
2. Bandeja del aprobador con badges de pendientes (`NotificationBell` + `Pill`).
3. Aprobar → toast "Guardado" + se materializa la cobertura/evento.
4. El solicitante recibe notificación (realtime + push si está inactivo).

## Ver también

- `docs/modules/CALENDAR.md` — materialización en agenda
- `docs/modules/INCIDENTS.md` — incidencias (flujo hermano de reporte)
- `docs/architecture/API.md` — RPC y Edge Functions de solicitudes
