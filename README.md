# EMET · Sistema operativo para organizaciones

EMET es una plataforma web para organizaciones que centraliza la comunicación, la operación, la gestión del tiempo y la colaboración de los equipos en un solo lugar. Un solo proyecto · un dominio (`emet.uno`) · un login con Google.

> **Documentación canónica en [`/docs`](docs/00-README.md).** Todo lo que una IA o un desarrollador necesita antes de tocar código vive ahí: visión, blueprint, arquitectura, diseño, módulos, reglas de código, ADRs y changelog.

## Puesta en marcha rápida

```bash
cp .env.example .env.local   # completa las variables
npm install
npm run dev                  # http://localhost:3000
```

Requisitos de entorno: Supabase (base de datos + Auth + Edge Functions + Storage), Google OAuth, Resend (correo), Vercel (hosting) y las 12 Edge Functions de `supabase/functions/`.

## Mapa de documentos

| Doc | Qué es |
|---|---|
| [`docs/00-README.md`](docs/00-README.md) | Qué es Emet, cómo levantarlo, cómo colaborar |
| [`docs/01-VISION.md`](docs/01-VISION.md) | Por qué existe, qué resuelve, qué NO hará nunca |
| [`docs/02-BLUEPRINT.md`](docs/02-BLUEPRINT.md) | La filosofía completa del producto |
| [`docs/03-ROADMAP.md`](docs/03-ROADMAP.md) | Qué existe, qué falta, qué viene |
| [`docs/EMET_CANON.md`](docs/EMET_CANON.md) | Reglas inmutables del proyecto |
| [`docs/AI_RULES.md`](docs/AI_RULES.md) | Reglas obligatorias para cualquier IA que contribuya |

La arquitectura está en `docs/architecture/`, el sistema de diseño en `docs/design/`, los módulos en `docs/modules/`, las reglas de código en `docs/coding/`, las decisiones en `docs/decisions/` y el historial en `docs/changelog/`.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind |
| Backend | Supabase (Postgres + Auth + Edge Functions + Realtime + RLS) |
| Auth | Google OAuth con whitelist en `public.users` + MFA (TOTP) |
| Correo | Resend (vacaciones + reporte semanal) |
| Push | Web Push (VAPID) vía Edge Function `send-chat-push` |
| Hosting | Vercel · dominio canónico `emet.uno` |

## Colaborar

1. Lee `docs/EMET_CANON.md` y `docs/AI_RULES.md` antes de escribir código.
2. Todo cambio se documenta: `docs/decisions/` si hay decisión, `docs/changelog/CHANGELOG.md` siempre, `docs/03-ROADMAP.md` si aplica.
3. Nunca crear componentes duplicados ni romper el sistema de diseño.

Hecho con ❤️ por Samu Chan.
