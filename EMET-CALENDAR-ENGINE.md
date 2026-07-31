# EMET Calendar Engine — Design & Logic Spec v1.0

> **Fuente de verdad del módulo de Calendario de EMET.**
> Inspirado en el análisis profundo de **Cal.com / cal.diy** (repo clonado y auditado),
> **Linear**, **Apple Calendar**, **Notion Calendar** y las **apps fitness** — pero con
> identidad propia: un **Centro de Tiempo** para la organización, no una cuadrícula.
>
> Cualquier pantalla nueva de EMET que muestre tiempo (vacaciones, días inhábiles,
> actividades, solicitudes, asistencia, cumpleaños, integraciones de Google) debe
> salir de este motor. Si no sale de aquí, es un bug de arquitectura, no un tema.

---

## 0. Por qué existe este documento

EMET hoy tiene **más de 5 calendarios diferentes**, cada uno con reglas visuales
propias:

| Pantalla actual | Ruta | Problema |
|---|---|---|
| Calendario del equipo | `/admin/calendario` | Tabs propias, rejilla propia, eventos tipo botón |
| Mi calendario | `/comunicacion/calendario` | Otra rejilla, otra navegación |
| Días inhábiles | `/admin/dias-inhabiles` | Otro calendario grande con su propio header |
| Date Picker / Range | `src/components/date-sheet.tsx` | `CalendarGrid` propio (este SÍ es un buen comienzo) |
| Vacaciones (admin + empleado) | `/admin/vacaciones`, `/comunicacion/vacaciones` | `DateRangeCalendar` reutiliza el grid pero con cáscaras distintas |
| Calendario "Hoy" del empleado | `/os` | Tira semanal distinta |

El usuario aprende la interfaz cada vez que cambia de módulo. Eso rompe el Design
System y hace que EMET se sienta como 5 productos en vez de uno.

**Decisión:** construir un **Calendar Engine único** — un motor de tiempo del que
salen todas las vistas y todos los módulos. Únicamente cambia la *información* que
muestra, nunca la *lógica* ni la *geometría*.

---

## 1. Filosofía: el Centro de Tiempo

Las apps premium no están diseñadas alrededor del calendario.
Están diseñadas alrededor del **tiempo**.

> No ves una cuadrícula. Sientes que estás navegando tu día, tu semana y tu organización.

EMET adopta ese enfoque:

- El calendario es **una herramienta**, no el protagonista.
- El protagonista es **el tiempo de la organización**: quién está, quién viene,
  qué se entrega, qué se celebra.
- El panel derecho es un **asistente de tiempo** (hoy, próximos, pendientes),
  no otro calendario.
- Mobile primero muestra **la agenda del día**, no la cuadrícula.

### Los 7 principios

1. **Un solo motor.** Nunca dos calendarios, nunca dos date pickers, nunca dos radios.
2. **Aire primero.** Mucho espacio, tipografía grande, eventos pequeños, mucho margen.
3. **Capas, no cajas.** Fondo → glass sutil → panel → calendario → evento → popover.
   Profundidad por jerarquía, no por bordes.
4. **El azul es acción, no decoración.** `--accent` solo para: hoy, selección,
   botón principal y hover. Todo lo demás en neutros.
5. **Los eventos son líneas, no botones.** Una línea de color + texto. En mes:
   puntos indicadores, no tarjetas.
6. **El tiempo se lee, no se llena.** La agenda es editorial: horas con aire,
   separadores suaves, cumpleaños como dato humano.
7. **Mobile-first de verdad.** No desktop reducido. Pantalla móvil propia por
   defecto, cuadrícula opcional al tocar "Mes".

---

## 2. Estado actual de EMET (lo que ya existe y se aprovecha)

Antes de proponer nada nuevo, lo que YA existe y no se toca:

- **Tokens de diseño sólidos** (`globals.css`): `--surface`, `--surface-2`, `--surface-3`,
  `--accent #0066FF` (claro) / `#0A84FF` (oscuro), `--accent-tint`, `--radius-l 22px`,
  `--radius-m 16px`, `--radius-s 11px`, `--border`, `--border-2`, `--text-1/2/3`,
  `--shadow-1/2`, `--spring`, `--ease`, `--ok`, `--warn`, `--danger`, `--purple` y sus `-tint`.
- **`lib/tz.ts`**: fuente única de verdad para `America/Merida`. Prohibido `new Date().toISOString()`.
  Se extiende con helpers de rango/semana (ver §5).
- **`lib/calendar-grid.ts`**: `buildMonthGrid()` (Lun–Dom) ya correcto. Pasa al motor.
- **`lib/persisted-view.ts`**: persistencia de vista/granularidad por usuario.
  Pasa al motor como `useCalendarPreference`.
- **`components/ui.tsx`**: `Avatar`, `Sheet`, `Menu`, `SlidingSegments`, `Pill`, `Toast`.
  El motor los consume; no los duplica.
- **`components/date-sheet.tsx`**: `CalendarGrid` — la semilla del motor.
- **`lib/ui-maps.ts`**: `holidayStyle`, `institutionalStyle` — los mapas de color
  existentes pasan a la paleta semántica (§7) sin romper a sus consumidores.
- **Integración Google Calendar** ya funcional: Edge Functions `gcal-*`
  (`gcal-list-events`, `gcal-delete-event`, `gcal-create-event`…). Se conserva.

---

## 3. Arquitectura del motor

### 3.1 Estructura de carpetas

```
src/components/calendar/               ← NUEVO (el motor)
  engine.tsx                            ← <CalendarEngine> raíz: contexto + store
  store.ts                              ← estado (vista, fechas, preferencias)
  types.ts                              ← CalendarEvent, CalendarSource, ViewType
  grid.ts                               ← helpers de rejilla (heredados de calendar-grid.ts)
  logic/
    overlap.ts                          ← algoritmo de solapamiento (de cal.diy)
    slots.ts                            ← cálculo de franjas disponibles (de cal.diy)
    ranges.ts                           ← merge de rangos (de cal.diy)
    week.ts                             ← semana según preferencia del usuario
  views/
    agenda.tsx
    day.tsx
    week.tsx
    month.tsx
    year.tsx                            ← heatmap
  parts/
    header.tsx
    month-grid.tsx
    day-column.tsx
    time-gutter.tsx
    now-line.tsx
    event.tsx
    event-popover.tsx
    legend.tsx
    filter-bar.tsx
    mini-calendar.tsx
    date-picker.tsx
    empty-state.tsx
    skeleton.tsx
  side/
    right-panel.tsx                     ← asistente de tiempo
  data/
    use-calendar-data.ts                ← hook que fusiona todas las fuentes
```

### 3.2 Modelo de datos (un solo tipo de evento)

```ts
type CalendarEventKind =
  | "vacacion" | "permiso" | "incapacidad" | "home_office" | "comision"
  | "evento_institucional" | "cumpleanos" | "inhabil" | "actividad"
  | "proyecto" | "asistencia" | "google" | "recordatorio" | "disponibilidad";

interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  start: string;            // ISO "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm"
  end: string;
  allDay: boolean;
  user?: { id: string; display_name: string; nexus_color: string | null; avatar_url?: string | null };
  location?: string | null;
  notes?: string | null;
  status?: "confirmado" | "pendiente" | "cancelado";
  source: "db" | "google" | "computado";   // computado = cumpleaños, días inhábiles
  meta?: Record<string, unknown>;           // ids originales, calendarId google, etc.
}
```

Toda fuente de datos se normaliza a este tipo antes de entrar al motor. El motor
**no conoce** tablas de Supabase ni APIs de Google: recibe `CalendarEvent[]`.

### 3.3 Fuentes de datos (orquestador `use-calendar-data.ts`)

| Fuente | Tabla / Origen | Cómo llega al motor |
|---|---|---|
| Vacaciones | `vacations` | server → normalizado |
| Permisos/Incapacidades | `incidents` | server → normalizado |
| Días inhábiles | `holidays` | server → normalizado (kind `inhabil`) |
| Eventos institucionales | `institutional_events` | server → normalizado |
| Cumpleaños | `users.birth_date` | **computado** en el server (mes/día, sin año) |
| Actividades | `requests` / `projects` (deadlines) | server → normalizado |
| Asistencia | `attendance` | server → normalizado (kind `asistencia`) |
| Google Calendar | Edge Functions `gcal-*` | server → normalizado (kind `google`) |
| Disponibilidad (futuro) | `schedules` | server → normalizado |

**Regla:** el server component de cada página construye `CalendarEvent[]` y lo pasa
al `CalendarEngine`. El cliente nunca consulta la BD directamente para el calendario.

---

## 4. Store del motor (estado)

Patrón tomado de cal.diy (`packages/features/calendars/weeklyview/state/store.ts`):
**un store Zustand por instancia**, creado con `useRef` + proveído por contexto.

```ts
interface CalendarState {
  view: ViewType;                 // "agenda" | "day" | "week" | "month" | "year"
  cursor: string;                 // fecha activa ISO (YYYY-MM-DD)
  weekStart: 0 | 1;               // preferencia domingo/lunes
  startHour: number;              // default 7
  endHour: number;                // default 20
  gridCellsPerHour: number;       // 4 (15 min) — desde settings de la vista
  sources: CalendarSource[];      // filtros activos (vacaciones, eventos, google…)
  events: CalendarEvent[];
  selectedEventId: string | null;
  focusedDate: string | null;
  scrollToNow: boolean;
  // acciones
  setView, setCursor, setSources, selectEvent, setFocusedDate, ...
}
```

- `initState(props)` hace **merge parcial** (solo actualiza campos presentes) —
  misma convención que cal.diy.
- `view`, `cursor` y `sources` se persisten con `useCalendarPreference`
  (wrapper de `lib/persisted-view.ts`).
- En escritorio, `cursor`/`view` pueden vivivir en el **query string**
  (`?v=month&d=2026-08-31`, patrón nuqs de cal.diy) → enlaces compartibles y
  back/forward funcional.

---

## 5. Lógica de fechas (el corazón)

Todo aritmético hereda de `lib/tz.ts` (zona `America/Merida`, jamás UTC para "hoy").

### 5.1 Núcleo (nuevo `src/lib/calendar-core.ts`)

```ts
export function shiftMonth(ym: string, delta: number): string;   // ya existe en calendar-grid
export function monthBounds(ym: string): { year, month, daysInMonth, first, last };
export function buildMonthGrid(first, last, daysInMonth);        // Lun–Dom, ya existe
export function monthStartOf(isoDate: string): string;
export function weekRangeFor(date: string, weekStart: 0|1): { start, end }; // fórmula cal.diy
export function daysInRange(start, end): string[];               // ISO one-per-line
export function addMonthsISO(iso: string, n: number): string;
export function yearRange(year: number): { first, last };
export function isInRange(iso, start, end): boolean;
```

`weekRangeFor` usa la fórmula de cal.diy (`apps/web/modules/bookings/lib/weekUtils.ts`):

```ts
const diff = (currentDay - weekStart + 7) % 7;   // start = date - diff
```

### 5.2 Solapamiento de eventos — `logic/overlap.ts`

**Portar el algoritmo de cal.diy** (`packages/features/calendars/weeklyview/utils/overlap.ts`),
la parte más compleja del calendario y ya resuelta ahí:

- Agrupa eventos por solapamiento temporal (`start < end` del grupo).
- Asigna columnas; los anchos **no son iguales**: con 2 eventos → 80%/50%,
  con 3 → 55%/33%, con 4+ → curva exponencial (`groupSize / (groupSize+1)`,
  `exponent = 1.3`, `minWidth = 25%`, `baseZIndex = 60`).
- Los eventos que empiezan después "empujan" a los anteriores.
- Se usa en vistas **day**, **week** y **agenda**.

### 5.3 Franjas / slots — `logic/slots.ts` (futuro: reservas)

Portar `getCorrectedSlotStartTime` de cal.diy:

- Intervalo base: el mayor divisor de la duración entre `[60, 30, 20, 15, 10, 5]`.
- Normalizar segundos/ms a 0.
- **Convertir a la zona del usuario ANTES de redondear** (evita el bug GMT+5:30).
- Alinear a inicio de hora → 15 min → 5 min solo si sobran minutos.
- Evitar duplicados con `Map` + `slotBoundaries`.

### 5.4 Rango horario configurable

`startHour` / `endHour` / `gridCellsPerHour` por vista (defaults: 7–20, celdas de
15 min). En agenda móvil: franja completa 0–23 con salto a la hora del día actual.

### 5.5 Línea de "ahora"

- `now-line.tsx`: minutos desde `startHour` × `px por minuto`
  (CSS var `--one-minute-height: calc(58px/60)`, altura de hora 58px, de cal.diy).
- Auto-scroll al montar (`scrollToCurrentTime`), refresco al ganar foco
  (`updateOnFocus`), oculta si la hora actual está fuera de rango.
- Rojo sutil con punto blanco en el borde (estilo Apple).

### 5.6 Cumpleaños

Computados en el server: para cada `users.birth_date`, generar el evento del
**mes/día de este año** (usar `nextAnniversary()` ya existente en `lib/tz.ts`).
Siempre `allDay`, kind `cumpleanos`, sin hora. Nacimiento 29-feb → 28-feb en años no bisiestos.

---

## 6. Layout

### 6.1 Escritorio — tres columnas (workspace, estilo Linear + Cal.com + chat de EMET)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Calendarios         Julio 2026        ← Hoy →        [Mes▾]   [+ Crear] │  ← header compacto
├─────────────┬───────────────────────────────────────────┬──────────────┤
│  Calendarios │                                           │  Hoy         │
│  (fuentes y  │              CALENDARIO                   │  ─────       │
│   filtros)   │         (día/semana/mes/año)              │  09:00 …     │
│              │                                           │  11:00 …     │
│  · Vacaciones│                                           │  ─────       │
│  · Eventos   │                                           │  Próximos    │
│  · Google    │                                           │  ─────       │
│  · Cumpleaños│                                           │  Mañana …    │
│              │                                           │  ─────       │
│  [Mini mes]  │                                           │  Cumpleaños  │
├─────────────┴───────────────────────────────────────────┴──────────────┤
```

- **Columna 1 (≈240px)**: fuentes con checkbox (toggle de capas), mini-calendario.
- **Columna central**: la vista activa. **Único lugar con scroll.**
- **Columna 3 (≈300px)**: *asistente de tiempo* — siempre visible, cambia de contenido
  según la selección. Hoy / Próximos / Pendientes / Cumpleaños / Vacaciones.
- Sidebar y panel derecho se colapsan a pedido (`[←]`), dejando el calendario
  a pantalla completa.

### 6.2 Mobile — agenda primero, cuadrícula opcional

```
┌──────────────────────────────────────────┐
│  Julio                    ⚙️              │
│  Viernes 31                [+ Crear]      │  ← header limpio, un solo nivel
├──────────────────────────────────────────┤
│  L   M   M   J   V   S   D               │
│  27  28  29  30  31  1   2               │  ← tira horizontal (patrón fitness)
│              ●                           │     hoy centrado automáticamente
├──────────────────────────────────────────┤
│  09:00                                    │
│  ── Planeación semanal                    │
│                                          │
│  11:00                                    │
│  ── Vacaciones · Angélica                │  ← agenda del día (editorial)
│                                          │
│  14:00                                    │
│  ── Reunión Dirección                     │
│                                          │
│  🎂 Cumpleaños · Samuel                  │
├──────────────────────────────────────────┤
│  Próximos eventos  →                     │  ← enlaces horizontales
└──────────────────────────────────────────┘
```

Tocar **"Mes"** abre la cuadrícula completa. Tocar una celda vuelve a la agenda.
El día actual queda centrado en la tira. La tira es clicable → lleva al día.

---

## 7. Paleta semántica de eventos

El azul deja de ser el color de todo. Cada tipo de tiempo tiene su color
(con su `-tint` para fondos, mismas convenciones que `--accent-tint`).

| Kind | Color | Token nuevo (light) | Uso |
|---|---|---|---|
| `evento_institucional` / `actividad` / `proyecto` | Azul | `--ev-blue #0066FF` | Trabajo |
| `vacacion` | Morado | `--ev-purple #AF52DE` | Descanso |
| `disponibilidad` | Verde | `--ev-green #30D158` | Libre |
| `permiso` / `incapacidad` / `home_office` / `comision` / ausencia | Rojo | `--ev-red #FF3B30` | Ausencia |
| `recordatorio` / `pendiente` | Naranja | `--ev-orange #FF8A00` | Atención |
| `cumpleanos` | Amarillo | `--ev-yellow #FFD60A` | Celebración |
| `inhabil` | Gris | `--ev-gray #8E8E93` | No laborable |
| `google` | Se hereda del calendario externo | — | Sincronizado |

**Variantes oscuras** (mismas reglas que el tema actual):

| Token light | Token dark |
|---|---|
| `--ev-blue #0066FF` | `#0A84FF` |
| `--ev-purple #AF52DE` | `#BF5AF2` |
| `--ev-green #30D158` | `#32D74B` |
| `--ev-red #FF3B30` | `#FF453A` |
| `--ev-orange #FF8A00` | `#FF9F0A` |
| `--ev-yellow #FFD60A` | `#FFD60A` |
| `--ev-gray #8E8E93` | `#8E8E93` |

- Cada `--ev-*` tiene su `--ev-*-tint` (alpha 0.12–0.16) para fondos de píldora,
  selección y rejillas.
- Los tokens se declaran en `globals.css` junto a los existentes y **se mapean** a
  la salida actual de `lib/ui-maps.ts` (holidays, institucionales) para no romper
  nada que ya consuma esos mapas.

### Contraste WCAG

Todo color de evento definido por usuario (color por tipo de actividad futura)
debe validarse con la misma función que usa cal.diy: `checkWCAGContrastColor("#ffffff" | "#101010", hex)`.
Si falla → `Alert severity="warning"` y se bloquea el guardado.

---

## 8. Vista por vista

### 8.1 Agenda (`agenda.tsx`) — vista por defecto en móvil

- Lista editorial: hora en columna estrecha (`text-subtle`), línea separadora
  sutil `───`, título semibold.
- Eventos de todo el día y cumpleaños arriba, sin hora.
- Agrupa por **Hoy / Mañana / Esta semana / Después**.
- Click en un día → `day`; click en un evento → `event-popover`.

### 8.2 Día (`day.tsx`)

- Gutter de horas (7–20, configurable) + línea roja de "ahora".
- Eventos como **líneas de color** (`border-left` grueso, fondo `-tint` 8–10%),
  layout de solapamiento (§5.2).
- Click en hueco → crear (abre el creador del tipo de la capa activa).
- Toque de hueco en móvil → primer selector de hora.

### 8.3 Semana (`week.tsx`)

- 7 columnas, horas en gutter, línea de ahora, solapamiento igual que día.
- Header de días sticky con `--calendar-dates-sticky-offset` (patrón cal.diy).
- Fondo de cuadrícula con patrón de cuaderno sutil
  (`repeating-linear-gradient(-45deg)` a 5px, apagable) — solo en esta vista.
- Altura de hora 58px (constante `hourSize`, de cal.diy).

### 8.4 Mes (`month.tsx`) — la cuadrícula

- Celda mínima: número de día arriba + **puntos indicadores** (hasta 3) +
  "+n" discreto. **Nunca tarjetas gigantes dentro de la celda.**
- Hoy: círculo `--accent` con texto blanco (la ÚNICA píldora).
- Día seleccionado: fondo `--accent-tint` con número `--accent`.
- Días de otros meses: texto `--text-3`.
- Hover de celda: `--surface-2`.
- Click en "+n" → abre el popover con la lista completa del día.
- Evento arrastrado sobre la celda → vista previa de línea.

### 8.5 Año (`year.tsx`) — heatmap (GitHub-style)

- 12 mini-meses NO. Un **heatmap de 12 meses** donde la intensidad del color
  es la carga del día: 0 = celda neutra, más eventos = más saturación.
- Color por tipo de carga dominante (vacaciones → morado, actividad → azul…).
- Hover → tooltip con resumen ("12 jul · 3 eventos · 1 vacación").
- Click → salta al mes. Click derecho/doble → salta al día.
- En un vistazo se ven temporadas, vacaciones y periodos muertos.

### 8.6 Mini-calendario (sidebar)

- Rejilla del mes actual con punto en días con eventos (color de la capa).
- Click → navega la vista central. Arrow keys + Enter navegable por teclado.

---

## 9. Componentes del motor

| Componente | Descripción | Radios / medidas |
|---|---|---|
| `CalendarEngine` | Raíz: contexto + store + layout 3 columnas | — |
| `CalendarHeader` | Mes+año, `← Hoy →`, selector de vista, crear | botones 32px |
| `CalendarGrid` | Rejilla mensual (hereda `date-sheet.tsx`) | celdas `--radius-s` |
| `CalendarDayCell` | Celda de mes | padding 6px |
| `CalendarWeek` | Fila de días (header + grid) | — |
| `CalendarAgenda` | Lista editorial | items `--radius-m` |
| `CalendarSidebar` | Fuentes + mini-mes | panel 240px |
| `CalendarFilters` | Toggles de capas + chips | chips 999px |
| `CalendarMini` | Mini-mes de navegación | — |
| `CalendarEvent` | Línea de evento | `--radius-s`, borde izq 3px |
| `CalendarEventPopover` | Detalle al tocar | popover `--radius-l`, 320px |
| `CalendarLegend` | Leyenda de colores | chips 999px |
| `CalendarNavigation` | Flechas + hoy | botones 32px cuadrados |
| `CalendarToolbar` | Vista + filtros + acción | — |
| `CalendarDatePicker` | Único picker de la app | popover `--radius-l` |
| `CalendarEmptyState` | Estado vacío contextual | — |
| `CalendarLoadingState` | Skeleton | — |
| `CalendarRightPanel` | Asistente de tiempo | panel 300px |

### Reglas duras

- **Prohibido** crear un calendario/date-picker nuevo fuera de `components/calendar/`.
- `date-sheet.tsx` y `calendar-grid.ts` **se mueven** al motor (compat shim para
  no romper imports) o el motor los re-exporta.
- Todos los componentes leen **solo tokens** — jamás colores hardcodeados por archivo.

---

## 10. Estados

| Estado | Comportamiento |
|---|---|
| `hover` (evento) | Eleva 1px (`--shadow-1`), fondo `-tint` al 12% |
| `hover` (celda) | `--surface-2` |
| `pressed` | `scale(0.98)` en botones, `scale(0.96)` en eventos |
| `selected` (evento) | Anillo `--accent` 2px + sombra; abre popover |
| `selected` (día) | `--accent-tint` + número `--accent` |
| `disabled` | `--text-3`, sin pointer |
| `loading` | Skeleton: rectángulos `--surface-2` pulso 1.4s (bloque cal.diy) |
| `empty` | Estado vacío contextual (§11) |
| `focus-visible` | `outline 2px var(--accent)`, offset 2px (ya existe en globals) |

### 10.1 Skeletons (patrón cal.diy `AvailableTimesSkeleton`)

- Rejilla de skeleton con **duración aleatoria** entre 1–6 bloques por vista.
- `animate-pulse` con fondo `--surface-3`.
- Nunca un spinner central gigante; la estructura permanece visible.

---

## 11. Estados vacíos (contextuales, no genéricos)

Nunca "ícono + texto" repetido. Cada vacío sugiere la siguiente acción:

| Contexto | Copy | Acción |
|---|---|---|
| Sin eventos hoy | "Tu día está libre." | [Ver semana] [Crear evento] |
| Sin vacaciones | "Nadie está de vacaciones." | [Ver próximos] |
| Sin filtros activos | "Activa al menos una capa para ver tu tiempo." | [Activar todo] |
| Sin eventos en el mes | "Un mes tranquilo." | [Crear evento] [Ver agenda] |
| Sin Google conectado | "Conecta tu Google Calendar." | [Conectar] |

---

## 12. Date Picker único (componente global)

Reemplaza el patrón nativo de `<input type="date">` y unifica `DateField`,
`DateRangeField`, `DatePicker` y `DateRangeCalendar` del motor:

```
┌──────────────────────────┐
│  Hoy    Mañana           │  ← atajos (chips)
│  Próxima semana          │
│  Próximo mes             │
├──────────────────────────┤
│      Julio 2026   < >    │
│  L M M J V S D           │
│  · · · · · · ·           │  ← rejilla del motor
│  · · · · · · ·           │
│  · · ● · · · ·           │  ← selección con --accent
└──────────────────────────┘
```

- Popover en escritorio, bottom-sheet en móvil (ya lo hace `date-sheet.tsx`).
- Rango: arrastrar sobre dos días (ya resuelto en `CalendarGrid`).
- Se usa en: solicitudes, vacaciones, días inhábiles, filtros, creadores.
- Teclado: flechas para navegar, Enter para elegir, Esc para cerrar.

---

## 13. Panel derecho — asistente de tiempo

Nunca otro calendario. Es una **lectura editorial** del día seleccionado:

```
Hoy
─────
09:00   Planeación semanal
11:00   🎂 Cumpleaños · Samu
14:00   Vacaciones · Angélica   (morado)
18:00   Fin de jornada

Próximos
─────
Mañana  Entrega lona Ciencia
Vie     Reunión Dirección

Pendientes
─────
2 solicitudes sin aprobar   [Ir]

Disponibilidad (futuro)
─────
Vie 7   10:00–12:00
```

- Si hay un evento seleccionado → el panel muestra su detalle completo
  (título, horario, participantes, lugar, notas, acciones: editar/eliminar/Google).
- En móvil el panel derecho **no existe**: el detalle abre como Sheet.

---

## 14. Navegación y header (compacto)

Una sola barra para todas las vistas. Nada de tabs dobles.

```
[←] [Hoy] [→]   Julio 2026        [Agenda|Día|Semana|Mes|Año]   [+ Crear]
```

- Flechas: prev/next según la vista (mes ←→ mes, semana ←→ semana…).
- "Hoy": regresa al día actual sin cambiar de vista.
- Selector de vista: `SlidingSegments` (ya existe, con spring real) — 5 opciones.
- "Crear": abre el creador del **tipo dominante de la capa activa**.
- Botones de 32px, cuadrados, `--radius-s`. Nada de botones de 60px.
- En móvil: solo `← Hoy →` + título + crear. La vista vive en la tira de días.

---

## 15. Filtros (capas)

- Cada fuente es una **capa** con su color. Toggle por capa en la columna 1.
- Los filtros se persisten (`useCalendarPreference`) y se reflejan en el URL.
- `[Todos] [Ninguno]` para reset rápido.
- Al ocultar una capa, sus eventos y sus colores de leyenda desaparecen juntos.
- Buscador de eventos (futuro): filtra por título + participante, mismo motor.

---

## 16. Animaciones (concisas)

| Movimiento | Duración | Easing |
|---|---|---|
| Cambio de vista | 220ms cross-fade + slide 8px | `--ease` |
| Popover abrir/cerrar | 160ms fade + scale 0.98→1 | `--ease` |
| Arrastrar evento | 80ms follow | lineal |
| Ahora-line avance | 1s/franja | lineal |
| Crear evento | 240ms slide-up del creador | `--spring` |
| Toast | 450ms | `--spring` (ya existe) |
| Hover elevación | 180ms | `--ease` |

- Respetar `prefers-reduced-motion`: reducir a fades sin slide.
- Jamás animar `width`/`height` de layout (solo `transform` + `opacity`) — excepto
  la transición de grids del Booker de cal.diy que se porta con cuidado.

---

## 17. Responsive

| Breakpoint | Comportamiento |
|---|---|
| `< 768px` | Agenda por defecto; panel derecho y columna 1 ocultos; detalle en Sheet; tira de días |
| `768–1180px` | Columna 1 oculta (mini-mes dentro de un menú); calendario + panel derecho |
| `> 1180px` | Tres columnas completas |

---

## 18. Accesibilidad

- Toda celda/día navegable por teclado (flechas, Enter, Esc).
- `aria-pressed` en toggles de capa; `aria-current="date"` en el día de hoy.
- Popover: `role="dialog"`, `aria-modal`, foco atrapado, cierre con Esc.
- Contraste AA en todos los textos sobre `--ev-*-tint`.
- Título de la página: `Mes de julio de 2026 — Calendario EMET`.
- Anuncio de cambio de mes/vista con `aria-live="polite"`.
- Las líneas de evento mantienen el texto legible incluso a 58px de alto mínimo.

---

## 19. Integraciones externas

### Google Calendar (ya implementado, se conserva)

- Lectura: `gcal-list-events` → normalizado a `kind: "google"`, color heredado
  del calendario de origen (token `--ev-blue` como fallback).
- Creación/borrado: Edge Functions existentes, mismas reglas de permiso.
- Panel de integraciones (columna 1, futuro):
  ```
  Google Calendar   Sincronizado   [Desconectar]
  Outlook           No conectado   [Conectar]
  Apple Calendar    No conectado   [Conectar]
  ```
- Estado de conexión se guarda en `app_settings` (tabla ya creada en 0018).

### Outlook / Apple (futuro)

- Mismo patrón: nueva Edge Function + adaptador que devuelve `CalendarEvent[]`.
- Nunca tocar el motor para agregar un proveedor; solo agregar un adaptador.

### Cal.diy (referencia)

- **No** se instala cal.diy como app (requiere Node 18 + Prisma + su propia BD).
  EMET toma de él **patrones y algoritmos**: store por instancia, overlap,
  slots, hora-line, stickies del header, skeletons, contrast WCAG, semana por
  preferencia, estado en URL. Todo citado en este documento.

---

## 20. Plan de implementación por fases

### Fase A — Base del motor (hito 1)
1. `src/lib/calendar-core.ts` (helpers de rango/semana/año).
2. `components/calendar/types.ts` + `store.ts` + `engine.tsx` (contexto + layout 3 columnas).
3. `parts/header.tsx` + `navigation` + `SlidingSegments` de 5 vistas.
4. `views/month.tsx` (portar `CalendarGrid` + puntos indicadores + "+n").
5. Migrar `/admin/calendario` y `/comunicacion/calendario` al motor.
6. `useCalendarPreference` (wrapper de `persisted-view.ts`).

### Fase B — Vistas restantes (hito 2)
7. `views/week.tsx` + `day.tsx` + `time-gutter` + `now-line` + `logic/overlap.ts`.
8. `views/agenda.tsx`.
9. `views/year.tsx` (heatmap).
10. `parts/event-popover.tsx`, `empty-state.tsx`, `skeleton.tsx`.

### Fase C — Picker único (hito 3)
11. `CalendarDatePicker` con atajos (hoy/mañana/próxima semana/mes).
12. Migrar `date-sheet.tsx` a re-export del motor; deprecar `CalendarGrid` original.
13. Migrar vacaciones (admin + empleado) y días inhábiles al motor.
14. Migrar `DateRangeField`/`DateRangeCalendar` en solicitudes.

### Fase D — Panel derecho y refinamiento (hito 4)
15. `side/right-panel.tsx` (asistente de tiempo).
16. Filtros/capas + leyenda + mini-calendario.
17. Estados vacíos contextuales + skeletons por vista.
18. Accesibilidad completa + `prefers-reduced-motion`.

### Fase E — Extensiones (futuro)
19. Panel de integraciones (Google/Outlook/Apple).
20. Disponibilidad por empleado (`schedules`) + reservas (`logic/slots.ts`).
21. Arrastrar/crear/redimensionar eventos.
22. Vistas de equipo superpuestas (quién está dónde).

---

## 21. Checklist — cualquier pantalla nueva del motor

Antes de dar por buena una pantalla de tiempo en EMET:

- [ ] ¿Usa `CalendarEngine` o uno de sus `views/`? (si no → rehacer)
- [ ] ¿Usa el `CalendarDatePicker`? (si hay otro date picker → bug)
- [ ] ¿Colores vienen de tokens `--ev-*`? (si hay hex suelto → bug)
- [ ] ¿Radios = `--radius-s/m/l`? (otro radio → bug)
- [ ] ¿Eventos normalizados a `CalendarEvent`? (otra forma → bug)
- [ ] ¿Respetó la paleta (azul = acción, no decoración)?
- [ ] ¿Móvil muestra agenda primero?
- [ ] ¿Teclado navega el calendario?
- [ ] ¿Estado vacío sugiere una acción?
- [ ] ¿Skeleton mantiene la estructura?
- [ ] ¿`prefers-reduced-motion` respetado?

---

## 22. Criterios de aceptación visual

Comparar cualquier implementación contra esta tabla:

| Criterio | EMET NUEVO | EMET HOY (antes) |
|---|---|---|
| Header | 1 barra compacta 40px | Tabs + botones de 60px |
| Eventos en mes | Puntos + "+n" | Tarjetas-chips |
| Eventos en día/semana | Línea de color con borde izq | Rectángulos tipo botón |
| Hoy | Círculo accent (único) | Múltiples píldoras azules |
| Colores | Paleta semántica 7 colores | Casi todo azul |
| Panel derecho | Asistente editorial | Otro calendario |
| Mobile | Agenda + tira de días | Desktop encogido |
| Año | Heatmap de carga | 12 mini-calendarios |
| Date picker | Uno solo con atajos | Varios distintos |
| Sensación | Capas + aire + jerarquía | Cajas + todo igual de pesado |

> **Regla de oro:** si una captura del calendario de EMET podría confundirse con
> Google Calendar u Outlook, ese build no pasó. Si no podrías decir "eso es de EMET",
> hay que seguir iterando.
