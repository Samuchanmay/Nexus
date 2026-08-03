# Emet · Iconografía

## Sistema

Un **set propio, stroke-based** (`src/components/os/icons.tsx`): líneas redondeadas (`stroke-width` 1.6–2), `stroke-linecap/linejoin: round`, `fill: none`, tamaño por defecto 20px (variable vía prop `size`). Render con el componente `Icon ({ name, size })`.

**Sin librerías de iconos** (sin Font Awesome, Heroicons, Lucide): el set se mantiene manual y solo contiene lo que Emet usa.

## Principios

1. Trazo uniforme: el grosor no cambia entre tamaños (solo escala).
2. El color del icono **hereda** `currentColor`; nunca fijo salvo caso específico.
3. Los iconos son complemento, no reemplazo: si el significado no es obvio, acompañar con texto.
4. Un icono = un concepto. No reciclar el mismo glifo para dos acciones distintas.

## Iconos en uso (nav y dominios)

| Nombre | Uso |
|---|---|
| `home` | Inicio/Hoy |
| `layers` | Actividades, Recorridos |
| `inbox` | Solicitudes |
| `calendar` | Calendario, Días inhábiles |
| `book` | Biblioteca |
| `message` | Chat |
| `users` | Personas, Lista |
| `chart` | Reportes, Carga (equipo) |
| `clock` | Tiempo, Mi día, Asistencia |
| `plane` | Vacaciones |
| `alert` | Incidencias |
| `settings` | Configuración |
| `sparkle` | Default de EmptyState |
| `plus`/`check`/`x`/`trash`/`edit`/`send`/`mic`/`camera`/`map`/`sticker` | Acciones de módulos (chat, formularios, evidencias) |

## Reglas

1. Los iconos de **acción** son 16–18px (botones chicos, icon buttons); los de **identidad** (nav) 20–22px; los decorativos dentro de tarjetas 36px en contenedor de 36px con radio 11px.
2. Icon buttons requieren `aria-label` (el icono no se lee).
3. Estado seleccionado: mismo glifo, cambio de color (ej. `--accent`) o de fondo (tint), no un glifo distinto.
4. Para FAB, el icono es 24px blanco sobre gradiente.
5. Si hace falta un icono nuevo: añadirlo al set `icons.tsx` (y actualizar este doc), no embeber SVG suelto en el componente.
