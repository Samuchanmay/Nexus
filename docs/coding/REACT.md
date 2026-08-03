# Emet · React

## Patrón de arquitectura

- **App Router (Next 15)**: Server Components por defecto; `"use client"` solo cuando hay interactividad.
- **Composición por capas**: os (primitivas) → raíz/dominio (orquestación) → páginas. Ver `FILE_STRUCTURE.md`.
- **Estado**: mínimos clientes. Las listas iniciales se cargan en Server Component y la interactividad usa hooks acotados. Estado global solo donde hace falta (sesión, tema).

## Reglas

1. **Hooks de negocio en `src/lib`** o en `src/components` específicos (`use-outbox`, `use-swipe-gesture`, `use-typing`, `use-realtime`). No esparcir la lógica en las páginas.
2. **Realtime con cleanup**: los canales de Supabase (`channel(...).on(...).subscribe()`) se suscriben en `useEffect` con `return () => channel.unsubscribe()` (patrón ya usado en el chat).
3. **Skeletons**: contenido de carga con los `Skeleton*` del kit, `aria-hidden` (ver `ACCESSIBILITY.md`), sin "loading" parpadeante.
4. **Formularios controlados solo cuando hace falta**: para forms largos se controlan los campos relevantes; no re-renderizar toda la página por cada keystroke.
5. **Optimistic UI solo en flujos con retry claro** (chat: `use-outbox` con `client_id`); de lo contrario, esperar confirmación del server y mostrar estado.
6. **Client components no cuelgan de nada del server**: la data llega por props o se carga con hooks; no acceder a cookies/supabase server desde client.
7. **Event handlers nombrados por intención**: `handleSave`, `handleToggleMute`, no `onClick` anónimos largos.
8. **Nada de `useEffect` para derivar estado calculable**: los valores derivados se calculan en render (o con `useMemo`).

## Anidamiento y rendimiento

- Extraer subcomponentes solo cuando hay estado propio o rendimiento real; no atomizar por atomizar.
- `React.memo` solo donde hay re-render medible (listas de chat); no en primitivas baratas.
- Framer Motion (12.42.2) se usa para micro-interacciones de UI (pops, slides); para scroll/posición usar CSS primero.
- Respetar `prefers-reduced-motion` (la utilidad global ya lo hace).

## Ver también

- `docs/coding/REACT.md` ↔ `docs/architecture/STATE.md` (estado global y offline)
- `docs/coding/COMPONENT_GUIDE.md` — contrato de componentes
