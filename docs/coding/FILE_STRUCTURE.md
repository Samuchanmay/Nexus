# Emet · Estructura de archivos

## Árbol de alto nivel

```
/
├─ docs/                  # Documentación canónica (este árbol)
├─ public/                # manifest.json (EMET), favicon, estáticos
├─ src/
│  ├─ app/                # App Router (rutas por dominio)
│  ├─ components/         # UI: os/, chat/, ui.tsx y componentes de dominio
│  ├─ lib/                # Lógica: nav, tz, emu/, supabase (server/client)
│  └─ middleware.ts       # Sesión + guards de ruta por rol
└─ supabase/
   ├─ functions/          # 12 Edge Functions (Deno)
   ├─ migrations/         # 0002 … 0024 (DDL + RPC + triggers)
   ├─ schema.sql          # Schema canónico (432 líneas)
   └─ seeds/              # Seeds de referencia
```

## `src/app` — rutas por dominio

```
app/
├─ login/ mfa/ fichar/ contact/ legal/ os/ preptour/   # acceso y utilidades
├─ comunicacion/*        # hub de comunicación (chat integrado)
├─ admin/*               # asistencia, empleados, solicitudes, config/*, calendario…
├─ coordinador/ rh/      # hubs por rol
└─ chat/                 # chat (lista + [id])
```

La navegación real y los guards viven en `src/lib/nav.ts` (`NAV`, `HREF[role][key]`, `DOMAIN_VIEWS`); NO inventar rutas fuera de ese mapa.

## `src/components` — tres capas

| Capa | Contenido | Regla |
|---|---|---|
| `os/` | Design System: `AppShell`, `Icon`, `DomainTabs`, `NotificationBell`, `EmuBanner`, `PausaActivaPopup`, `ui.tsx` (Button, Card, Field, Input, Badge, Dialog…) | Tokens globales; no conoce dominios |
| `chat/` | 9 componentes del chat (burbujas, lista, composer, adjuntos…) | Scope `.chat-ws`; reusa capa os |
| raíz `src/components` | `ui.tsx` (Toast, SlidingSegments, Avatar, Menu, Sheet, Pill…), componentes de dominio | Orquestan os/chat |

## `src/lib`

- `nav.ts` — navegación, roles y hubs (fuente de verdad de rutas).
- `tz.ts` — zona horaria `America/Merida`.
- `emu/` — `types`, `rules`, `decision-engine`, `context-engine` (EMU determinista, sin LLM).
- `supabase/` — clientes server/client del SSR (patrón oficial `@supabase/ssr`).

## `supabase/functions`

Una carpeta por Edge Function: `fichar`, `send-chat-push`, `notify-vacation`, `weekly-attendance-report`, `gcal-list-events`, `gcal-create-event`, `gcal-delete-event`, `drive-upload`, `proxy-asset`, `demos-ingest`, `demos-list`, `demos-public`. Cada una con su `index.ts`.

## Reglas

1. Un archivo de componente = un componente principal + sus ayudantes privados.
2. Las utilidades compartidas van a `src/lib` (no se copian en cada pantalla).
3. Las migraciones son **additivas**: 0002…0024, nunca editar una aplicada (ver `changelog/MIGRATIONS.md`).
4. El schema canónico en `supabase/schema.sql` refleja el estado final; las migraciones cuentan la historia.
