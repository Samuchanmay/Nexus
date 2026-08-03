# Emet · Design Language del chat

> Canon del nivel N3 (feedback 2026-08-03). Objetivo: refinamiento comparable al de **Signal Desktop**. No es un clon — se copia la *resolución del problema*, nunca el look. Referencias de referencia: Apple HIG (jerarquía y detalle), Signal Desktop (mecánica y estados), Linear/Notion (refinamiento), Stripe (pulido de micro-interacción).

## Principios

1. **El espacio es el lujo.** El chat ocupa todo el ancho disponible; el contenido respira. Nada de contenedores centrados con margen muerto.
2. **La conversación es la protagonista.** El fondo la deja brillar (patrón 2–4%, nunca negro plano); todo lo demás (sidebar, lista, panel de info) es soporte.
3. **Un peso visual por nivel de jerarquía.** Dentro de un grupo (botones del composer, iconos del header) todos pesan igual: mismo tamaño, mismo radio, misma opacidad. Un solo acento por franja.
4. **Estados, no decoración.** Hover, activo, no-leído, fijado, silenciado, escribiendo, en línea: cada estado se resuelve con un cambio semántico, nunca con adornos.
5. **Las piezas se pegan donde pertenecen.** Reacciones pegadas a la burbuja, avatar junto al mensaje (gap 8px), acciones bajo la tarjeta del swipe — el ojo debe leer la relación.
6. **El movimiento se siente nativo.** Micro-animaciones ≤220ms con `--spring`/`--ease`; transform y opacity únicamente (GPU); nunca animar layout. `prefers-reduced-motion` respetado.

## Arquitectura (desktop)

| Columna | Ancho | Contenido |
|---|---|---|
| Sidebar | 220px | Navegación del Shell |
| Lista | 360–380px | Conversaciones + búsqueda + "Nuevo mensaje" |
| Conversación | flexible | Header · mensajes · compositor |
| InfoPanel | 340–380px | 3.ª columna SIEMPRE visible (no overlay); colapsa en pantallas medianas |

Full-bleed: sin margen exterior del módulo (`Shell` con `wide` → `main md:p-0` + `max-w-none`).

## Iconos

Lucide unificado en todo el chat: **24px, stroke 2, esquinas redondeadas**, sin excepciones (`Icon` en `src/components/os/icons.tsx`). Header: búsqueda · llamada · video · info · menú "more".

## Composición del header

Avatar · Nombre · Estado (presencia/escribiendo) → acciones a la derecha. La presencia viva (dot en línea) se hereda del `last_seen_at` de `user_heartbeats`.

## Burbujas

- Radio 18px, máx. 72% del ancho.
- Borde hairline: `inset 0 0 0 0.5px` (enviada: blanco 10%; recibida: gris 14%) + sombra exterior 1px sutil.
- Padding `px-3.5 pt-2 pb-1.5`; imágenes `rounded-[14px]` integradas.
- Cola sutil (clip-path) solo al cambiar de remitente; nunca en stickers.
- Gap avatar→burbuja: **8px** (`gap-2`).

## Reacciones

Cápsulas **literalmente pegadas** a la burbuja: solapan su borde inferior (`-mt-2.5`), alineadas al borde del remitente, con borde hairline y sombra corta. Solo a mensajes de otros (Signal); solo lectura en propios. Pop 0.9→1.1→1.0 al interactuar.

## Compositor

Botones todos del mismo peso visual (34px, mismo radio 999, sin círculo azul protagonista):
`+` adjuntar · input · emoji/stickers · adjuntar archivo · envío/grabar. El único acento de color es el envío (contenido presente).

## Lista de conversaciones

- Filas 64–68px (avatar 48), fondo opaco igual a la lista (`--chat-list-bg`) — requisito del swipe.
- Estados vivos: hover (`--chat-hover-row`), activo (`data-active`, `--chat-list-active`), no leído (pill de conteo), fijado (pin), silenciado (bellOff), escribiendo (TypingDots), en línea (dot de presencia en directas).
- Swipe: la tarjeta se traslada solo con `transform` (GPU); franjas de acciones con `z-index: 0` bajo la tarjeta `z-[1]`; `will-change: transform` durante el arrastre. El texto jamás asoma sobre las acciones.

## Fondo del panel de mensajes

`nx-msg-panel`: color base (`--chat-bg`) + patrón radial de puntos a 2–4% de opacidad, `background-size` 22px. Oscuro: `#0A121F → #0C1626 → #151D2B → #1A2434` (azul-negro, nunca negro puro).

## Documentación viva

Al cambiar cualquiera de estos patrones, actualizar:
- `docs/modules/CHAT.md` — convenciones de UI del módulo
- `docs/changelog/CHANGELOG.md` — entrada del cambio
- Este archivo si el cambio altera el lenguaje en sí.
