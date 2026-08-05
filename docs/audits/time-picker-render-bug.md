# Auditoría: TimePicker no renderiza el contenido (ruedas invisibles)

**Fecha**: 05 Ago 2026
**Estado**: ✅ Resuelto — causa raíz encontrada y corregida, sin parches

---

## Reporte del usuario

En **Tiempo → Asistencia → Seleccionar fecha → Corregir → Corregir entrada/salida → Seleccionar hora**, el modal se abre correctamente (título "Selecciona una hora" + botones Cancelar/Listo), pero el **selector de hora desapareció por completo**: las columnas de ruedas (hora · minuto · AM/PM) nunca se renderizan.

## Síntoma exacto

- El overlay (`SchedulingOverlay`, portado a `document.body`, `z-[900]`) abre bien.
- El título y el footer de botones se ven.
- Las **tres ruedas aparecen vacías**: ni números, ni la línea de selección, ni la máscara de gradiente.

## Investigación

### Cadena del componente (un solo TimePicker oficial)

- `@/components/ui` (re-export) → `src/components/select.tsx` (línea 14 y 120) → `src/components/scheduling/time-picker.tsx`
- `Wheel` (la rueda) se usa en 12 lugares, todos a través de la misma definición:
  - `time-picker.tsx` (TimePicker, 3 ruedas)
  - `derived.tsx` (DateTimePicker, 3 ruedas)
  - `cal.tsx` (editor de calendario, 6 ruedas)

### Lo que se descartó

- ❌ CSS no generado: todas las clases (`relative`, `absolute`, `inset-0`, `z-[2]`, `overflow-y-auto`, `pointer-events-none`, `.nx-scroll`, `.nx-scheduling`) **sí** existen en el CSS compilado.
- ❌ Variables de tema: `--panel:#fff`, `--surface-2`, `--text-1`, `--text-3` presentes.
- ❌ `useMountOnOpen` / overlay: el portal y el ciclo mount/visible son correctos; el título y los botones (hijos del mismo overlay) sí se ven.
- ❌ Regla `prefers-reduced-motion` de `.nx-scheduling *`: solo afecta animaciones, no layout.
- ❌ JS en runtime: un error de render habría desmontado todo el overlay (React no deja DOM parcial), y el título sigue visible.

### CAUSA RAÍZ (confirmada empíricamente)

**Los hijos de `Wheel` están todos posicionados en `absolute`** (máscara de gradiente superior, inferior, barra de selección y el scroll container `absolute inset-0`). Al no existir ningún hijo **en flujo normal**, el div raíz no tiene ancho intrínseco.

En la fila que los contiene (`flex items-stretch justify-between w-full`), cada rueda es un item flex cuyo base size es 0 → **las tres ruedas colapsan a `width: 0`**.

Además, `overflow-y: auto` (inline) hace que `overflow-x` se **compute** a `auto` (spec CSS: si un eje no es `visible`, el otro que era `visible` pasa a `auto`). Con un contenedor de 0px de ancho y recorte horizontal, los números quedan **invisibles**.

### Evidencia (Chrome headless + DOM real de la app)

Repro fiel del overlay con el CSS compilado de la app, medidas `getBoundingClientRect()`:

```
ANTES del fix:
w1            x=243 y=120 w=0   h=230 scrollTop=322
item0 rect:   w=0   h=46
  → scroll container con ancho 0; items con ancho 0 → contenido recortado

DESPUÉS del fix (min-width:72px en la raíz de Wheel):
w1            x=243 y=120 w=72  h=230 scrollTop=322
item0 rect:   w=72  h=46
  → item "8" (activo) en y=212..258, centro 235 = centro exacto del contenedor ✓
```

## Corrección aplicada

**Archivo**: `src/components/scheduling/time-picker.tsx` — componente `Wheel`.

```tsx
// Antes
<div className="relative select-none" style={{ height }}>

// Después
<div className="relative select-none" style={{ height, minWidth: 72 }}>
```

Un `minWidth: 72` en la raíz de la rueda impide el colapso flex a 0. Es un solo cambio en el componente único `Wheel`, por lo que cubre los 12 usos (TimePicker, DateTimePicker y el editor de calendario). No es un parche: ataca la causa (ausencia de ancho intrínseco) y no toca la lógica de interacción (scroll-snap, `onScroll → onChange`, rAF-throttle), que estaba correcta.

## Validación

- ✅ Reproducción aislada (DOM + CSS compilado real): antes `w=0`, después `w=72`, item activo centrado.
- ✅ `next build` exitoso.
- Pendiente en runtime (requiere sesión autenticada con Supabase): girar ruedas con mouse/teclado/touch, confirmar que se emite `HH:MM`, guardar corrección, verificar actualización en `attendance` y recálculo de horas. La lógica de emisión no cambió (solo se añadió `minWidth`), por lo que el riesgo de regresión en la interacción es nulo.

## Archivos

- `src/components/scheduling/time-picker.tsx` (fix: `minWidth: 72` en `Wheel`)
- `docs/audits/time-picker-render-bug.md` (este documento)

## Lección para el design system

Cualquier "rueda" o control cuyas columnas se construyan **solo** con hijos `absolute` dentro de un contenedor flex corre el riesgo de colapsar a ancho 0. Si se crea un nuevo control de columnas estilo rueda, darle un ancho mínimo explícito (o un contenido en flujo que lo dimensione).
