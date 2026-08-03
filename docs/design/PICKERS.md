# Emet · Pickers

## Principio

**Picker nativo estilizado, o Sheet/Menu oficial. Nada de datepickers de terceros.** La fecha/hora del SO en móvil es nativa e insuperable; en desktop se ofrecen controles del sistema con la estética de Emet.

## Catálogo

| Control | Cuándo | Dónde vive |
|---|---|---|
| `<input type="date/time/datetime-local">` | Fechas y horas simples | Formularios (`admin/*`, vacaciones, solicitudes) |
| `<input type="color">` | Color personal/etiquetas | Configuración de colores, avatar |
| `<input type="range">` | Valores numéricos (radios GPS, tolerancias) | `admin/config/gps`, horarios |
| `SlidingSegments` | Elección discreta de 2-4 opciones | Vistas (Semana/Mes), filtros |
| `Menu` | Lista de opciones en contexto | Acciones de fila, filtros |
| `Sheet` | Elección con contexto o varios campos | Adjuntos, reenvío, cámara |
| `Segments` de actividad | Tipo de actividad con icono + etiqueta | "Mi Día" (grid 5-col) |

## Reglas

1. La fecha se muestra SIEMPRE en formato legible (`lunes, 3 de agosto`), aunque el valor guardado sea ISO.
2. El fin de un rango es **exclusivo** en el dominio de calendario/Google (convención `[start, end)`), y la UI lo convierte a inclusivo para el humano.
3. Los selectores de "día" dentro del calendario del equipo son el componente propio del motor de calendario (ver `modules/CALENDAR.md`).
4. Un picker deshabilitado conserva su valor visible y se marca con opacidad.
5. El `SlidingSegments` anima su thumb con `--spring` (380ms) — la selección ES el movimiento.
6. En móvil, si el control nativo del SO abre un picker de pantalla completa, respetarlo (no construir un clon).

## Zona horaria

La organización vive en `America/Merida` (fijo en Edge Functions `gcal-*`, `fichar`, `notify-vacation`). Todos los cálculos de "hoy", `jornada` y fechas del equipo usan esa zona; ver `src/lib/tz.ts`.
