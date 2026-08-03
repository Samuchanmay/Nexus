# Emet · Color

## Sistema

Paleta **neutra + un acento + semánticos**. El color siempre significa algo; nunca se usa "porque se ve bien".

### Neutros (fondo y texto)

Claro: `--bg #FBFBFD` · `--surface #FFFFFF` · `--surface-2 #F0F0F2` · `--surface-3 #E8E8EA`
Textos: `--text-1 #1D1D1F` · `--text-2 #6E6E73` · `--text-3 #8A8A90`
Oscuro: `--bg #0F1115` · `--surface #151922` · `--surface-2 #1A1F2B` · `--surface-3 #202737`
Textos: `--text-1 #F5F7FA` · `--text-2 #B7C0D1` · `--text-3 #7E8798`

### Acento y semánticos

| Token | Claro | Oscuro | Significado |
|---|---|---|---|
| `--accent` | `#0066FF` | `#4F8CFF` | Acción, enlaces, foco, "lo que hay que tocar" |
| `--ok` | `#2FB344` | `#3ECF8E` | Éxito, presente, activo |
| `--warn` | `#FF8A00` | `#F5A623` | Atención, pausa, pendiente de salida |
| `--danger` | `#FF3B30` | `#FF6B6B` | Error, peligro, ausencia |
| `--purple` | `#5856D6` | `#8B7BFF` | Vacaciones, RH, especial |

Todos con su `--*-tint` para fondos suaves (píldoras, focus rings, selección). Ej. `--accent-tint rgba(0,102,255,.08)`.

### Calendario (`--ev-*`) — paleta semántica de eventos

| Evento | Token | Claro | Oscuro |
|---|---|---|---|
| Trabajo | `--ev-blue` | `#0066FF` | `#0A84FF` |
| Vacaciones | `--ev-purple` | `#AF52DE` | `#BF5AF2` |
| Disponibilidad | `--ev-green` | `#30D158` | `#32D74B` |
| Ausencias | `--ev-red` | `#FF3B30` | `#FF453A` |
| Pendientes | `--ev-orange` | `#FF8A00` | `#FF9F0A` |
| Cumpleaños | `--ev-yellow` | `#B8860B` | `#FFD60A` |
| Inhábiles | `--ev-gray` | `#8E8E93` | `#8E8E93` |

### Chat (`.chat-ws`)

El workspace del chat remapea el acento a `#2663FF` (con su tint y ring) y sus semánticos, para que el módulo se sienta premium y coherente a la vez. La burbuja propia es el **acento sólido** con texto blanco; la recibida es la superficie del panel.

### Mesh de fondo (por rol)

`data-mesh` en `<body>`: degradados radiales sutilísimos que distinguen el entorno de cada rol. En claro usan `mix-blend-mode: multiply` (el problema histórico era que "normal" diluía el tinte; multiply oscurece donde pasa y se lee más profundo). En oscuro `opacity: 1.05`. Si se nota el salto entre sidebar y contenido, es demasiado.

## Reglas

1. Usar tokens, nunca hex sueltos en componentes.
2. El acento es SOLO para acción y para indicar "seleccionado" en listas/pestañas.
3. Un elemento tiene como máximo un color semántico a la vez (no verde y rojo juntos).
4. Contraste: texto sobre `--surface` con `--text-2` cumple ≥4.5:1 en claro; en oscuro se usan tintes más altos (`--*-tint .14`) por el fondo oscuro.
5. El color de avatar de cada persona (`users.nexus_color`) es libre: es identidad personal, no semántica.
