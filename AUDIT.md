# AUDIT.md — Auditoría técnica de Nexus v1

**Auditor:** Senior Software Engineer (revisión estática completa: 22 rutas, 2 Edge Functions, schema SQL de 470+ líneas, middleware, lib)
**Fecha:** 2026-07-02
**Regla de la auditoría:** solo diagnóstico — ningún archivo fue modificado.

---

## Resumen ejecutivo

El proyecto compila limpio y la arquitectura (Next.js App Router + Supabase + RLS) es correcta y se mantiene. Sin embargo, la auditoría encontró **1 familia de bugs crítica (zona horaria)**, **6 bugs funcionales**, **validaciones de negocio que solo existen en el cliente**, **~9 tablas/columnas sin UI** (features incompletas o código muerto según se decida), **duplicación significativa en 8 archivos**, y **4 desviaciones de diseño** respecto a las pantallas v6 aprobadas (confirmadas por el cliente como las que se deben mantener).

---

## 1 · BUGS

### 🔴 B1 — CRÍTICO · Zona horaria UTC en fechas y horas (14 ocurrencias + schema)
- `new Date().toISOString().slice(0,10)` se usa en 14 puntos (fichar, admin, rh, empleado) para obtener "hoy". `toISOString()` es **UTC**: en Mérida (UTC−6/−5), **a partir de ~18:00–19:00 el sistema cree que ya es mañana**. La jornada de la tarde de Jorge (14:00–21:00) se partiría en dos días.
- `supabase/schema.sql`: `attendance.date default current_date` y `time default localtime` usan la zona del servidor Postgres (**UTC en Supabase**) → los fichajes insertados por la Edge Function guardarían fecha/hora UTC.
- `hours.ts → summarizeDay` con jornada abierta usa `new Date()` del proceso: en Server Components corre en Vercel (UTC) → el "laborado hasta ahora" sale mal por horas.
- **Impacto:** cálculo de horas, historial, asistencia en vivo y RH: todos incorrectos parte del día. **Debe corregirse antes de cualquier otra cosa.**
- **Corrección propuesta (F0):** helper único `lib/tz.ts` con `todayMerida()`, `nowMeridaMinutes()` (Intl API, zona `America/Merida`); en schema, que la Edge Function calcule fecha/hora explícitamente en esa zona (no defaults); `ALTER DATABASE ... SET timezone` como refuerzo.

### 🔴 B2 — Fichar: closure viejo tras registrar
`src/app/fichar/page.tsx` → tras éxito: `setTimeout(() => setPhase(nextReasons(todayRows).length ? "ready" : "done"), 2600)`. `todayRows` es el estado **anterior** al `loadData()`; el botón siguiente puede quedar en estado incorrecto (p. ej. ofrecer "Entrada a trabajo" otra vez). Corrección: derivar de los rows recién cargados.

### 🔴 B3 — Sin transición `aprobada → en_progreso`
Al aprobar, el proyecto queda `aprobada`. `tasks.tsx` solo muestra "Pasar a revisión" cuando `status === "en_progreso"` — **ningún código pone en_progreso jamás**: el responsable no puede avanzar el proyecto. Corrección: `startTask` (primer inicio de tiempo) debe promover el proyecto a `en_progreso`.

### 🟠 B4 — Carrera en descuento de saldo de vacaciones
`admin/vacaciones/client.tsx` calcula el nuevo saldo con el prop `team` (fotografía al cargar la página) y hace un `update` separado. Dos aprobaciones seguidas sin recargar, o una solicitud del empleado entre medias, corrompen el saldo. Corrección: función SQL `approve_vacation(id)` atómica (RPC) que valide y descuente en una transacción.

### 🟠 B5 — Validaciones solo en el cliente (esquivables por API)
- Saldo de vacaciones: el empleado puede insertar una solicitud mayor a su saldo llamando a la API directa (RLS no lo valida).
- Anticipación 72h/168h: el wizard la valida; la tabla `requests` no.
- Una-tarea-activa: `startTask` revisa en el cliente; sin constraint, dos pestañas abren dos logs activos.
- Corrección: triggers/constraints en Postgres (índice parcial `unique ... where ended_at is null` por usuario vía trigger, `check`/trigger en vacations y requests).

### 🟡 B6 — Anti-duplicado de fichaje insuficiente
`UNIQUE(user_id, reason, date, time)` solo bloquea duplicados en el **mismo segundo**. Doble toque con 2 s de diferencia crea dos registros (el bug original del checador era el inverso: éxito falso; ese sí está resuelto). Corrección: regla de enfriamiento en la Edge Function (rechazar mismo motivo < N min) — configurable.

### 🟡 B7 — Consulta con embed muerto en `/admin/proyectos`
`select(... , task_time_logs:project_assignments(task_time_logs(minutes)))` — segundo embed de la misma relación, aliasado, y **su resultado nunca se usa**. Peso muerto en cada request y confusión futura.

### 🐛 B8 — (Sistema legado) Quotes duplicados en `checador.html`
Confirmado el bug reportado: `mostrarResultado()` **inserta** un `.quote-resultado` en cada registro exitoso, pero la limpieza solo ocurre en `reiniciar()` y con `querySelector` (elimina **uno**). Registro repetido sin pasar por `reiniciar` (doble callback, doble tap) ⇒ quotes apilados que ya nunca se limpian todos. Relevante porque el cliente pidió **conservar este diseño de checador** en Nexus: al portarlo, el patrón correcto es limpiar-antes-de-insertar (`querySelectorAll(...).forEach(remove)`).

---

## 2 · FUNCIONES INCOMPLETAS (existen en schema/UI a medias)

| # | Elemento | Estado actual | Falta |
|---|---|---|---|
| I1 | **Validación de "Agregar actividad"** | El empleado crea proyecto `en_revision` | UI de admin para validar/rechazar actividades manuales |
| I2 | `time_edit_requests` | Tabla + RLS listas | UI de solicitud de corrección y de aprobación |
| I3 | `evidences` / `comments` | Tablas + RLS listas | UI en proyectos |
| I4 | `notifications` | Tabla + RLS listas | Servicio que las genere y campana en UI |
| I5 | `activity_logs` | Tabla lista, nadie escribe | Registro sistemático de acciones |
| I6 | `employee_availability` | Tabla lista | UI/uso en asignación |
| I7 | Escalamiento de prioridad 48/24 h | Solo "sugerencia" al aprobar | Cron real que escale proyectos activos |
| I8 | `calendar_event_id` / `drive_folder_url` | Columnas listas; Calendar es enlace manual | Integración API completa (crear/actualizar/borrar; carpeta Drive) — **pedida ahora** |
| I9 | Reinicio anual de vacaciones | `vacation_balance_reset`, `vacation_days_per_year`, `hire_date` sembrados | Job que reinicie por aniversario + antigüedad |
| I10 | Time tracking | Iniciar/Finalizar | **Pausar/Reanudar** + estadísticas |
| I11 | Incapacidades | CRUD básico en incidencias | Adjuntos (PDF/imagen → Storage), flujo propio |
| I12 | Reportes | CSV en RH | PDF/Excel + filtros + más entidades |
| I13 | Retry de correo de vacaciones | `notification_sent` flag | Reintento si Resend falla |

## 3 · CÓDIGO MUERTO

| # | Elemento | Ubicación |
|---|---|---|
| D1 | `REASON_FLOW` exportado, 0 usos | `lib/types.ts` |
| D2 | `isWorkday` exportado, 0 usos directos (solo interno de `businessDaysBetween`; no debe exportarse) | `lib/hours.ts` |
| D3 | Embed aliasado sin uso (ver B7) | `admin/proyectos/page.tsx` |
| D4 | `Schedule.work_days` — se guarda, jamás se lee | schema + types |
| D5 | `guards` (por diseño, fuera de v1 — mantener documentado, no es hallazgo nuevo) | schema |
| D6 | HTMLs `cert-*` v1–v5 en outputs (solo v6 es vigente) | housekeeping |

## 4 · DUPLICADOS

| # | Duplicación | Archivos | Propuesta |
|---|---|---|---|
| C1 | `STATUS_TONE` (4 copias), `PRIORITY_TONE` (3), `KIND_LABELS` (2) | 8 archivos client | **`lib/ui-maps.ts`** único |
| C2 | `calendarUrl()` casi idéntica | `admin/vacaciones/client.tsx`, `admin/solicitudes/client.tsx` | **`lib/gcal.ts`** |
| C3 | Cabecera de página (`header` + h1 + sub) repetida 12 veces | todas las páginas | `<PageHeader/>` |
| C4 | Patrón formulario en Sheet (label+field+botonera) | 6 sheets | `<Field/>`, `<SheetActions/>` |
| C5 | `location.reload()` ×14 como "refresh" | clients | `router.refresh()` de Next + estado local |
| C6 | Constantes GPS en cliente y Edge Function (`.env` doble) | fichar + function | fuente única documentada (riesgo de deriva de config) |
| C7 | Fila-empleado con avatar+nombre+meta | rh, admin/nexus, admin/equipo, admin/empleados | `<PersonRow/>` |

## 5 · COMPONENTES REUTILIZABLES A EXTRAER
`PageHeader`, `PersonRow`, `StatCard` (KPI), `Field`, `SheetActions`, `EmptyState`, `StatusPill(status)` (envolviendo ui-maps), hook `useSupabaseMutation` (saving+toast+refresh) — reduce ~30 % del código client.

## 6 · SEGURIDAD / RLS (observaciones)
- `pa_read using(true)` y `users_read using(true)`: un **coordinador** puede leer todas las asignaciones y todos los perfiles (correos incluidos). Aceptable para 4 personas; recomendable restringir columnas vía vista si crece.
- `users_self_onboard` permite al usuario actualizar **cualquier campo propio** (incl. `role`). Restringir con `with check` de columnas o trigger. **Prioridad alta.**
- Middleware "modo demo" (sin env → no bloquea): correcto en dev, pero si en prod faltan las env vars, la app queda abierta. Añadir fail-closed en producción.
- Falta rate-limit humano en `/fichar` (ver B6).

## 7 · DESVIACIONES DE DISEÑO (feedback del cliente + `Pantallas_que_quiero_mantener.zip` = mockups v6)
| # | Pantalla | Desviación | Acción acordada |
|---|---|---|---|
| U1 | **Checador** | Nexus /fichar usa diseño nuevo; el cliente prefiere el diseño de su `checador.html` actual (logo, selector de tipo/motivo, quote del día) | Portar ese diseño a /fichar conservando la lógica server-confirm de Nexus; corregir bug de quotes (B8). Empleado = sesión (sin selector) |
| U2 | **Empleado** | Rediseñé el "Mi Día" en vez de usar el v6; y la portada mezcla jornada+tareas | Restaurar **hero y tarjetas v6** como pestaña "Mi Día"; Jornada / Vacaciones / Incidencias como **pestañas separadas** (las rutas ya existen: es fidelidad visual + tabs) |
| U3 | **Admin** | Dashboard fusionado "se siente todo junto" | Volver a la estructura v6: sidebar con vistas separadas (Resumen / Proyectos / Calendario / Equipo / Empleados) + secciones Nexus (Asistencia, Vacaciones, Incidencias, Días inhábiles) cada una en su vista, sin fusionar |
| U4 | **Coordinador** | Correcto: onboarding solo 1.ª vez ya implementado | Solo alinear visual al v6 |

## 8 · CONFLICTO DE REQUISITOS — ✅ RESUELTO por el propio blueprint del cliente
El requerimiento genérico de Dashboard pedía indicadores de **"Retardos" y "Faltas"**, pero el documento de traspaso subido por el cliente (`TRASPASO_CERT_Operaciones.md` §3) es explícito: *"NO se miden retardos. Eliminado por completo… Se mide 'Días objetivo': X de Y días"*, y §6: *"RH NUNCA ve retardos/faltas/admin"*.
**Resolución aplicada al roadmap:** los indicadores se implementan como **"Días objetivo (X de Y)"** y **"Días sin registro (informativo)"**. Sin retardos ni faltas en ninguna vista.

## 9 · SISTEMA LEGADO `cert_nexus.html` — inventario de fusión (Nexus.zip)
El cliente subió su dashboard RH original ("CERT Nexus", Apps Script + Sheets, 1 325 líneas) con instrucción de **fusionarlo** con el diseño principal ya trabajado (v6), todo sobre Supabase. Auditoría del legado:

**13 vistas construidas:** Dashboard (centro operativo) · Vista del día (tabla + **Gantt diario con línea "Ahora"** — la pieza estrella) · Equipo (lista/galería + panel contextual deslizante) · Mi Jornada · Calendario (heatmap mensual) · **Guardias** (rotación de sábado con intercambios) · Centro de Incidencias · Vacaciones · Permisos · Incapacidades · Días Inhábiles · Reportes (sin exportación real) · Administración (drawers de alta).

**Piezas del legado que Nexus (Next.js) NO tiene aún** → entran al plan de fusión:
| # | Pieza | Destino en Nexus |
|---|---|---|
| L1 | Banda de alertas inteligentes + KPIs de estado en vivo (En jornada / En comida / Completaron / Vacaciones) | Admin → Resumen |
| L2 | **Gantt diario** por persona con línea "Ahora" + tabla Vista del día | Admin → Asistencia (toggle tabla/Gantt) |
| L3 | Feed de actividad tipo Slack | Admin → Resumen |
| L4 | Panel contextual deslizante en Equipo (clic persona → detalle sin salir) | Admin → Equipo |
| L5 | Calendario mensual con heatmap | Admin → Calendario |
| L6 | Vista Guardias (sábados, intercambios) — tabla `guards` ya existe en el schema | ⚠️ estaba diferida de v1; el legado la incluye → **se incorpora en F6** |
| L7 | Command palette (⌘K) y drawers | Admin (mejora transversal, F1) |
| L8 | Selector de rol demo | Se descarta: Nexus ya usa Supabase Auth real ✓ |

**Requisitos explícitos del traspaso ya cubiertos por Nexus:** confirmación real por `id` devuelto ✓ · aviso en pantalla si no se guardó ✓ · constraint `unique` ✓ · Auth real con roles ✓ · zona de cálculo "horas objetivo" ✓ (pendiente fix B1).

**Requisitos del traspaso NO cubiertos aún (nuevos hallazgos):**
| # | Requisito (fuente) | Estado |
|---|---|---|
| I14 | **Migrar los 108 registros históricos de asistencia** (Excel `ASISTENCIA`, 17-jun→1-jul) — checklist §10.2 | ❌ Solo se migraron vacaciones; falta script de asistencia |
| I15 | **Cola offline + reintento** en el fichaje (localStorage) — §5.3 | ❌ /fichar no guarda si no hay red |
| I16 | Notificación "empleado no fichó" — §7 | ❌ (se suma a F3 automatizaciones) |
| I17 | Exportación real en Reportes — §6/§10.7 | Coincide con F4 (ya planificado) |

**Contrato de datos JSON del legado (§6):** informativo; Nexus consulta Supabase directo con RLS — no se replica el JSON, la lógica de horas vive en `lib/hours.ts`/Postgres. Los design tokens del traspaso §1 son idénticos a los ya usados en Nexus/v6 ✓ (misma familia de diseño: la fusión es estructural, no estética).

---

## Lista priorizada de problemas

| Prio | ID | Título | Esfuerzo |
|---|---|---|---|
| P0 | B1 | Zona horaria UTC (14 usos + schema + Edge Fn) | M |
| P0 | U1–U3 | Restaurar diseños v6 / checador con pestañas | M–L |
| P1 | B3 | Transición aprobada→en_progreso | S |
| P1 | B4+B5 | Validaciones/atomicidad en Postgres (saldo, anticipación, tarea única, rol) | M |
| P1 | B2 | Closure viejo en /fichar | S |
| P1 | S1 | `users_self_onboard` puede cambiar `role` | S |
| P2 | B6 | Enfriamiento anti doble-fichaje | S |
| P2 | C1–C7 | Des-duplicación + componentes | M |
| P2 | B7/D1–D4 | Limpieza de código muerto | S |
| P1 | I14 | Migrar 108 registros históricos de asistencia (Excel) | S |
| P2 | I15 | Cola offline + reintento en /fichar | M |
| P3 | I1–I13, I16, L1–L7 | Completar features + fusión del legado (según ROADMAP F1–F6) | L |
| P3 | B8 | Bug quotes (se corrige al portar diseño checador en U1) | S |

*Esfuerzo: S < 1 h · M = medio día · L = 1+ días.*
