# Módulo · Actividades (Trabajo)

Rutas: dominio "Trabajo" (proyectos y actividades) · Roles: admin, empleado, coordinador.

## Qué es

El registro de **trabajo**: proyectos y actividades en los que se invierte tiempo. Es el "qué" que acompaña al "cuándo" de la jornada (ver `modules/TIME.md`).

## Modelo de datos

- `proyectos` — catálogo de proyectos (nombre, estado, área responsable).
- `actividades` — tareas/tipos dentro de proyectos; una actividad puede ser de trabajo o de otra naturaleza.
- `task_time_logs` — registros de tiempo: `user_id`, `fecha`, `tarea_id`, `horas`, `tipo` (trabajo/incapacidad/otro). Es la fuente de los cálculos de saldo y del reporte.
- `tasks` — tareas de proyecto (cuando hay granularidad por tarea).

## Cómo se relaciona con la jornada

- El fichaje (`fichar`) registra la entrada/salida en `asistencia`.
- Las `actividades` y `task_time_logs` registran en qué se trabajó.
- El **tiempo en actividad** durante la jornada alimenta `Tiempo` (Mi Día) y el reporte semanal.

## UI

- Catálogo con tarjetas/filas (ver `docs/design/CARDS.md`): nombre + estado como píldora.
- Alta de actividad con tipo (`tipo_tarea`), colores y asignación.
- Filtros por estado y área.

## Reglas

1. Los proyectos pueden heredar prioridad del contexto de la organización (`proyectos.prioridad`).
2. Las horas en `task_time_logs` se suman por semana para el reporte; el trigger de saldos valida que no excedan las horas de contrato (p. ej. 40h).
3. Cero emojis y copy en español en toda la UI (canon §2).
