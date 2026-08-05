# Emet · Tipografía

## Fuente

`-apple-system, "SF Pro Display", "SF Pro Text", Inter, sans-serif` — la fuente del sistema operativo del usuario. Sin webfonts (cero costo de carga, máxima legibilidad nativa).

`html { font-size: 110% }` en desktop (legibilidad pedida por el cliente, reemplazó al `zoom` no estándar). En móvil 100% (evita scroll horizontal).

## Escala canónica (`--fs-*`)

La escala no inventa números: **nombra los tamaños que ya existen** para que un componente nuevo nunca tenga que escribir uno más. Registrada en `tailwind.config.ts` (`fontSize`) como utilidades: `text-2xs`, `text-xs`, `text-sm`, `text-tag`, `text-base`, `text-md`, `text-lg`, `text-xl`, `text-title`, `text-2xl`, `text-3xl`, `text-display`, `text-hero` — cada una resuelve a su token.

Retrofit W2/W3 aplicado (2026-08-05): los tamaños sueltos históricos se normalizaron a la escala (423 reemplazos en 75 archivos). Quedan **dos excepciones deliberadas, fuera de la escala por densidad/contexto**:

| Banda | Excepción | Dónde |
|---|---|---|
| <11px (7.5–10.5) | Micro-densidad del calendario | Celdas del heatmap anual, chips diminutos |
| ≥34px (34–80) | Hero / tier de pantalla de bienvenida | `--fs-hero` (42) y tamaños de pantallas de bienvenida/estadísticas grandes |

| Token | px | Uso típico |
|---|---|---|
| `--fs-2xs` / `--fs-xs` / `--fs-sm` | 12 | Metadatos, tiempos, horas |
| `--fs-tag` | 12.5 | Tags, botones chicos |
| `--fs-base` | 13.5 | Texto base, párrafos |
| `--fs-md` | 14 | Títulos de fila, info |
| `--fs-lg` | 15 | Subtítulos |
| `--fs-xl` | 16 | Títulos de sección menores |
| `--fs-title` | 19 | Títulos de tarjeta |
| `--fs-2xl` | 21 | Títulos de pantalla |
| `--fs-3xl` | 24 | H1 de secciones |
| `--fs-display` | 28 | Hero |
| `--fs-hero` | 42 | Hero grande (solo pantallas de bienvenida) |

El hero de "Mi Día" usa `clamp(26px,5vw,32px)` — tipografía fluida en el hero, escala fija en el resto.

## Estilo

- `font-weight`: 600–650 para énfasis (etiquetas, tiempos), 700 para títulos.
- `letter-spacing`: negativo en títulos grandes (`-0.02em` h1, `-0.015em` sección), `0.05–0.07em` (uppercase) en micro-etiquetas de timer.
- `font-variant-numeric: tabular-nums` para números de timer/estadísticas (no saltan).
- `-webkit-font-smoothing: antialiased` + `text-rendering: optimizeLegibility` en body.
- Uppercase SOLO para micro-etiquetas (TIMER, LUN, etiquetas de columnas), nunca para párrafos.
- Títulos con `line-height` ajustado (h1 1.1, secciones ~1.3); el texto de lectura `1.4–1.5`.

## Reglas

1. Usar la escala `--fs-*` (o las utilidades `text-*` del tema); no escribir `text-[13px]` nuevos si no está en la escala — y si ya está, normalizar al valor canónico (retrofit hecho).
2. No más de 3 niveles de tamaño en una pantalla (jerarquía de título/cuerpo/meta).
3. El line-clamp y ellipsis están permitidos para filas de lista; el texto completo se ve en el detalle.
4. La pausa/hero permite tamaños grandes con `clamp()`; el interior de módulos usa escala fija. Las bandas de excepción (<11px micro-densidad y ≥34px hero) no deben crecer.
