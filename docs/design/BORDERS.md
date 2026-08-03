# Emet · Bordes

## Radios (forma)

| Token | Valor | Uso |
|---|---|---|
| `--radius-l` | 22px | Tarjetas hero, tarjetas grandes de estado (`v6-active-card`) |
| `--radius-m` | 16px | Tarjetas de lista, agenda, paneles |
| `--radius-s` | 11px | Opciones, chips, tarjetas de acción |
| `rounded-full` (100px) | píldora | Badges, segmentos, botones de acción chicos, avatares |

Cajas de inputs/botones usan `rounded-sm` (≈4px) — los controles son cuadrados pequeños, los contenedores redondeados.

## Trazo

- Bordes finos por defecto: `0.5px` en superficies glass y filas; `1px` (`--border-2`) en inputs/botones.
- En claro: `rgba(0,0,0,.08–.09)`; en oscuro: `rgba(255,255,255,.06–.12)`.
- Los bordes separan **contenedores**; los separadores de contenido son `divider` de color `--border`, nunca sombras.
- El `border: none` es el default para botones de acción dentro de tarjetas (solo color/fondo).

## Reglas

1. Forma = jerarquía: contenedores grandes redondeados grandes; controles pequeños casi cuadrados; píldoras para estados.
2. Los bordes de foco NO se dibujan con `border-color` (desplazan layout): se usa `box-shadow 0 0 0 4px var(--accent-tint)` + `border-color: var(--accent)`.
3. El anillo de foco `:focus-visible` global es `outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px`.
4. Excepción documentada: `.seg button:focus-visible` suprime el outline porque el thumb deslizante ya marca la selección.
5. No combinar radio grande con padding pequeño: `22px` exige ≥16px de padding para no cortar contenido.
