# Auditoría del Sistema de Reportes

**Fecha**: 07 Ago 2026
**Estado**: 🟢 Implementación completa — motor único en producción (verificado con `tsc --noEmit` y `next build`).

---

## Resumen Ejecutivo

El usuario pidió simplificar el módulo Reportes: de un dashboard lleno de gráficas/KPIs poco consultados, a **4 reportes operativos** (Asistencia, Vacaciones, Pendientes por coordinación, Eventos por persona), todos generados por **un único motor de reportes** (`ReportEngine`), exportados siempre a Excel (`.xlsx`) con diseño profesional, y usando un **filtro de fechas único y reutilizable** (`DateRangeFilter`) en todo el sistema.

Esta auditoría localiza **todo** lo que hoy genera un reporte/exportación en EMET, identifica qué se duplica, qué no aporta valor, y qué debe unificarse — **antes de tocar código**, según lo pedido.

No se modificó ningún archivo de código en esta fase. Este documento es la fase 1 (auditoría). La fase 2 (arquitectura + implementación) se ejecuta tras confirmar el alcance con el usuario.

---

## 1. Inventario completo de lo que existe hoy

Fuente: catálogo ya sembrado en la bóveda EMET (`emet/15_REPORTS.md`, `emet/modulos/reportes.md`, escrito el mismo día por otra sesión) + verificación línea por línea contra el código actual. **Confirmado: no hay un sexto mecanismo oculto — R1-R5 es la lista completa.**

### R1 · Dashboard de agregados — `/admin/reportes/page.tsx`
Server Component sin filtros interactivos (agregado global, solo "hoy" para asistencia).
- KPIs: Solicitudes totales, Actividades creadas, Tiempo prom. de aprobación, Áreas solicitantes.
- Secciones: Tendencia (sparkline 8 semanas), Resumen (Top empleado / Área con más carga / Cuello de botella), Estado de asistencia hoy, Solicitudes por estado, Por tipo de apoyo, Áreas top 8, Horas por tipo, Vacaciones por persona (tabla + CSV).
- Exportaciones: CSV `vacaciones-por-persona.csv`, PDF vía `print-button.tsx` (`window.print`).

### R2 · Asistencia — `/admin/asistencia/client.tsx`
- Filtro: `?date=` (un solo día, máx. hoy). Sin rango.
- Exportaciones: CSV del día, CSV semanal, **Excel real** vía `XlsxReportButton`/`xlsx-weekly-report.tsx` (últimas 6 semanas, bloques Lun-Vie por persona).
- Envío por correo (manual o automático los lunes) vía Edge Function `weekly-attendance-report`.

### R3 · Panel RH — `/rh/client.tsx` (solo lectura)
- Filtro: periodo fijo (Semana/Quincena/Mes/Trimestre) + búsqueda por persona.
- Exportaciones: Excel semanal (mismo componente que R2), CSV con extensión `.xlsx` pero contenido CSV (con BOM) — **inconsistencia de formato**, reporte individual HTML imprimible, reporte general HTML imprimible.
- Regla propia: RH nunca ve retardos/faltas (no existen como concepto en Emet).

### R4 · Vacaciones admin — `/admin/vacaciones/client.tsx`
- Exportación: CSV `vacaciones-registro.csv` (todas las solicitudes, sin filtros de fecha/empleado/estado en el export — exporta todo).

### R5 · Proyectos admin — `/admin/proyectos/client.tsx`
- Exportaciones: CSV `actividades.csv`, reporte "Por empleado" (HTML imprimible con horas totales).

### Mecanismos de exportación encontrados (4, no unificados)
| Mecanismo | Dónde vive | Problema |
| --- | --- | --- |
| CSV data-URI | `admin/reportes/csv-link.tsx`, inline en asistencia/vacaciones/proyectos | 4 implementaciones distintas del mismo patrón |
| Excel real (exceljs) | `components/shared/xlsx-report.tsx` | **Hard-codeado** a la forma de "semana de asistencia" — columnas, colores y agrupación por semana son constantes de módulo, no parámetros. No reutilizable para otro tipo de reporte tal cual. |
| HTML imprimible (`window.print`) | **3 implementaciones independientes**: `admin/reportes/print-button.tsx` (genérico), `admin/proyectos/client.tsx` (HTML armado a mano con hex sueltos `#1E293B`, `#5856D6`...), `rh/client.tsx` (dos funciones, mismo patrón de hex sueltos) | Los 2 de proyectos/RH violan la regla de design system (`CLAUDE.md` regla 7: "sin hex sueltos") y no comparten código entre sí |
| Email | Edge Function `weekly-attendance-report` (Resend) | Solo asistencia semanal |

**Conclusión:** ya existen 4 mecanismos de exportación distintos y 3 implementaciones de "imprimir" independientes, exactamente el problema que el usuario describe ("inconsistencias", "lógica duplicada").

---

## 2. Qué NO es un duplicado (verificado, no se toca)

- **`/admin/equipo` ("Carga del equipo", nav.ts → Personas → Carga):** es una vista individual, en tiempo real, de hoy, sin agrupar por departamento, sin exportación. Muestra cuántas tareas activas tiene CADA persona ahora mismo (escala fija Disponible/Normal/Alta/Saturado por conteo de tareas). **No es un reporte de carga por departamento** — opera en otro grano (persona, no departamento; instantáneo, no histórico). No se fusiona con el nuevo Reporte 3; puede quedar como está o enlazar al nuevo reporte más adelante, decisión fuera de esta auditoría.
- **`admin/reportes` → "Cuello de botella":** es el precedente más cercano a "tiempo promedio de resolución por departamento" — agrupa `requests` por `requester_area` (texto libre, snapshot al crear la solicitud) y calcula horas promedio hasta aprobación. Se puede **reutilizar la lógica de promedio**, pero agrupa por texto libre, no por `departments.id` — ver hallazgo de modelado abajo.

## 3. Hallazgo de modelado: coordinación vs. departamento

`departments` es **una sola tabla** con columna `tipo` (`'coordinacion' | 'departamento'`) — no son conceptos separados en la base de datos. `users.area_id` referencia esta tabla (FK real). Sin embargo:

- `requests.requester_area` es **texto libre denormalizado** (snapshot al momento de crear la solicitud), **no** una FK a `departments.id`. Es lo que usa hoy "Cuello de botella".
- Esto significa que el nuevo **Reporte 3 (Pendientes por coordinación)**, si agrupa `requests`/`projects` por coordinación, no puede unirse de forma confiable con `departments` vía `requester_area` (no hay integridad referencial — nombres podrían no calzar exactamente).

**Recomendación para la fase de arquitectura:** agregar `requests.department_id` (FK real a `departments.id`), poblarla en el insert (mismo criterio que ya usa `requester_area`: `profile.departments?.id`), y usarla para el nuevo reporte — dejando `requester_area` como está (texto histórico, no se toca retroactivamente). Esto es un cambio de esquema (migración nueva) que debe pasar por ADR según `00_AI_GOVERNANCE.md` regla 5.

---

## 4. Qué se elimina / unifica (propuesta, pendiente de confirmación)

| Hoy | Acción propuesta |
| --- | --- |
| Dashboard de agregados en `/admin/reportes` (tendencia, top empleado, solicitudes por estado, por tipo de apoyo, áreas top 8, horas por tipo) | **Eliminar del módulo Reportes.** El usuario fue explícito: "no quiero un módulo lleno de gráficas o estadísticas que nunca voy a consultar" y su lista final de 4 reportes no lo incluye. La ruta `/admin/reportes` pasa a ser la landing de los 4 reportes nuevos. |
| CSV día/semana en `admin/asistencia` | **Reemplazar** por llamada al nuevo `AttendanceReport` del `ReportEngine` (mismo botón, misma pantalla, motor único). |
| Excel semanal (`xlsx-report.tsx` + `XlsxReportButton`) usado en asistencia y RH | **Generalizar** en el `ReportEngine` (parametrizar columnas/agrupación en vez de constantes de módulo) y que ambas pantallas lo consuman igual. |
| CSV `.xlsx`-con-contenido-CSV en `/rh` | **Eliminar el hack** — usar el `ReportEngine` real (Excel de verdad, no CSV disfrazado). |
| Reportes HTML imprimibles con hex sueltos (`admin/proyectos`, `rh` x2) | **Eliminar** las 3 implementaciones; si se necesita imprimir, usar Excel (que ya es "listo para imprimir o enviar" según el estándar pedido) o un único componente de impresión tokenizado, a decidir en la fase de arquitectura. |
| CSV `vacaciones-registro.csv` en `admin/vacaciones` (sin filtros) | **Reemplazar** por `VacationReport` del motor, con filtros reales (empleado/departamento/estado/periodo). |
| CSV `actividades.csv` + reporte "Por empleado" en `admin/proyectos` | El export CSV de actividades **se mantiene fuera del alcance de los 4 reportes** (no está en la lista final del usuario) — se dejaría tal cual, o se podría migrar a Excel más adelante si el usuario lo pide explícitamente (fuera de este rediseño). |
| "Cuello de botella" (lógica de promedio por área) | **Reutilizar** la lógica de promedio de horas dentro del nuevo `DepartmentPendingReport`/`Pendientes por coordinación`, no reescribirla. |

**Ningún archivo se borra directamente por mí** (regla de la sesión: sin borrado de archivos de mi parte) — las rutas/componentes que queden obsoletos se vacían/redirigen, y el usuario decide si borra el archivo físico él mismo.

---

## 5. Los 4 reportes finales (spec del usuario, versión definitiva — su último mensaje reemplaza al primero)

1. **Asistencias** — filtros: empleado, departamento, día/semana/quincena/mes/rango personalizado. Columnas: fecha, entrada, salida a comida, regreso de comida, salida final, horas trabajadas, horas extra, retardos, observaciones. Estados reales (nunca "sin fichar" para alguien de vacaciones). Botones: Exportar Excel, Exportar PDF, Imprimir.
2. **Vacaciones** — filtros: empleado, departamento, año. Columnas extensas (otorgados/usados/disponibles, fechas de ingreso/reinicio/periodo/solicitud/autorización/inicio/fin, total tomado, estatus). Tarjeta resumen: tomadas este año, próximos reinicios, empleados con <5 días disponibles.
3. **Pendientes por coordinación** — gráficas: creados, terminados, tiempo promedio de resolución. Tabla: Coordinación · Pendientes · Terminados · Pendientes abiertos · Tiempo promedio.
4. **Eventos por persona** — filtros: día/semana/mes/rango. Columnas: empleado, evento, cliente, fecha, hora, tipo, estado, horas invertidas. Resumen: eventos por empleado, terminados, pendientes, horas trabajadas en eventos.

Reglas transversales pedidas: `DateRangeFilter` único para todo el sistema (no solo Reportes — "todos los módulos que muestren información histórica"), filtros rápidos (Hoy/Ayer/Esta semana/.../Este año) + rango personalizado sin límite artificial, filtros combinables, persistencia del último filtro en sesión, arquitectura preparada (no implementada) para comparar periodos, encabezado de Excel con periodo/fecha de generación/filtros aplicados, formato dd/MM/yyyy y hora 12h, colores del design system, sin CSV como formato principal.

---

## 6. Plan de arquitectura propuesto (para la fase de implementación)

```
ReportEngine (src/lib/reports/)
 ├─ engine.ts        — orquestador: recibe {type, filters} → arma workbook
 ├─ types.ts         — DateRangePreset, ReportFilters, ReportColumn<T>, etc.
 ├─ xlsx-builder.ts  — generalización de xlsx-report.tsx (columnas/filas como parámetros, no constantes)
 ├─ attendance.ts    — AttendanceReport: query + shape de filas + estado real (nunca "sin fichar" en ausencias)
 ├─ vacations.ts     — VacationReport
 ├─ department-pending.ts — DepartmentPendingReport ("Pendientes por coordinación")
 └─ events-by-person.ts   — EventsByPersonReport

src/components/reports/
 └─ date-range-filter.tsx — DateRangeFilter único (presets + rango + persistencia sesión)
```

Cada pantalla que hoy exporta algo (`admin/asistencia`, `admin/vacaciones`, `rh`, `admin/reportes`) importa el reporte correspondiente del motor — mismo Excel exacto, sin importar desde qué pantalla se generó.

**Migración de esquema requerida:** `requests.department_id` (FK real) — ver hallazgo §3. Requiere ADR.

---

## 7. Confirmación de que no hay implementaciones duplicadas

**Verificado al cierre de la implementación (7 ago 2026):**

- **Todo export de Excel pasa por el motor único**: `downloadReportXlsx()`/`buildReportWorkbook()` en `src/lib/reports/xlsx-builder.ts`. Ningún módulo arma su propio workbook con ExcelJS.
- **Los 4 reportes** (`/admin/reportes`, 4 pestañas) consumen los motores `src/lib/reports/{attendance,vacations,department-pending,events}.ts` — la tabla en pantalla y el archivo usan la MISMA definición de columnas y el MISMO formateo (`formatReportCell`).
- **Pantallas legadas migradas al mismo motor** (unificación autorizada por el usuario, opción "Total"):
  - `admin/asistencia`: "Exportar Excel" del día y de las últimas 8 semanas → `AttendanceReport`.
  - `admin/vacaciones`: "Exportar Excel" (registro del año) → `VacationReport`.
  - `/rh`: "Exportar Excel" (asistencia del periodo) → `AttendanceReport`; "Reporte individual" y "Reporte general (todos)" → `VacationReport`.
- **Eliminados** (vaciados a marcadores, no borrados físicamente — ver nota de §4):
  - Los **4 CSV data-URI** (asistencia día/semana, vacaciones, el `CsvLink` genérico de `csv-link.tsx`).
  - El **CSV con extensión `.xlsx`** de `/rh` (bug de formato: contenido CSV disfrazado de Excel).
  - El **Excel semanal hardcodeado** (`xlsx-report.tsx` → quedan solo los tipos `WeekBlock`/`DayDetail` que la vista "Semana" usa en pantalla; el botón y el builder se fueron al motor).
  - Los **3 reportes HTML imprimibles con hex sueltos** (`printIndividualReport` y `printTeamReport` en `/rh`, `printByEmployeeReport` en `admin/proyectos`) — violaban la regla 7 del design system.
- **Conservado a propósito** (no son duplicados del motor, son canales distintos):
  - CSV `actividades.csv` en `admin/proyectos` (queda fuera del alcance de los 4 reportes, según §4).
  - Edge Function `weekly-attendance-report` (correo automático/manual — el email es un canal, no una descarga).
  - `window.print()` sobre la propia página (imprimir la vista actual, no un reporte generado).

## 8. Qué módulos consumen ahora el mismo motor

| Módulo | Botón/acción | Reporte del motor |
| --- | --- | --- |
| `/admin/reportes` → Asistencia | Exportar Excel / Guardar como PDF | `AttendanceReport` (`attendance.ts`) |
| `/admin/reportes` → Vacaciones | Exportar Excel / Guardar como PDF | `VacationReport` (`vacations.ts`) |
| `/admin/reportes` → Pendientes por coordinación | Exportar Excel / Guardar como PDF | `DepartmentPendingReport` (`department-pending.ts`) |
| `/admin/reportes` → Eventos por persona | Exportar Excel / Guardar como PDF | `EventsByPersonReport` (`events.ts`) |
| `/admin/asistencia` (vista día) | Exportar Excel | `AttendanceReport` (rango = día) |
| `/admin/asistencia` (vista Semana) | Exportar Excel | `AttendanceReport` (rango = últimas 8 semanas) |
| `/admin/vacaciones` | Exportar Excel | `VacationReport` (año actual) |
| `/rh` | Exportar Excel (asistencia) | `AttendanceReport` (periodo Semana/Quincena/Mes/Trimestre) |
| `/rh` | Reporte individual / general | `VacationReport` (año actual, con/sin empleado) |

Filtro de fechas: `DateRangeFilter` + `useDateRangeFilter` (`src/components/reports/date-range-filter.tsx`) es el único para todo el sistema — presets (Hoy/Ayer/Esta semana/…/Este año) + rango personalizado sin límite, persistencia en `sessionStorage`, arquitectura preparada para comparar periodos.

## 9. Qué dependencias se modificaron

- **package.json: sin cambios.** `exceljs` sigue siendo la única librería de Excel y ahora se consume solo desde el motor. No se agrega ninguna librería de CSV/PDF.
- **Migraciones nuevas (sin commitear, requeridas por el motor):**
  - `0050_requests_department_id.sql` — FK real `requests.department_id` + backfill case-insensitive (Reporte 3, hallazgo §3).
  - `0051_vacations_resolved_by.sql` — columnas `resolved_by`/`resolved_at` + reescritura de `approve_vacation` con `my_user_id()` (campo "Quién autorizó" del Reporte 2).

---

## Resultado

1. **Los 4 reportes operativos** están en `/admin/reportes`, con filtros combinables, `DateRangeFilter` único y export Excel institucional (encabezado con periodo/fecha/filtros, fechas dd/MM/yyyy, horas 12h, colores EMET, sin CSV).
2. **Exportaciones legadas unificadas al motor** en asistencia, vacaciones, RH y proyectos (proyectos conserva su CSV de actividades, fuera de alcance).
3. **Verificación:** `npx tsc --noEmit` limpio y `npx next build` exitoso.

Pendientes para el usuario:
- Correr en la BD las migraciones `0050` y `0051` (las requiere el motor de vacaciones y el Reporte 3).
- Decidir si borra físicamente los archivos vaciados (`admin/reportes/csv-link.tsx`, `admin/reportes/print-button.tsx`); los demás quedaron como marcadores o con solo tipos.
- Futuro (no implementado, a pedido explícito): comparación de periodos (`ReportComparisonConfig` ya reservado en `types.ts`), y reportes de proyectos/actividades dentro del motor.
