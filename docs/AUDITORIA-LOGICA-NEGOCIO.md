# EMET · Auditoría de lógica de negocio — Asistencia, Eventos, Google Calendar

**Fecha:** 4 de agosto de 2026
**Alcance:** verificación punto por punto de un reporte de gaps/bugs contra el código real del repo. Cada hallazgo cita `archivo:línea`. Nada aquí es especulación — todo se leyó del código.

---

## Resumen ejecutivo

De 18 claims verificados: **4 eran falsos** (la función ya existía y funcionaba bien), **6 confirmados como bugs/gaps reales**, **8 parcialmente ciertos** (la base existe pero falta una pieza concreta).

**Ya corregido en esta sesión** (desplegado en producción):
- Bug de Google Calendar: los eventos sincronizados nunca aparecían en "Calendario de equipo" porque se escribían al calendario personal del admin en vez del calendario del equipo. Corregido en `supabase/functions/gcal-sync-event/index.ts` (edge function redesplegada) + texto de ayuda actualizado en el formulario.

**Dónde editar hoy** (respuesta directa a "no puedo editar horarios pasados / eventos / personas"):
- Corregir una marca de asistencia pasada → `/admin/asistencia`, botón **"Corregir"** en cada fila.
- Editar el horario base de un empleado → `/admin/config/horarios`, botón **"Editar"**.
- Editar un evento ya creado → `/admin/calendario`, click en el evento abre el mismo formulario de creación con los datos cargados (**sí existe**, contrario a lo que parecía).
- Editar "personas involucradas" en un evento → **no existe todavía**. El modelo de datos ya lo soporta (`event_participants`), pero no hay ninguna UI para asignar participantes a un evento. Ver §3.

Todo lo demás (Time Picker inteligente, check-in automático por evento, motor de prioridad con "Evento externo", movimientos manuales completos) es trabajo real pendiente — no se improvisó ninguna implementación a ciegas en esta sesión. Ver el roadmap priorizado al final.

---

## 1. Time picker de corrección de asistencia

**El componente actual (`src/components/scheduling/time-picker.tsx`) SÍ es un selector de hora real** — tres ruedas (hora 1-12 / minutos / AM-PM) con scroll-snap tipo iOS, no un selector de "mañana/tarde/noche". La confusión viene de que arriba de las ruedas hay chips de atajo rápido (`BANDS`: Mañana=6am, Tarde=12pm, Noche=6pm) — son solo atajos, no el mecanismo de selección.

Lo que sí falta, verificado contra `src/components/os/edit-attendance-sheet.tsx`:

| Requisito pedido | Estado |
|---|---|
| Elegir Entrada vs Salida | ✅ existe |
| Validar entrada < salida | ✅ existe (`esSalidaAntesEntrada`, líneas 33-40) |
| Auditoría (quién, cuándo, antes→después, motivo) | ✅ existe — tabla `attendance_corrections` (migración `0027`), campo `action` con formato `"Entrada: X → Y"` |
| Motivo obligatorio | ❌ es opcional (`<Field label="Motivo (opcional)">`, línea 165) |
| Restringir el rango del picker según la otra marca | ❌ no existe — el picker no recibe límites, solo se deshabilita el botón Guardar después |
| Sugerir hora según horario laboral del empleado | ❌ no existe — el picker no conoce `schedules.start_time`/`end_time` |
| Warning al cambiar AM/PM sin querer | ❌ no existe |

**Veredicto: parcialmente cierto.** No es necesario tirar el componente y crear `EmetTimePicker` desde cero como propone el reporte original — el motor de ruedas ya es sólido y reusable (lo usan también horarios, eventos, etc.). Lo que falta es lógica de *contexto* alrededor: pasarle límites (`minTime`/`maxTime` derivados de la otra marca del día), una sugerencia inicial, y un guard de confirmación al cruzar AM/PM. Ver roadmap P1.

---

## 2. Dónde se edita hoy

| Acción | Ruta | Notas |
|---|---|---|
| Corregir marca de asistencia pasada | `/admin/asistencia` → botón **Corregir** por fila | Visible siempre, no escondido |
| Editar horario base de un empleado | `/admin/config/horarios` → botón **Editar** | Cuelga de `/admin/config` |
| Horario temporal por rango de fechas | `/admin/config/horarios` → sección "Horarios temporales" → **Agregar** | |
| Editar evento ya creado | `/admin/calendario` → click en el evento | Abre el mismo Sheet que "crear", precargado |

Ninguna de estas rutas estaba realmente oculta — es un tema de descubribilidad, no de feature faltante.

---

## 3. Eventos institucionales

### Esquema real (migraciones 0008 → 0032)

**`institutional_events`**: `id, title, kind, start_date, end_date, notes, created_by, created_at, start_time, end_time, client_name, department_id (FK departments), location_type (interno/externo), location_name, location_address, location_coords, location_radius (default 150m), allow_any_location, owner_id (FK users), status, priority, description, sync_to_google, google_calendar_id`

**`event_participants`**: `event_id, user_id, role (responsable/participante), status (pendiente/confirmado/cancelado), notified_at` — único por `(event_id, user_id)`.

**`event_attendance`**: `event_id, user_id, check_in_at, check_out_at, check_in_location, check_in_coords, check_in_distance_m`.

**`event_history`**: `event_id, admin_id, action, details, created_at`.

Es decir: **el modelo de datos ya soporta casi todo lo que pide el reporte original** (departamento, cliente, ubicación interna/externa con dirección y radio GPS, responsable vs participantes, historial). El problema no es de base de datos, es que la UI no expone varias de estas columnas.

### Bugs confirmados

1. **Crear/editar SÍ existen** (contrario a lo que parecía) — `src/app/admin/calendario/client.tsx:203-233`, mismo Sheet para ambos casos.
2. **Bug real — "Departamento solicitante" es texto libre sobre una columna FK.** El input es un `<input type="text">` (`client.tsx:709-712`) pero `department_id` en la base es un UUID que referencia `departments(id)`. Guardar texto libre ahí falla o corrompe el dato. El resto de la app (ej. `/admin/empleados`) ya usa un `<Select>` real contra `departments` — el form de eventos debería usar el mismo componente.
3. **Bug real — el campo "Responsable" no se renderiza.** El estado `ownerId` existe y se manda al guardar (`client.tsx:251`), pero no hay ningún `<Select>`/`<input>` en el formulario que lo edite — siempre queda en `null` salvo que ya viniera de la base.
4. **Gap real — no existe UI para asignar participantes.** `event_participants` no se referencia en ningún archivo de `src/`. Consecuencia en cadena: el check-in de evento exige `status='confirmado'` como participante (migración `0030`), pero no hay forma de llegar a ese estado desde la UI — el Sheet de check-in solo puede mostrar "No estás asignado como participante", sin remedio.
5. **Gap real — `event_history` casi no se usa.** La tabla existe pero solo se llena desde los RPCs de check-in/check-out, no desde crear/editar/eliminar evento (esos usan la tabla genérica `admin_activity_log`, no específica del evento). Tampoco hay ninguna pantalla que lea `event_history`.

**Veredicto: el reporte tenía razón en el diagnóstico de fondo** (falta separar responsable/participantes con notificación y check-in individual) **pero se equivocaba en que "falta el modelo"** — el modelo ya está, es la capa de formulario la que quedó a medias.

---

## 4. Google Calendar

**Ya era bidireccional** (contrario a lo reportado): `gcal-sync-event` (EMET→Google, crea/actualiza/borra) + `gcal-webhook` (Google→EMET). Switch visible en el form (`client.tsx:768-802`).

**Bug real, ya corregido y desplegado:** el "Calendario de equipo" (`/admin/calendario` y `/comunicacion/calendario`) lee eventos de Google SOLO del calendario guardado en `app_settings.gcal_activity_calendar_id`. Pero cuando un admin activaba "Sincronizar con Google Calendar" y dejaba el campo "ID del calendario" vacío (que es justo lo que la ayuda del formulario sugería hacer), el evento se escribía en `"primary"` — el calendario **personal** de ese admin, no el del equipo. Resultado: el evento sí se sincronizaba a Google, pero a un calendario que nadie más leía.

**Fix aplicado:** `supabase/functions/gcal-sync-event/index.ts` ahora, cuando el evento no trae `google_calendar_id` explícito, usa como fallback el mismo `app_settings.gcal_activity_calendar_id` que ya lee el equipo — en vez de `"primary"`. Redesplegado (versión activa). Texto de ayuda del formulario actualizado para reflejarlo (`client.tsx`).

---

## 5. GPS / check-in por evento

- Radio configurable por evento (`location_radius`, default 150m) → ✅ ya existía.
- Flag "permitir check-in desde cualquier ubicación" (`allow_any_location`) → ✅ ya existía.
- **Gap real confirmado:** la pantalla normal de fichar (`src/components/os/jornada-watcher.tsx`) no tiene ninguna referencia a eventos — no detecta "tienes un evento hoy" ni ofrece "Iniciar cobertura" automáticamente. Ese flujo solo se puede disparar manualmente desde `/admin/calendario`. Este es el gap más grande de experiencia: el empleado en campo no tiene forma fácil de encontrar el botón de cobertura del evento.

---

## 6. Prioridad de estados de asistencia

Orden real hoy (`src/lib/domain/attendance/status.ts:149-192`, primer match gana):

1. Jornada abierta de días previos (pendiente cerrar)
2. **"Trabajando"** si hay marca de entrada abierta — esto va ANTES que vacaciones
3. Vacaciones
4. Incidente (permiso/incapacidad/comisión/home office — un solo tipo por día)
5. Día inhábil
6. Descanso
7. Sin marca → Falta injustificada / Fuera de horario

**Comparación con el orden propuesto** (Vacaciones→Permiso→Incapacidad→Día inhábil→Evento→Home Office→Oficina→Ausencia):
- Vacaciones antes que Permiso/Incapacidad antes que Día inhábil: ✅ coincide.
- **Diferencia real:** si alguien ficha estando de vacaciones aprobadas, gana "Trabajando" sobre "Vacaciones" — el orden propuesto por el usuario pone el trabajo casi al final, no primero.
- **"Evento externo" no existe como estado en este resolver** — el sistema de eventos vive completamente aparte; nada cruza "¿tiene un evento asignado hoy?" contra el estado de asistencia. Este es el gap real detrás de la preocupación del reporte original.

**Sobre "vacaciones sin fichar → Falta injustificada":** el resolver en sí lo maneja bien (la rama de vacaciones se evalúa antes de la de falta). Pero el **reporte semanal por correo** (`supabase/functions/weekly-attendance-report/index.ts:83-125`) **no usa este resolver ni cruza contra vacaciones** — calcula días trabajados solo desde la tabla `attendance`. Un empleado de vacaciones toda la semana sale con "0 días trabajados" sin ninguna etiqueta que lo explique. Efecto práctico igual de confuso aunque el texto literal "Falta injustificada" no aparezca ahí.

---

## 7. Movimiento manual / corrección de asistencia

Existe (`/admin/asistencia` → Corregir), pero:
- Solo cubre **entrada y salida del día** — no soporta entrada/salida de comida ni otros movimientos intermedios que el propio sistema sí genera cuando el empleado ficha normal.
- La tabla `attendance` no tiene columna `source`/`created_by`/`manual` — el rastro de "esto fue una corrección manual" vive solo en `attendance_corrections` (tabla aparte de auditoría), no en el registro mismo. Si alguien exporta `attendance` directo no distingue un fichaje real de uno corregido.

---

## 8. Reportes: colores por estado

- `/admin/asistencia` **sí usa badges de color** por estado (`estadoPill()`, `Pill tone`) — Vacaciones=morado, Incapacidad=rojo, Permiso=naranja, Home office=azul-acento, Falta=rojo. No es texto plano.
- `/admin/reportes` (dashboard agregado) usa color solo para estado de *solicitud* (aprobada/cancelada/etc.), no para el estado diario de asistencia — ahí sí sería una mejora real agregar el mismo esquema de color.
- No existe color para "evento" porque, como en §6, ese estado no existe todavía en el resolver.

---

## Roadmap priorizado

### P0 — ya hecho esta sesión
- [x] Fix Google Calendar: eventos ahora escriben al calendario del equipo por defecto.

### P1 — acotado, alto impacto, se puede planear e implementar directo
- [ ] Motivo obligatorio en corrección de hora + warning al cruzar AM/PM en `edit-attendance-sheet.tsx`.
- [ ] Pasarle al `TimePicker` límites derivados de la otra marca del día (no permitir seleccionar fuera de rango, en vez de solo bloquear el botón después).
- [ ] Arreglar el campo "Departamento solicitante" del form de eventos: de `<input>` texto libre a `<Select>` contra `departments` real.
- [ ] Agregar el `<Select>` de "Responsable" que falta en el form de eventos (el campo ya se guarda, solo falta el input).
- [ ] Reporte semanal por correo: cruzar contra `vacations`/`incidents` antes de calcular "días trabajados".

### P2 — requiere diseño de UI nueva, más trabajo
- [ ] UI para asignar/gestionar participantes de un evento (`event_participants`) — desbloquea el check-in individual que ya existe a nivel de RPC.
- [ ] Escribir a `event_history` desde crear/editar/eliminar evento (no solo desde check-in), + pantalla para verlo.
- [ ] Detección automática de "tienes evento hoy" en `jornada-watcher.tsx` con botón "Iniciar cobertura" — el gap de experiencia más grande reportado.
- [ ] Estado "Evento externo" real dentro del resolver de asistencia (`status.ts`), cruzando `event_attendance` del día.
- [ ] Ampliar corrección manual a todos los tipos de movimiento (comida, etc.) + columna `source` en `attendance` para distinguir manual vs real.
- [ ] Colores de estado también en `/admin/reportes`.

### P3 — decisión de producto, no solo código
- [ ] Reordenar prioridad real: ¿"Trabajando" debe ganarle a "Vacaciones" si alguien ficha por error estando de vacaciones? (hoy sí le gana). Definir la regla de negocio antes de tocar el resolver.

---

## Investigación: librerías de componentes — qué adoptar para EMET

Contexto: EMET ya tiene un design system propio maduro (tokens `--surface/--text/--accent/--shadow-*`, componentes base en `src/components/ui.tsx`, `select.tsx`, `overlay.tsx`, Wheel picker propio). La recomendación general es **copiar patrones/mecánica, no instalar las librerías completas** — mismo criterio que ya se usó con el chat (tokens propios, sin dependencias nuevas de runtime).

### [shadcn/ui](https://ui.shadcn.com/)
Modelo "copy-paste", no es una dependencia de npm — se copia el código fuente del componente a tu repo. Esto encaja perfecto con cómo ya está construido EMET (componentes propios en `src/components/`). Está construido sobre Radix + Tailwind.
**Qué adoptar:** el patrón de composición (`Dialog.Root/Trigger/Content`) para los Sheets/overlays — hoy `overlay.tsx` es más monolítico. También su Combobox (búsqueda + selección) sería útil para el `<Select>` de departamentos que hace falta en eventos (§3).
**Cómo adaptar:** copiar solo la lógica de accesibilidad/estado del componente, reescribir el JSX con las clases y tokens de EMET (`var(--surface)`, `var(--border)`, etc.) en vez de sus clases Tailwind por defecto.

### [Aceternity UI](https://ui.aceternity.com/)
87 componentes, enfocados en efectos visuales llamativos (aurora backgrounds, 3D cards, bento grids, timelines) con Framer Motion/Motion. Pensado para landing pages y marketing, no para UI de producto/dashboard.
**Qué adoptar (con moderación):** el "Bento Grid" para el dashboard de Inicio/Reportes, y el patrón de "Timeline" — encajaría bien para mostrar el historial de cambios de un evento (`event_history`, gap de §3) o el historial de corrección de asistencia.
**Qué NO adoptar:** los efectos decorativos (aurora, beams, 3D pin, globe) — no son el lenguaje visual de EMET (frío/plano tipo Signal, según la dirección ya definida para el chat) y añadirían peso/ruido.

### [Magic UI](https://magicui.design/)
150+ componentes, mismo espíritu copy-paste que shadcn, con más foco en micro-interacciones (marquee, number ticker, animated lists, shimmer buttons) que en efectos 3D pesados.
**Qué adoptar:** el "Number Ticker" (animación de conteo) para las métricas del dashboard (ej. horas trabajadas, empleados presentes hoy) — bajo costo, alto impacto percibido. También su patrón de "Animated List" para notificaciones/actividad reciente.
**Cómo adaptar:** reemplazar sus colores hardcoded por los tokens de EMET; ya usan Tailwind + Motion, compatible con el stack actual.

### Origin UI
Nota: el dominio pedido (`originui-ng.com`) no existe — el proyecto real es **[originui.com](https://originui.com)** (repo `origin-space/originui` en GitHub). Colección grande (cientos) de componentes de formulario/input muy detallados: password inputs con medidor de fuerza, inputs con contador de caracteres, selects con búsqueda, date pickers, file uploads con preview.
**Qué adoptar:** sus patrones de input de formulario (validación inline, estados de error/éxito) para endurecer los forms de EMET que hoy son básicos (ej. el form de eventos de §3). Su file-upload con preview también sirve para adjuntos del chat o evidencias de incidentes.

### [Radix UI](https://www.radix-ui.com/)
La base sin estilo debajo de shadcn/ui y buena parte del ecosistema — primitivos accesibles (WAI-ARIA) para Dialog, Dropdown, Popover, Tooltip, Select, etc., sin ningún estilo propio.
**Qué adoptar:** si en algún punto se decide dejar de reinventar overlays/menús a mano (`overlay.tsx`, `Menu`/`MenuItem` en `ui.tsx`) y se quiere accesibilidad de teclado robusta gratis (focus trap, escape, aria-*), Radix es la base correcta para migrar sin perder el look de EMET — se sigue estilizando 100% con los tokens actuales, Radix solo aporta el comportamiento.
**Prioridad:** baja por ahora — los componentes propios de EMET ya funcionan; esto es una inversión a futuro si la superficie de overlays crece mucho más (más Sheets, más menús anidados) y empiezan a aparecer bugs de foco/teclado.

### Recomendación general
No instalar ninguna de las cinco como dependencia. Extraer 1-2 patrones concretos por librería según la necesidad real (arriba), copiar el código, adaptarlo a los tokens `--*` de EMET. Esto mantiene cero dependencias nuevas de runtime — mismo criterio que ya rige todo el repo.
