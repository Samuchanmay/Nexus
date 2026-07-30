# Chat Redesign — Nativo EMET (Julio 2026)

## Resumen

Se eliminó por completo el diseño inspirado en WhatsApp (fondo beige `#EFEAE2`, burbujas verdes `#D9FDD3`, píldoras flotantes) y se reemplazó con el lenguaje visual nativo de EMET (Apple-inspired, acento azul, surfaces limpias). El chat ahora se siente como una parte integral del producto, no como un widget copiado de otra app.

## Archivos modificados

### 1. `src/app/globals.css`

**Eliminadas** 8 variables CSS (4 light + 4 dark):

| Variable | Light (antes) | Dark (antes) |
|---|---|---|
| `--wa-chat-bg` | `#EFEAE2` | `#0B141A` |
| `--wa-sent-bg` | `#D9FDD3` | `#005C4B` |
| `--wa-sent-fg` | `#111B21` | `#E9EDEF` |
| `--wa-received-bg` | `#FFFFFF` | `#202C33` |

El chat ahora usa exclusivamente los tokens nativos del sistema de diseño: `--surface`, `--surface-2`, `--accent-tint`, `--border`, `--bg`, `--text-1`, `--text-3`.

### 2. `src/app/chat/[id]/client.tsx`

| Elemento | Antes | Ahora |
|---|---|---|
| **Fondo del área de mensajes** | `var(--wa-chat-bg)` | `var(--surface-2)` |
| **Burbuja propia** | `var(--wa-sent-bg)` con tail (borderTopRightRadius: 2) | `var(--accent-tint)` sin tail, `rounded-[10px]` |
| **Burbuja recibida** | `var(--wa-received-bg)` con tail | `var(--surface)` sin tail, `rounded-[10px]`, borde `0.5px solid var(--border)` |
| **Day separator** | Píldora flotante con fondo `--wa-received-bg` | Línea horizontal `─── texto ───` con `h-px` + borde |
| **Botón enviar** | `var(--wa-sent-bg)` (verde) cuando hay texto | `var(--accent)` (azul) con texto blanco |
| **Compositor** | `rounded-[20px]` con `border-border` | `rounded-[12px]` con `0.5px solid var(--border)` |
| **Archivo adjunto (fondo)** | `rgba(0,0,0,0.06)` en propios | `rgba(0,0,0,0.04)` (más sutil) |

### 3. `src/lib/chat/message-state.ts`

**STATUS_ICON** cambió de `Record<MessageStatus, string>` (emoji) a `Record<MessageStatus, ReactNode>` (SVG inline):

| Estado | Antes (emoji) | Ahora (SVG) |
|---|---|---|
| `pending` | 🕓 | `◌` con opacidad 50% |
| `sent` | ✓ | Checkmark simple (11x8, stroke 1.6) |
| `delivered` | ✓✓ | Checkmark doble (segundo trazo 55% opaco) |
| `read` | ✓✓ | Checkmark doble (ambos trazos sólidos) |
| `failed` | ⚠ | `!` dentro de círculo danger |

### 4. `src/components/chat/message-status.tsx`

- El indicador "failed" ya no muestra "⚠ reintentar" sino un círculo rojo con `!` + "reintentar"
- Opacidad ajustada: pending 0.4, sent/delivered/read 0.7
- El color "read" sigue usando `var(--accent)` (azul)

### 5. `src/components/chat/reactions.tsx`

- Bordes de reacciones no-propias cambiados de `1px solid transparent` a `0.5px solid var(--border)`
- Reacciones propias: `0.5px solid var(--accent)` (antes 1px)

### 6. `src/components/chat/conversation-row.tsx`

- Agregada transición `background .18s var(--ease)` para hover state
- Nota: el hover real necesita implementarse via CSS (actualmente usa inline styles dinámicos)

### 7. `src/app/chat/layout.tsx`

- Comentario "como WhatsApp Web" eliminado

## Tokens usados ahora (todos existentes en el design system)

| Token | Light | Dark | Uso en chat |
|---|---|---|---|
| `--surface` | `#FFFFFF` | `#151922` | Burbujas recibidas, compositor |
| `--surface-2` | `#F0F0F2` | `#1A1F2B` | Fondo del área de mensajes |
| `--accent` | `#0066FF` | `#4F8CFF` | Botón enviar, checkmarks leídos |
| `--accent-tint` | `rgba(0,102,255,0.08)` | `rgba(79,140,255,.14)` | Burbujas propias |
| `--border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.06)` | Bordes de burbujas recibidas, separadores |
| `--text-1` | `#1D1D1F` | `#F5F7FA` | Texto de mensajes |
| `--text-3` | `#8A8A90` | `#7E8798` | Day separators |
| `--bg` | `#FBFBFD` | `#0F1115` | Header, compositor area |
| `--hover` | `#F0F1F4` | `#232B3B` | Hover en filas de conversación |

## Cómo se veía antes vs. ahora

```
ANTES (WhatsApp clone):              AHORA (Nativo EMET):
┌─────────────────────┐              ┌─────────────────────┐
│  Fondo: #EFEAE2     │              │  Fondo: --surface-2 │
│  ┌───────┐          │              │  ─── Hoy ───        │
│  │ verde │          │              │  ┌─────────┐        │
│  └───────┘          │              │  │ surface │        │
│       ┌─────────┐   │              │  └─────────┘        │
│       │ blanco  │   │              │      ┌──────────┐   │
│       └─────────┘   │              │      │accent-tint│   │
│                     │              │      └──────────┘   │
│  [+][________][▶]   │              │  [+][________][▶]   │
└─────────────────────┘              └─────────────────────┘
```

## Modo oscuro

Funciona automáticamente — todos los tokens tienen contraparte dark definida en `[data-theme="dark"]` y `:root[data-theme="dark"]`. No se agregó lógica condicional en ningún componente.

## Lo que NO se cambió (a propósito)

- **Arquitectura del outbox** (useOutbox, useAttachmentUpload, useTyping)
- **Realtime subscriptions** (postgres_changes + broadcast)
- **Lógica de swipe gestures** (useSwipeGesture)
- **Attachment sheet** (solo se actualizó un color de fondo)
- **Info panel** (lado derecho, ya usaba tokens nativos)
- **Emojis en fileEmoji** (🎬🎵📄📊📝📦)
- **Estados de la máquina** (pending→sent→delivered→read→failed)
