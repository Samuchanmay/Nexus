# Sistema de Badge de Jornada — Reglas y Estados

> Documento de referencia para entender cómo funciona el badge/estado de jornada en EMET antes de hacer cambios.

---

## Fuente de verdad única

**Archivo**: `src/lib/domain/attendance/status.ts`

Este módulo es la **única fuente de verdad** para determinar "¿por qué esta persona no inició su jornada?" en toda la app (Asistencia, Equipo, Directorio, Hoy, Mi día, Reportes).

---

## Tipos de estado (16 estados totales)

```typescript
type AttendanceStatusKey =
  // Jornada activa
  | "trabajando"                    // En jornada laboral normal
  | "pausa"                         // En pausa activa (comida, descanso)
  
  // Eventos administrativos (admin puede asignar)
  | "vacaciones"                    // Período de vacaciones
  | "incapacidad"                   // Incapacidad médica
  | "permiso"                       // Permiso personal
  | "comision"                      // Comisión de trabajo
  | "home_office"                   // Trabajo remoto
  | "falta_justificada"             // Falta con justificación
  | "dia_inhabil"                   // Día feriado/inhábil
  | "descanso"                      // Día de descanso programado
  
  // Estados de error/sin jornada
  | "falta_injustificada"           // No fichó en día laboral pasado
  | "sin_iniciar"                   // Aún no ha fichado hoy
  | "no_registro_salida"            // Fichó entrada pero no salida (crítico)
  | "pendiente_confirmar_salida"    // Salida registrada, pendiente confirmación
  | "jornada_terminada"             // Cerró jornada correctamente
  | "fuera_horario";                // Pasó hora de entrada sin fichar
```

---

## Variantes de badge (colores)

```typescript
type BadgeVariant = "ok" | "warn" | "danger" | "accent" | "purple" | "muted";
```

| Variante | Token CSS | Uso |
|----------|-----------|-----|
| `ok` | `var(--ok)` | Estados positivos (trabajando) |
| `warn` | `var(--warn)` | Advertencias (pausa, pendiente) |
| `danger` | `var(--danger)` | Errores críticos (no registró salida, falta) |
| `accent` | `var(--accent)` | Eventos especiales (comisión, home office) |
| `purple` | `var(--purple)` | Vacaciones |
| `muted` | `var(--text-3)` | Estados neutros (sin iniciar, terminada) |

---

## Tabla de prioridad (orden de evaluación)

El resolver evalúa en este orden. **El primero que matchea gana**:

| Prioridad | Estado | Condición |
|-----------|--------|-----------|
| 100 | `no_registro_salida` | `noRegistroSalida === true` (fichó entrada pero no salida) |
| 99 | `pendiente_confirmar_salida` | `pendingExitConfirmation === true` |
| 98 | `trabajando` / `pausa` | `isOpen && firstIn` (jornada activa) |
| 90 | `vacaciones` | `vacation !== null` |
| 85 | `incapacidad` | `incident.kind === "incapacidad"` |
| 80 | `permiso` | `incident.kind === "permiso"` |
| 75 | `comision` | `incident.kind === "comision"` |
| 70 | `home_office` | `incident.kind === "home_office"` |
| 65 | `falta_justificada` | `incident.kind === "falta_justificada"` |
| 60 | `dia_inhabil` | `isHoliday === true` |
| 55 | `descanso` | `restDay !== null` |
| 50 | `jornada_terminada` | `firstIn !== null && !isOpen` (cerró jornada) |
| 10 | `falta_injustificada` | Fecha pasada, día laboral, sin fichar |
| 5 | `fuera_horario` | Hoy, pasó hora de entrada, sin fichar |
| 0 | `sin_iniciar` | Hoy, aún no ha fichado |

---

## Propiedades derivadas

Cada estado calcula automáticamente estas propiedades:

| Propiedad | Descripción | Estados que la tienen |
|-----------|-------------|----------------------|
| `canCheckIn` | Puede fichar entrada | `sin_iniciar`, `fuera_horario` |
| `canCheckOut` | Puede fichar salida/pausa | `trabajando`, `pausa` |
| `showInDirectory` | Aparece en Directorio/Equipo | Todos excepto `sin_iniciar`, `jornada_terminada`, `fuera_horario` |
| `showInReports` | Aparece en reportes semanales | Todos excepto `sin_iniciar`, `fuera_horario` |

---

## Estructura de respuesta

```typescript
interface AttendanceStatus {
  // Identificación
  key: AttendanceStatusKey;      // "trabajando", "vacaciones", etc.
  label: string;                 // "Trabajando", "Vacaciones"
  title: string;                 // Igual a label (separable en futuro)
  
  // Visual
  icon: string;                  // "walk", "plane", "alert", etc.
  color: string;                 // var(--token) — SIEMPRE de aquí
  badgeVariant: BadgeVariant;    // "ok", "warn", "danger", etc.
  
  // Descripción
  description?: string;          // Detalle para tooltips (rango vacaciones, nota)
  reason?: string;               // Motivo específico
  
  // Reportes
  reportLabel: string;           // "VACACIONES", "NO REGISTRÓ SALIDA" (uppercase)
  
  // Comportamiento
  canCheckIn: boolean;
  canCheckOut: boolean;
  showInDirectory: boolean;
  showInReports: boolean;
  
  // Ordenamiento
  priority: number;              // 0-100 (mayor = más importante)
}
```

---

## Eventos administrativos

El admin puede asignar estos eventos a un empleado:

| Evento | Icono | Badge | Prioridad |
|--------|-------|-------|-----------|
| Vacaciones | `plane` | `purple` | 90 |
| Incapacidad | `medical` | `danger` | 85 |
| Permiso | `flag` | `warn` | 80 |
| Comisión | `walk` | `accent` | 75 |
| Home office | `building` | `accent` | 70 |
| Falta justificada | `info` | `warn` | 65 |
| Día inhábil | `calendar` | `muted` | 60 |
| Descanso | `moon` | `accent` | 55 |

---

## Casos especiales

### 1. No registró salida (crítico)
- **Condición**: Fichó entrada pero no salida al final del día
- **Badge**: `danger` (rojo)
- **Prioridad**: 100 (la más alta)
- **Reporte**: "NO REGISTRÓ SALIDA"
- **Acción requerida**: Admin debe corregir manualmente

### 2. Pendiente de confirmar salida
- **Condición**: Salida registrada pero pendiente confirmación
- **Badge**: `warn` (amarillo)
- **Prioridad**: 99
- **Reporte**: "PENDIENTE CONFIRMAR SALIDA"
- **Acción**: Empleado o admin confirma

### 3. Falta injustificada
- **Condición**: Fecha pasada, día laboral, sin fichar
- **Badge**: `danger` (rojo)
- **Prioridad**: 10
- **Reporte**: "FALTA INJUSTIFICADA"

### 4. Fuera de horario
- **Condición**: Hoy, pasó hora de entrada programada, sin fichar
- **Badge**: `muted` (gris)
- **Prioridad**: 5
- **Reporte**: "FUERA DE HORARIO"

---

## Flujo de resolución

```
1. ¿No registró salida? → no_registro_salida (100)
2. ¿Pendiente confirmar salida? → pendiente_confirmar_salida (99)
3. ¿Jornada activa? → trabajando/pausa (98)
4. ¿Vacaciones? → vacaciones (90)
5. ¿Incidencia? → incapacidad/permiso/comisión/etc (85-65)
6. ¿Día inhábil? → dia_inhabil (60)
7. ¿Día descanso? → descanso (55)
8. ¿Jornada cerrada? → jornada_terminada (50)
9. ¿Fecha pasada sin fichar? → falta_injustificada (10)
10. ¿Hoy, pasó hora entrada? → fuera_horario (5)
11. ¿Hoy, sin fichar? → sin_iniciar (0)
```

---

## Uso en componentes

```typescript
import { getAttendanceStatus, type ResolveInput } from "@/lib/domain/attendance/status";

const input: ResolveInput = {
  date: "2026-08-04",
  today: "2026-08-04",
  firstIn: "08:12",
  isOpen: true,
  noRegistroSalida: false,
  pendingExitConfirmation: false,
  liveStateName: "Trabajando",
  liveStateColor: null,
  vacation: null,
  incident: null,
  isHoliday: false,
  restDay: null,
  isBusinessDay: true,
  scheduleEndPassedWithoutEntry: false,
};

const status = getAttendanceStatus(input);
// status.key === "trabajando"
// status.badgeVariant === "ok"
// status.color === "var(--ok)"
// status.canCheckOut === true
```

---

## Reglas de negocio importantes

1. **El resolver es puro**: no hace I/O, el caller ya trae los catálogos filtrados
2. **Prioridad fija**: el primer estado que matchea gana (no se combinan)
3. **Colores por token**: SIEMPRE usar `var(--token)`, nunca hardcodear colores
4. **No acoplar a React**: el resolver no sabe de UI, solo devuelve datos
5. **Extensible**: agregar nuevos estados requiere actualizar `AttendanceStatusKey` y la tabla de prioridad

---

## Pendientes de implementación

Según la conversación con el usuario (04 Ago 2026):

- [ ] **Corrección de registros por admin**: permitir editar entrada/salida/comida con historial
- [ ] **Solicitudes de empleado**: botón "Solicitar corrección" → admin aprueba
- [ ] **Validaciones inteligentes**: detectar salidas anteriores a entrada, jornadas >16h, etc.
- [ ] **Time picker estilo Apple**: selector de hora/minutos/AM-PM
- [ ] **Historial de modificaciones**: nunca sobrescribir, siempre registrar cambio
- [ ] **Quitar "Solicitar validación RH"** del popup de salida olvidada → solo "Guardar"
- [ ] **Formato 12 horas en UI**: internamente timestamp, mostrar 1:30 p.m.

---

## Archivos relacionados

- `src/lib/domain/attendance/status.ts` — resolver principal
- `src/components/os/jornada-watcher.tsx` — watcher de salida olvidada
- `src/components/os/resolve-pending-exit.tsx` — popup de confirmación
- `src/app/admin/asistencia/page.tsx` — vista admin
- `src/app/admin/empleados/[id]/page.tsx` — detalle empleado
- `docs/03-ROADMAP.md` — roadmap de asistencia
