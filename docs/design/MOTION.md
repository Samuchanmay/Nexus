# Emet · Motion

## Curvas canónicas

| Token | Valor | Cuándo |
|---|---|---|
| `--ease` | `cubic-bezier(.22,.61,.36,1)` | Funcional: apariciones, colores, sombras, hover |
| `--spring` | `cubic-bezier(.34,1.4,.64,1)` | Vivo: segmented control, cards al hover, swipe, pops |

Regla: si se ve "físico", `--spring`; si solo se ve "hecho", `--ease`.

## Principios

1. **Rápido y corto.** La mayoría de las transiciones están entre 180ms y 380ms. Lo que tarda más necesita razón.
2. **GPU-friendly.** Animar `transform` y `opacity`; nunca `top/left/width` salvo casos puntuales (`--seg-thumb` usa width+transform con `will-change`).
3. **Una cosa a la vez.** El hover eleva la tarjeta *o* mueve el contenido, no ambas.
4. **`prefers-reduced-motion` gana.** En `globals.css` global y en `.chat-ws` (duración 0.01ms, scroll instantáneo).

## Movimientos oficiales

| Movimiento | Token/clase | Uso |
|---|---|---|
| Aparición de overlay | `nx-pop` (`.22s spring`) | Menús, sheets, popovers |
| Date sheet | `nx-datesheet-pop` (`.22s spring`, origin top-left) | Calendarios |
| Fade | `nx-fade` (`.2s ease`) | Cambios de estado |
| Slide-in | `nx-slide` (`.2s ease`, -6px) | Filas que entran |
| Mensaje entrante | `nx-chat-in` (`.22s spring`) | Burbujas del chat |
| Skeleton | `nx-shimmer` (1.4s) | Carga |
| Ripple | `nx-ripple-grow` (.55s) | Toque en botones `[data-ripple]` |
| Shake de error | `nx-shake` (.42s) | Toasts de error |
| Saludo 👋 | `nx-wave` (1.6s, una vez) | Header de Hoy/Mi Día |
| Icono asistente | `nx-icon-bounce` (1.8s, loop) | Mensajes destacados de EMU |
| Pausa activa | `nx-breathe-soft` (3.2s) + `nx-steam` | Ilustración de pausa |
| Pop de reacción | `nx-pop-react` (0.9→1.1→1.0) | Reacciones en chat |
| Menú/popover | `nx-menu-in` (fade+scale) | Menús desplegables |

## Micro-interacciones por componente

- **Card**: hover `translateY(-3px)` + sube de sombra (`.22s spring`).
- **Segmented control**: el thumb desliza (`--spring`, 380ms) — el thumb ES la selección.
- **Botón**: `translateY(-1px)` + glow al hover (primario); `scale(.96)` al presionar (chips).
- **Fila pendiente**: hover `translateX(3px)` (sugiere "hazme clic").
- **Chat swipe**: el row se desliza revelando acciones; soltar a mitad restaura con spring.

## Lo que está prohibido

- Animaciones infinitas que no sean "vivas" (breathe, steam, shimmer, icon-bounce) o de estado (pulse de pausa).
- Movimiento de páginas completas (nada de transiciones de ruta tipo slide) — el shell no se mueve, el contenido sí.
- `transform` de tarjetas dentro de listas al hacer scroll (parallax).
