# Módulo · Tiempo (jornada, vacaciones, asistencia)

Rutas: hub "Tiempo" — `Mi día` · `Vacaciones` · `Incidencias` · `Asistencia` · `Días inhábiles` · Roles: admin, empleado, coordinador, rh.

## Qué es

El corazón operativo: **qué tiempo se trabajó, cuánto queda y cuándo no se trabaja**. Unifica fichaje, saldos de vacaciones, asistencia y días inhábiles.

## Subsistemas

### 1. Fichaje / jornada (`/fichar`)
- Edge Function `fichar`: registra entrada/salida en `asistencia` (zona `America/Merida`), valida jornada y calcula horas.
- Dispositivos de control (`admin/config/gps` → `dispositivos_gps`, radios de geofence; ver `modules/SETTINGS.md`).
- `PausaActivaPopup` + pausa activa (`pausa_activa`): recordatorios de descanso durante la jornada.
- Estados de jornada configurables (`estados_jornada`).

### 2. Vacaciones
- Solicitud/saldo en `saldo_vacaciones` por persona (días disponibles).
- `notify-vacation` (Edge): al conectar o actualizar, notifica al equipo/calendario.
- Google Calendar se actualiza con eventos de vacaciones (`gcal-*`).

### 3. Incidencias → `modules/INCIDENTS.md`
### 4. Asistencia (`/admin/asistencia`)
- Tabla/lectura de asistencias por día; estados (presente/retardo/falta/incidencia).
- El reporte semanal se genera desde aquí (`weekly-attendance-report`).

### 5. Días inhábiles
- Catálogo `dias_inhabiles` (festivos) que ajustan saldos y calendario de trabajo.
- Afectan el cálculo de días laborables en solicitudes y reportes.

## Modelo de datos (resumen)

- `asistencia` — `user_id`, `fecha`, `entrada`, `salida`, `horas`, `estado`.
- `saldo_vacaciones` — `dias_totales`, `dias_utilizados`, `dias_pendientes`, actualizado por trigger.
- `dias_inhabiles`, `estados_jornada`, `pausa_activa`.
- `task_time_logs` — horas por actividad (ver `modules/ACTIVITIES.md`).

## Reglas

1. La única fuente de verdad de "hoy" es `America/Merida` (`src/lib/tz.ts`), usada por UI y Edge Functions.
2. `[start, end)` exclusivo en dominio; inclusivo en display.
3. Los saldos se actualizan por triggers (nunca por cálculo ad-hoc en UI).
4. Las horas de asistencia validan contra `task_time_logs` y contrato en el reporte semanal.

## Ver también

- `docs/modules/INCIDENTS.md`, `docs/modules/RECORRIDOS.md`, `docs/modules/REPORTS.md`
- `docs/architecture/DATABASE.md` — schema de saldos y triggers
- `docs/decisions/ADR-0005.md` — por qué los saldos viven en DB con triggers
