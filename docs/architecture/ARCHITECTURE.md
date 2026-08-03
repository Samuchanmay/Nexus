# Emet · Arquitectura

## Visión de conjunto

```
┌────────────────────────────── Browser (Next.js 15 · App Router) ──────────────────────────────┐
│  pages/layouts (RSC por defecto) ──→ componentes cliente (AppShell, módulos)                  │
│         │                                                                                     │
│  src/middleware.ts: auth + MFA gate + canonical host (emet.uno)                                │
└─────────┬───────────────────────────────────────────────┬─────────────────────────────────────┘
          │ @supabase/ssr (server)                        │ Supabase JS client (browser)
          ▼                                               ▼
┌─────────────────────── Supabase ────────────────────────────────────────────────────────────┐
│  Postgres (schema en supabase/schema.sql + migraciones 0002-0024)                            │
│     · RLS por rol (security definer: my_role(), my_user_id())                                 │
│     · Triggers: auth→users, balance de vacaciones, horarios, un-activo-por-tarea              │
│     · Realtime: chat (conversations/messages)                                                 │
│  Auth: Google OAuth + MFA (TOTP)                                                              │
│  Storage: bucket `chat-files` (privado, RLS, pipeline WebP)                                   │
│  Edge Functions (12): fichar, chat push, gcal, drive, notify, reportes, demos, proxy          │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
          │ Resend (correo vacaciones/reporte) · Google APIs (Calendar/Drive) · Web Push (VAPID)
```

## Capas

### 1. Capa de presentación (Next.js 15 App Router)

- **Server Components** por defecto: `page.tsx` obtiene datos con el client server de Supabase (`@supabase/ssr`, `src/lib/supabase/server.ts`) y pasa el mínimo necesario al cliente.
- **Client Components** con `"use client"` para interactividad (shell, módulos, chat).
- **Rutas por rol**: `/admin`, `/comunicacion`, `/coordinador`, `/rh` con layouts que cargan el perfil del usuario y montan el `AppShell`. La navegación se resuelve contra `src/lib/nav.ts` (`HREF[role][key]`), única fuente de verdad de URLs.
- **Middleware** (`src/middleware.ts`):
  1. Redirige hosts legacy → `emet.uno` (308).
  2. Session check (con manejo de "refresh race" para no expulsar usuarios con sesión válida).
  3. Gate MFA para roles `admin` y `rh`.

### 2. Capa de dominio (lógica compartida en `src/lib/`)

- `src/lib/domain/attendance/`: cálculo de estado de asistencia (presente/retardo/ausente, cumplimiento de objetivo).
- `src/lib/calendar-core.ts` + `calendar-grid.ts`: motor de calendario (eventos, rango, rejilla).
- `src/lib/emu/`: EMU (context → decision → surface).
- `src/lib/chat/`: hooks y utilidades del chat (outbox, swipe, push, typing, unread, audio, upload).
- `src/lib/recorridos/`: player de demos guiadas (diff de DOM).

### 3. Capa de datos (Supabase)

- Esquema canónico en `supabase/schema.sql`; cambios incrementales en `supabase/migrations/00NN_*.sql` (24 migraciones).
- RLS es **la** frontera de seguridad: cada tabla tiene policies que usan `public.my_role()` y `public.my_user_id()` (security definer).
- Realtime habilitado para el chat; el resto usa polling/refetch dirigido.
- Edge Functions para lo que el navegador no debe hacer: envío de push, correo, OAuth de Google, subida a Drive, reportes.

### 4. Caché y estado del cliente

- Tema: `localStorage` (`nexus-theme`) + script inline en `layout.tsx` (evita FOUC).
- Offline de chat: `use-outbox` encola mensajes y los reenvía (ver `docs/architecture/STATE.md`).
- Sin librería de estado global: se usa contexto de React localizado + URL como estado de navegación.

## Flujos principales

### Checado (fichar)
`fichar/page.tsx` → la Edge Function `fichar` valida hora/tolerancia/GPS → inserta en `attendance` → `JornadaWatcher`/`jornada-flow` actualizan "Mi Día". El quiosco usa `nexus_device_id` (identidad de dispositivo) + cola local `nexus_fichar_queue` para offline.

### Solicitud → Proyecto
`requests` (con prioridad, tipo, horas mínimas) → al aprobarse se crea `projects` + `project_assignments` + checklist del template → el equipo trabaja con `task_time_logs` y sube `evidences` → se publica en biblioteca con `publish_url`.

### Vacaciones
`vacations` → aprobación (admin, con trigger de saldo en `approve_vacation`) → Edge `notify-vacation` (Resend) → se agrega al calendario de Google (campo `calendar_event_id`) → visible en el calendario del equipo.

### Chat
`conversations`/`messages`/`message_attachments`/`message_reactions` con RLS + RPC (`nx_enlace_*`) → Realtime para mensajes nuevos → `send-chat-push` para notificar fuera de la app → `smart-image` renderiza la pipeline WebP del bucket privado.

## Convenciones transversales

- **Toda consulta del servidor** pasa por `src/lib/supabase/server.ts` (client con cookies) o `admin.ts` (service role, solo en Edge Functions / rutas sensibles).
- **Toda ruta nueva** se declara en `nav.ts`; ninguna URL se escribe a mano en el sidebar.
- **Errores**: `RouteError` como boundary de ruta; toasts con shake para errores de acción.
- **Carga**: skeletons (`os/ui.tsx`) o `DelayedFallback`.

## Ver también

- `STACK.md` — tecnologías y por qué
- `DATABASE.md` — esquema, migraciones, funciones
- `API.md` — endpoints HTTP y Edge Functions
- `PERMISSIONS.md` — roles, RLS, MFA
- `STATE.md` — estado del cliente y datos
- `EVENTS.md` — triggers, Realtime, notificaciones, push
- `PERFORMANCE.md` — decisiones de rendimiento
