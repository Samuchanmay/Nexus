# Emet · Stack

## Tabla oficial

| Capa | Tecnología | Versión | Para qué |
|---|---|---|---|
| Framework | Next.js (App Router) | 15.1.11 | SSR, rutas por rol, middleware, static generation |
| UI | React | 19.x | Componentes, hooks |
| Lenguaje | TypeScript | 5.x | Tipado estricto |
| Estilos | Tailwind CSS | 3.4.x | Utilidades + tokens CSS en `globals.css` |
| Backend | Supabase | Postgres + Auth + Realtime + Storage + Edge Functions | Todo el backend |
| Cliente Supabase | `@supabase/ssr` + `@supabase/supabase-js` | 0.5.2 / 2.47.10 | SSR y browser client |
| Movimiento | framer-motion | 12.42.2 | Animaciones que necesitan física |
| Reportes | exceljs | 4.4.0 | Exportación XLSX (server-side) |
| Push | Web Push (VAPID) | — | Notificaciones del chat |
| Correo | Resend | — | Vacaciones + reporte semanal |
| Hosting | Vercel | — | `emet.uno` |

No hay ESLint configurado ni framework de tests (ver `coding/TESTING.md`). El único "linter" es `tsc` durante `next build`.

## Por qué estas tecnologías

1. **Next.js + React 19**: un solo lenguaje (TS) en cliente y servidor; App Router da layouts por rol y middlewares de auth sin infraestructura extra.
2. **Supabase en lugar de backend propio**: Postgres real (triggers, funciones, RLS), Auth con Google + MFA sin escribir servidor, Realtime para el chat, Edge Functions en Deno para integraciones (Google Calendar, Drive, push, correo), y Storage con RLS para el bucket de imágenes del chat. Reduce el backend a SQL + funciones, que es lo que el proyecto ya domina.
3. **Tailwind + CSS custom properties**: los tokens de diseño viven en CSS (`--accent`, `--fs-*`, `--shadow-*`, etc.) y Tailwind se usa para layout; el resultado es un sistema de diseño real sin dependencia de framework UI.
4. **framer-motion**: solo para lo que CSS no alcanza (drag/swipe gestures del chat). El resto de movimiento es CSS puro con las curvas `--ease`/`--spring`.
5. **exceljs**: genera el XLSX de asistencia en la Edge Function (sin depender de hojas de cálculo en el navegador).

## Reglas de stack (canon)

- No se añade una dependencia sin ADR + changelog (ver `EMET_CANON.md`).
- Preferir APIs estándar del navegador a librerías (ej. date pickers nativos, `IntersectionObserver`, `matchMedia`).
- Las Edge Functions corren en Deno y usan `Deno.env.get(...)`; se despliegan con Supabase CLI (config `supabase/config.toml`, `.env` con VAPID_*, RESEND_API_KEY, SUPABASE_URL/KEY).
- Todo secreto vive en variables de entorno; nada hardcodeado en el repo.

## Variables de entorno

**App (Next.js, `src/`)**:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — cliente público.
- `SUPABASE_SERVICE_ROLE_KEY` — solo server/admin.
- `RESEND_API_KEY` — correo.
- `NEXT_PUBLIC_OFICINA_LAT` / `NEXT_PUBLIC_OFICINA_LNG` / `NEXT_PUBLIC_RADIO_MAX_M` — geocerca del checador.

**Edge Functions (`Deno.env.get`)**:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (o service role según función).
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — push del chat.
- `RESEND_API_KEY` — notify-vacation y weekly-attendance-report.
- `ALLOWED_ORIGINS` — CORS de las funciones (incluye dominios legacy `nexus-*.vercel.app` por compatibilidad de deploys).
- Google APIs (`GCLIENT_*` o credenciales equivalentes) — `gcal-*` y `drive-upload`.
