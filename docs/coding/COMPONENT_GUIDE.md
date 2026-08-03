# Emet · Guía de componentes

## Qué vive en cada capa

1. **Capa os (`src/components/os/`)** — primitivas del Design System. Sin conocimiento de dominio: reciben `label`, `onClick`, `icon`, `tone`; no saben qué es una solicitud ni un chat.
   - `ui.tsx`: `Button`, `Card`, `Skeleton*`, `Field`, `Input`, `Badge`, `EmptyState`, `Dialog`…
2. **Capa chat (`src/components/chat/`)** — componentes del chat. Usan el scope `.chat-ws`, reusan primitivas os.
3. **Capa raíz (`src/components/ui.tsx` y de dominio)** — orquestación: `Toast`, `SlidingSegments`, `Avatar`, `Menu`, `Sheet`, `Pill`, `NotificationBell`, `EmuBanner` y los componentes por dominio (personas, solicitudes, tiempo…).

## Anatomía de un componente

```tsx
"use client";

import { Button } from "@/components/os/ui";
import type { Tone } from "@/components/os/ui";

interface Props {
  label: string;
  tone?: Tone;
  onPress?: () => void;
}

export function Pill({ label, tone = "accent", onPress }: Props) {
  return (
    <span className={`pill pill--${tone}`} aria-hidden={!onPress}>
      {label}
    </span>
  );
}
```

## Reglas

1. **Props tipadas y explícitas**; `interface Props` local por componente. Nada de `props: any`.
2. **Nombre con mayúscula** (PascalCase) para componentes; archivo igual al componente principal.
3. **Un responsable**: primitivas no tocan datos (ni supabase ni zustand); las de dominio sí, y reciben la data por props.
4. **Tema por tokens**: el color se pasa como `tone`/clase token, nunca `#hex` inline. El `Icon` centraliza el set (ver `docs/design/ICONOGRAPHY.md`).
5. **Accesibilidad**: elementos interactivos reales (`<button>`), `aria-label` en icon buttons, foco visible (ver `docs/design/ACCESSIBILITY.md`).
6. **Client/Server**: si el componente usa hooks → `"use client"`. Sin hooks → Server Component (puede recibir datos del server).
7. **Reuso antes que escribir**: antes de crear algo nuevo, buscar en `os/ui.tsx`, `src/components/ui.tsx` y `chat/`. El `Design System` no se duplica en cada pantalla.
8. **Composición**: usar `Card` + `Pill` + `Avatar` juntos para listas, no un componente nuevo monolítico.

## Estados que TODO componente interactivo debe manejar

- `default` · `hover` · `active/pressed` · `focus-visible` · `disabled` · `loading` (si asíncrono) · `error` (si valida). Los que no apliquen, se omiten explícitamente.
- Toque (`scale(.96)`) solo en controles táctiles; hover solo en desktop (ver `docs/design/MOBILE.md`/`DESKTOP.md`).

## Ver también

- `docs/design/COMPONENTS.md` — el catálogo visual completo
- `docs/design/DESIGN_SYSTEM.md` — tokens y el sistema
