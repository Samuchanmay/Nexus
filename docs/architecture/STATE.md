# Emet · Estado

## Dónde vive cada estado

| Estado | Fuente | Persistencia |
|---|---|---|
| Sesión (Google) | Supabase Auth | Cookies (`@supabase/ssr`) |
| Perfil / datos de negocio | Supabase (RLS) | Servidor Supabase |
| Tema (claro/oscuro) | `localStorage` (`nexus-theme`) + `data-theme` en `<html>` | localStorage |
| Vista activa del hub | URL (query) + `persisted-view.ts` | localStorage por usuario |
| Bandeja de mensajes no leídos | Realtime + `use-unread-count` | En memoria |
| Mensajes offline (chat) | `use-outbox` (cola) | localStorage (`client_id` en `messages`) |
| Peticiones ignoradas de EMU | `EmuDecision.offerAutoRemind` | En memoria (Fase 1) |
| Recorridos vistos | `nexus:recorridos:visto:<userId>` | localStorage |
| Queuedo de checada offline | `nexus_fichar_queue` | localStorage |
| Dispositivo del quiosco | `nexus_device_id` | localStorage |

> El canon: **la URL es el estado de navegación** (hubs resuelven la vista en `nav.ts`), el tema y el estado offline viven en localStorage, y todo dato de negocio vive en Supabase. No hay store global (Redux/Zustand): se usa contexto React localizado.

## Flujo server → client

1. `page.tsx` (server) autentica con `server.ts` y trae datos iniciales.
2. Pasa props serializables a componentes cliente (`"use client"`).
3. El cliente suscribe a cambios (Realtime en chat) y refetches puntuales.

**Convención**: el servidor filtra (RLS) y el cliente presenta. Nunca pasar a un client una query sin RLS.

## Chat: outbox offline (`src/lib/chat/use-outbox.ts`)

- Cada mensaje del usuario recibe un `client_id` (UUID) al momento de enviarse → `messages.client_id` lo hace idempotente.
- Si no hay red, el mensaje se encola con estado `sending`/`failed` y `MessageStatus` lo muestra (✓, ✓✓, reloj).
- Al reconectar, la cola reenvía; el server ignora duplicados por `client_id`.
- Reacciones/adjuntos también pasan por la cola para no perder trabajo.
- **Multi-pestaña**: `BroadcastChannel` (`emet-chat-outbox`) — cuando una pestaña encola un optimista o lo lleva a `failed`, las demás pestañas de la misma conversación lo reflejan al instante (el INSERT confirmado lo cubre Realtime con dedupe por `client_id`).

## Tema (sin FOUC)

- `layout.tsx` inyecta un script inline que lee `nexus-theme` (o `prefers-color-scheme`) antes del primer render y fija `data-theme`.
- `ThemeToggle` escribe la misma clave. Renombrar la clave rompe el tema de sesiones existentes (ver P-005/P-007).

## EMU: contexto único

`EmuContext` se construye una vez (Context Engine) y todas las reglas leen de él — las reglas son funciones puras (testeables sin red). El Decision Engine elige **un solo** ganador por prioridad (`PRIORITY_RANK`); la Surface (`EmuBanner`, toasts, popups) solo presenta.

## Estados de la jornada (colaborador)

`src/lib/domain/attendance/` + `jornada-flow.ts` derivan de `attendance` + `schedules` el estado actual: sin iniciar / en jornada / pausado / terminado, horas acumuladas vs `target_min`, y los pendientes de salida (`pending-exits.ts`). `JornadaWatcher` dispara recordatorios (pausa activa, salida pendiente) con base en el reloj.

## Ver también

- `docs/architecture/EVENTS.md` — cómo fluyen los cambios (Realtime, triggers, push)
- `docs/architecture/PERFORMANCE.md` — decisiones de costo de render
