# Emet · Sombras

Tres niveles, siempre desde tokens. Nada de sombras ad-hoc.

## Niveles

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--shadow-1` | `0 1px 2px rgba(0,0,0,.025), 0 1px 1px rgba(0,0,0,.02)` | `0 1px 0 rgba(255,255,255,.02)` | Tarjetas planas, filas, defaults |
| `--shadow-2` | `0 4px 16px rgba(0,0,0,.05), 0 1px 3px rgba(0,0,0,.03)` | `0 10px 30px rgba(0,0,0,.22)` | Hover de tarjetas, popovers |
| `--shadow-3` | `0 16px 48px rgba(0,0,0,.10), 0 4px 12px rgba(0,0,0,.05)` | `0 24px 60px rgba(0,0,0,.32)` | Modales, sheets, menús flotantes |
| `--nx-shadow` | `0 1px 2px rgba(16,22,38,.05), 0 12px 30px rgba(16,22,38,.07)` | `0 1px 0 rgba(255,255,255,.02), 0 18px 44px rgba(0,0,0,.28)` | Tarjetas del shell |

**Chat (`.chat-ws`)**: sombras remapeadas con tinta azul-gris (`rgba(15,21,34,…)`) para el workspace premium; en oscuro se elevan (`0 30px 80px`).

## Reglas

1. Subir de nivel SOLO cuando el elemento sube de importancia: hover (1→2), overlay (2→3).
2. `card-hover` = `translateY(-3px)` + `--shadow-2` (nunca sombra sin movimiento, ni movimiento sin sombra).
3. Los botones primarios usan glow de color: `0 4px 12px rgba(0,102,255,.20)` (hover `.26`) — el glow es del acento, no gris.
4. En oscuro, las sombras son más profundas porque no hay luz que las suavice; no subir al mismo valor que claro.
5. La tarjeta `.card` base usa un tono aún más suave que `--shadow-1` (`0 1px 2px rgba(0,0,0,.025), 0 1px 1px rgba(0,0,0,.018)`) — las tarjetas en reposo casi no tienen sombra.
