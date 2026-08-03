# Emet · Seguridad

## Superficie

Emet es una app SSR con Supabase (Auth, Postgres RLS, Storage, Realtime) y Edge Functions en Deno. Los principios de seguridad se aplican en 4 capas: transporte/sesión, datos (RLS/RPC), Edge Functions y cliente.

## Sesión y auth

- **MFA obligatorio para `admin` y `rh`** (TOTP); redirección a enrolar si falta. El resto de roles lo tiene opcional.
- `@supabase/ssr` rota el refresh token; las cookies se refrescan en `middleware.ts` (`updateSession`).
- La sesión nunca se guarda en localStorage; se maneja con cookies HttpOnly/seguras del SSR.
- Dominios legacy `nexus-*.vercel.app` siguen en `ALLOWED_ORIGINS`/middleware (deuda registrada P-005; NO añadir más).

## Datos: RLS y RPC

- Toda lectura de filas pasa RLS por rol/jerarquía (matriz en `architecture/PERMISSIONS.md`).
- Las mutaciones complejas pasan por **RPC `nx_*`** que revalidan server-side (p. ej. `min_hours_required`, estados de mensaje).
- Los triggers actualizan saldos; el cliente jamás escribe totales.

## Edge Functions

1. **Verificar credenciales en cada request**: JWT de sesión o secreto propio según el caso.
2. **Secretos vía `Deno.env.get`**, nunca hardcodeados en el repo. Par para Web Push:

   - VAPID **público** (contenido público por diseño, va al cliente):
     `BKcd5cuYmT5NnzqvXgPGhNRHRsfFTGg43jjDEqDNV-FaQ3CcfEql0i9htNBPBXPELzEqDQoFnFn_WlTBQ5sFnVU`
   - VAPID **privado**: solo en secretos de Supabase (`send-chat-push`), NO en código ni docs.
3. Validación de payload: tipos estrictos (`unknown` → validar) antes de tocar la DB o llamadas externas (Google, Drive, Stripe no aplica, etc.).
4. Límites de subida (tamaño/formatos) en el Edge, no solo en el cliente.
5. Zona horaria fija `America/Merida`; nunca confiar en el reloj del cliente para decisiones de negocio (fichaje).

## Cliente

- **Claves locales intencionales** (no son secretos, pero registradas): `nexus-theme` (compatibilidad, P-007), `nexus.context-header.cache`, `nexus:recorridos:visto:<userId>`, `nexus_fichar_queue`, `nexus_device_id`.
- **No guardar nunca**: tokens, VAPID privado, JWT, claves de servicio. El `nexus_fichar_queue` solo contiene operaciones de fichaje pendientes de envío.
- Sanitización de entrada en toda salida a JSX (React lo hace por defecto); `dangerouslySetInnerHTML` prohibido salvo casos revisados.
- `demos-public` (Edge) no expone PII: devuelve solo lo necesario para el caso externo.
- Firma/límite de tokens firmados para `proxy-asset` (acceso a archivos privados).
- Logs: nunca loguear payloads con contraseñas/TOTP/secrets.

## Checklist para código nuevo

- [ ] ¿La ruta está protegida en `nav.ts`/middleware por rol?
- [ ] ¿La lectura está cubierta por RLS?
- [ ] ¿La mutación pasa por RPC validado (si es compleja)?
- [ ] ¿Los secrets van por `Deno.env.get`, no hardcodeados?
- [ ] ¿No se añadió nada a localStorage con datos sensibles?
- [ ] ¿El endpoint público (si existe) sanitiza y no filtra PII?
- [ ] ¿Se respetó `America/Merida` para fechas de negocio?
