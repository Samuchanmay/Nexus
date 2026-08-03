# Emet · Supabase

## Stack

- `@supabase/supabase-js` 2.47.10 · `@supabase/ssr` 0.5.2.
- Edge Functions en **Deno** (12 funciones: `fichar`, `send-chat-push`, `notify-vacation`, `weekly-attendance-report`, `gcal-*`, `drive-upload`, `proxy-asset`, `demos-*`).

## Clientes

- **Server**: `src/lib/supabase/server.ts` — lee cookies del SSR (`createServerClient`); se usa en Server Components y rutas.
- **Client**: `src/lib/supabase/client.ts` — `createBrowserClient`; se usa en `"use client"`.
- **Middleware** (`src/middleware.ts`): `updateSession` refresca cookies de sesión y protege rutas por rol. Nunca crear un cliente Supabase nuevo por petición sin pasar por el patrón SSR.

## Schema

- Canónico en `supabase/schema.sql` (432 líneas); historial en `supabase/migrations/0002…0024` (additivas, no editar aplicadas).
- Single-tenant (nota en `0011_enlace_mvp.sql`); se contempla futuro `organization_id`.
- Roles de negocio: `admin`, `empleado`, `coordinador`, `departamento`, `rh`.

## Acceso a datos

| Operación | Mecanismo |
|---|---|
| Lectura de listas | RLS (fila por rol/jerarquía) |
| Mutaciones complejas (chat, solicitudes, saldos) | **RPC `nx_*`** (atómico, validado, con auditoría) |
| Notificaciones/push | Edge `send-chat-push`, `notify-vacation` |
| Realtime | Canales por conversación/dominio (chat), suscripción con cleanup |
| Archivos | Storage buckets: `chat-files` **privado** (WebP thumb/medium/original), `proxy-asset` para acceso firmado |

## RLS — principios

1. La fila se permite solo si el `user_id` coincide con la jerarquía del rol (ver `architecture/PERMISSIONS.md`).
2. Los RPC revalidan server-side lo que la UI sugiere (ej. `min_hours_required` en solicitudes).
3. Los triggers actualizan saldos/asistencia (nunca en cliente).

## Edge Functions — reglas

1. Verifican el JWT de sesión (o su propio secreto, como VAPID en `send-chat-push`) en cada request.
2. Zona horaria fija `America/Merida` para fechas (nunca `new Date()` a secas).
3. Errores con slugs en español (`archivo-muy-grande`); la UI traduce.
4. Secrets vía `Deno.env.get` (nunca hardcodear; ver `SECURITY.md`).

## Migraciones — reglas

1. Additivas: `NNNN_nombre.sql`, una dirección.
2. Reflejar SIEMPRE en `supabase/schema.sql` el estado final tras aplicar.
3. Migrar datos viejos con SQL idempotente (no destructivo).
4. RPC nuevos con prefijo `nx_`; buckets/storage incluidos como migración (ej. 0024).
