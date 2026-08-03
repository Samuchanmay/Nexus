# Emet · Espaciado

## Escala

No hay tokens de spacing nombrados (a diferencia de color/tipografía); el layout usa las utilidades de Tailwind (4px base): `gap-1 (4)`, `gap-2 (8)`, `gap-3 (12)`, `gap-4 (16)`, `gap-5 (20)`, `gap-6 (24)`, `gap-8 (32)`.

## Reglas de jerarquía (buenas prácticas confirmadas en el código)

- **Padding de tarjetas**: 14–22px según nivel (`v6-active-card` 22px, `v6-ag` 14/16px, `.field-input` 12/14px). El hero de "Mi Día" usa `padding: 34px 0 26px`.
- **Listas**: separación vertical `8px` (`gap-2`) — denso pero respirable.
- **Grids**: `gap-8px` (5 columnas) con colapso a 3 columnas en ≤520px.
- **Secciones**: título con `margin-bottom 13px`; bloques entre sí `28–30px` (v6).
- **Botones en fila**: `gap-8px`.
- **Sidebar/shell**: transiciones de 0; el contenido se separa con padding del contenedor, no con márgenes del shell.

## Principios

1. La **proporción** importa más que el número: si un grupo es jerárquicamente superior, usa más espacio.
2. Múltiplos de 4 siempre que se pueda; los `clamp()` solo en hero.
3. En listas, la altura de fila manda (48px+); nunca aplastar con padding 0 para "ganar espacio".
4. Móvil: reducir padding de tarjetas (14px) pero conservar los `gap` de 8px entre filas; el FAB vive a `bottom: 84px; right: 20px` (sobre la tab bar).
5. Centrado vertical para chips/píldoras (`align-items:center`); texto largo con `ellipsis`.
