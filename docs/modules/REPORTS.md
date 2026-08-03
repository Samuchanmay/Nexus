# Módulo · Reportes

Rutas: dominio "Reportes" · Roles: admin, rh, coordinador.

## Qué es

La capa de **información para la operación**: quién trabajó, cuánto, y hacia dónde va el tiempo del equipo. La fuente es la DB; la salida es la pantalla + PDF/hoja de cálculo.

## Reportes actuales

| Reporte | Fuente | Salida |
|---|---|---|
| Asistencia semanal | `asistencia` + `task_time_logs` | Tabla por persona + resumen `StatCard` |
| Saldos de vacaciones | `saldo_vacaciones` | Lista/tarjeta con utilizados/pendientes |
| Horas por proyecto/actividad | `task_time_logs` + `proyectos` | Suma por semana, deltas vs objetivo |
| Exportación | — | **Excel** (exceljs 4.4.0) y PDF (print CSS) |

## Edge Functions

- `weekly-attendance-report` — calcula y/o envía el reporte semanal de asistencia.

## UI (ver `docs/design/TABLES.md`)

- Tablas de reporte: header `--surface-2`, números `tabular-nums` a la derecha, estados como píldora.
- Comparadores (asistencia vs objetivo) como barras/deltas en `StatCard`.
- En móvil, la tabla se convierte en tarjetas apiladas.
- Impresión: `@media print` con `break-inside: avoid` y colores en grises legibles.

## Reglas

1. Cero cálculos de reporte en el cliente: la aritmética vive en la DB (vistas/triggers) y en las Edge Functions; la UI solo formatea.
2. Las horas se muestran `8h 30m`, no decimales.
3. Un reporte es exportable o no lo es; si lo es, la exportación respeta exactamente lo que muestra la pantalla (mismo orden, mismos nombres).
4. Los reportes respetan el rol: rh/admin ven todo; coordinador ve su equipo.

## Ver también

- `docs/modules/TIME.md` — de dónde salen los datos
- `docs/modules/ACTIVITIES.md` — horas por actividad
- `docs/architecture/PERFORMANCE.md` — vistas materializadas y paginación
