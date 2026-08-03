# Emet · Sistema de diseño

El sistema vive en **CSS custom properties** (`src/app/globals.css`) y un **kit de componentes** (`src/components/os/ui.tsx` + `src/components/ui.tsx`). No hay librería de UI externa: Emet construye su propio lenguaje.

## Estructura de tokens

### Colores (`:root` claro / `[data-theme="dark"]`)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#FBFBFD` | `#0F1115` | Fondo de la app |
| `--surface` | `#FFFFFF` | `#151922` | Tarjetas, inputs, paneles |
| `--surface-2` | `#F0F0F2` | `#1A1F2B` | Fondos alternos, hover |
| `--surface-3` | `#E8E8EA` | `#202737` | Fondos presionados |
| `--border` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.06)` | Bordes finos |
| `--border-2` | `rgba(0,0,0,.09)` | `rgba(255,255,255,.11)` | Bordes de inputs/botones |
| `--text-1` | `#1D1D1F` | `#F5F7FA` | Texto principal |
| `--text-2` | `#6E6E73` | `#B7C0D1` | Texto secundario |
| `--text-3` | `#8A8A90` | `#7E8798` | Texto terciario / placeholders |
| `--accent` | `#0066FF` | `#4F8CFF` | Acciones |
| `--ok` | `#2FB344` | `#3ECF8E` | Éxito / jornada |
| `--warn` | `#FF8A00` | `#F5A623` | Advertencias |
| `--danger` | `#FF3B30` | `#FF6B6B` | Errores / peligro |
| `--purple` | `#5856D6` | `#8B7BFF` | Vacaciones / especial |

Cada color semántico tiene su tinte `--*-tint` (fondo de píldoras, focus rings).

### Paleta de eventos del calendario (`--ev-*`)

Azul=trabajo, morado=vacaciones, verde=disponibilidad, rojo=ausencias, naranja=pendientes, amarillo=cumpleaños, gris=inhábiles. Cada uno con `-tint`. (El azul `--ev-blue` es el mismo `--accent`: los eventos de trabajo son la "acción del día".)

### Escala tipográfica (`--fs-*`)

Ver `TYPOGRAPHY.md`. 13 tamaños canónicos: `--fs-2xs (12)` … `--fs-hero (42)`.

### Radios

| Token | Valor | Uso |
|---|---|---|
| `--radius-l` | 22px | Tarjetas hero, modales |
| `--radius-m` | 16px | Tarjetas estándar |
| `--radius-s` | 11px | Opciones, chips |

Píldoras (`rounded-full`) para badges, segmentos, botones de acción en tarjetas (`100px`).

### Sombras

Ver `SHADOWS.md`. 3 niveles + `--nx-shadow` del shell.

### Movimiento

| Token | Valor | Uso |
|---|---|---|
| `--ease` | `cubic-bezier(.22,.61,.36,1)` | Movimientos funcionales |
| `--spring` | `cubic-bezier(.34,1.4,.64,1)` | Movimientos "vivos" (segmented, cards, swipe) |

### Superficies y utilidades CSS

- `.glass` — superficie translúcida (`color-mix(surface 72%)` + `blur(20px) saturate(1.5)`, borde 0.5px).
- `.glass-bar` — topbar/sidebar translúcidos (`blur(22px)`).
- `.card` / `.card-hover` — tarjeta base con sombra y elevación al hover.
- `.btn-primary` / `.btn-secondary` / `.btn-tertiary` / `.btn-ok` — botones de 3+1 niveles.
- `.pill`, `.field-input` (con focus ring azul y `aria-invalid`), `.seg` (segmented control con thumb deslizante).
- `.mesh` — degradados radiales por rol (`data-mesh` en body), con `mix-blend-mode: multiply` en claro.
- `.nx-skel` — shimmer de skeleton. `.nx-pop/.nx-fade/.nx-datesheet-pop` — entradas de overlay.
- `.nx-ripple`, `.nx-toast-shake`, `.nx-msg-icon-bounce`, `.nx-breathe-soft` — micro-interacciones.

### Chat: scope `.chat-ws`

El chat remapea los tokens dentro de su scope (workspace premium estilo Linear). Ver `modules/CHAT.md` y la sección de identidad en `02-BLUEPRINT.md`.

## Kit de componentes oficial

Ver `COMPONENTS.md` (lista, props, cuándo usarlos). Ubicación: `src/components/os/ui.tsx` y `src/components/ui.tsx`.

## Reglas de uso

1. **Nunca** colores hex sueltos en componentes: usar tokens (`var(--*)` o utilidad Tailwind que apunte a token).
2. **Nunca** nuevos tamaños de letra fuera de `--fs-*`. Si falta uno, se añade a la escala con ADR de diseño, no en la pantalla.
3. **Nunca** sombras ad-hoc: `--shadow-1/2/3`.
4. Todo nuevo patrón entra al sistema de diseño ANTES de usarse en una pantalla (canon §5).
