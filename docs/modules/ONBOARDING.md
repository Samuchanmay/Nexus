# Módulo · Onboarding y acceso

Rutas: `/login` · `/mfa/*` · `/fichar` · `/preptour` · `/contact` · Roles: todos (transición).

## Qué es

El ciclo de entrada al sistema: autenticación, **MFA obligatorio para admin/rh**, fichaje diario y tour de primera visita. También cubre el alta de colaboradores (invitación) y el acceso inicial.

## Flujo

1. **Alta** (admin en Personas → Carga): se crea la persona y se invita (correo institucional).
2. **Login** (`/login`): Supabase Auth (SSR cookies, `@supabase/ssr`). Correo institucional `@cert.edu.mx`.
3. **MFA** (`/mfa/*`): obligatorio para `admin` y `rh`; opcional para el resto. TOTP; si falta, se redirige a enrolar.
4. **Fichar** (`/fichar`): la primera acción del día; valida geofence si hay dispositivo GPS.
5. **Preptour** (`/preptour`): tour de primera visita (ver `modules/RECORRIDOS.md` para los recorridos operativos).

## Auth (detalle)

- `@supabase/ssr` 0.5.2: cookies de sesión con refresco automático (`updateSession` en `src/middleware.ts`).
- Middleware protege por ruta según rol (matriz en `src/lib/nav.ts` → `HREF[role][key]`).
- Logout limpia sesión y claves locales (ver `STATE.md`).
- Dominios legacy `nexus-*.vercel.app` aún permitidos en `ALLOWED_ORIGINS`/middleware (deuda, ver `DECISIONES-PENDIENTES.md` P-005/P-007).

## Seguridad de sesión

- MFA TOTP: secreto por usuario, código de recuperación.
- Sesión con expiración y refresh token rotate.
- No se guardan secretos en el cliente (ver `docs/coding/SECURITY.md`).

## Ver también

- `docs/modules/PEOPLE.md` — alta y roles
- `docs/architecture/PERMISSIONS.md` — matriz RLS
- `docs/coding/SECURITY.md` — secretos, VAPID, claves locales
