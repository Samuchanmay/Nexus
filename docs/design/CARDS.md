# Emet · Tarjetas

## Niveles

| Nivel | Clase/patrón | Radio | Sombra | Uso |
|---|---|---|---|---|
| Plana | `Card` (pad, sin hover) | `--radius-m` (16) | `--shadow-1` | Contenido estático |
| Elevable | `Card hover` | 16 | 1→2 | Elementos clicables de lista |
| Hero | `v6-active-card` | `--radius-l` (22) | `--shadow-2` | Tarjeta principal de estado (Mi Día) |
| Overlay | Modal/Sheet | 16–22 | `--shadow-3` | Capas flotantes |

## Anatomía de una tarjeta de lista (estándar)

```
[Avatar 36px]  Nombre 14px · 650        [Píldora de estado]
               meta 12px · --text-2
```

- `padding: 14px 16px` (agenda) / 13–16px (pendientes) / 22px (hero).
- Avatar con `nexus_color` (identidad personal) + badge de cumpleaños opcional.
- Estado siempre como píldora a la derecha (nunca texto de color plano).
- Tarjeta con acción → chevron o ">" ; con swipe (chat) → acciones reveladas.

## Comportamiento

- **Hover**: `translateY(-2px)` + `--shadow-2` (`.22s spring`). En móvil no aplica (touch).
- **Activa/presionada**: `scale(.96)` solo en elementos de toque (chips, FAB).
- **Seleccionada**: borde/fondo acento (tint), no sombra.
- **Contenedor con contexto**: las filas de agenda/agenda tienen su stripe de color a la izquierda (`3px`, radio 2) que identifica el tipo de evento.

## Reglas

1. Una tarjeta = un concepto. No anidar tarjetas si se puede separar en filas.
2. El contenido de la tarjeta va con ellipsis (nunca rompe layout); el detalle completo vive en el detalle.
3. `glass` para tarjetas sobre mesh (fondo visible a través); `--surface` sólido para contenido denso.
4. Las tarjetas de "estado" llevan un gradiente/barra superior de 3px cuando representan algo vivo (temporizador activo, proyecto en curso).
5. No más de una tarjeta "hero" por pantalla (jerarquía: una protagonista).
