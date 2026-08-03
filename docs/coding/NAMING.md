# Emet · Convenciones de nombres

## Dominio (español)

| Objeto | Convención | Ejemplos |
|---|---|---|
| Tablas | `snake_case`, plural | `personas`, `solicitudes`, `saldo_vacaciones`, `dias_inhabiles` |
| Columnas | `snake_case`, singular | `fecha_hora`, `aprobado_por`, `min_hours_required` |
| RPC | prefijo `nx_` | `nx_enlace_toggle_mute`, `nx_enlace_mark_read` |
| Edge Functions | `kebab-case` | `send-chat-push`, `weekly-attendance-report` |
| Migraciones | `NNNN_nombre.sql` | `0015_chat_rpc.sql` |
| Buckets | `kebab-case` | `chat-files` |
| Rutas | `kebab-case` | `/admin/asistencia`, `/admin/config/horarios` |

## Código

| Objeto | Convención | Ejemplos |
|---|---|---|
| Componentes | `PascalCase` | `EmuBanner`, `PausaActivaPopup` |
| Hooks | `useCamelCase` | `use-outbox`, `use-swipe-gesture`, `use-typing` |
| Funciones/constantes | `camelCase` | `updateSession`, `formatPresence` |
| Módulos server/client | prefijo por rol | `client.ts`, `server.ts` (patrón Supabase) |
| CSS clases | `kebab-case`, prefijos por capa | `v6-*`, `chat-ws`, `conv-card`, `.pill--tone` |

## Reglas

1. **El dominio manda**: tablas/columnas/RPC en español de negocio; la infraestructura (SSR, Deno, cookies) en inglés técnico. Documentado en `CODE_STYLE.md` §nombres.
2. **Prefijos de scope**: `v6-*` para el design system actual, `chat-ws`/`conv-*` para el workspace del chat, `nx_*` para RPC (no renombrar: deuda P-005, ver `DECISIONES-PENDIENTES.md`).
3. **Nada de abreviaturas crípticas**: `min_hours_required`, no `mhr`. `api`, no `ap`.
4. **Constantes de dominio** en mayúsculas con guion bajo: `PRIORITY_RANK`, `ZONE`, `ROLES`.
5. **Consistencia en mensajes de error** (slugs server en español): `archivo-muy-grande`, no `file_too_big` ni `E4032`.

## Qué NO hacer

- No mezclar `snake_case` con `camelCase` dentro de la misma capa de datos.
- No inventar rutas fuera de `src/lib/nav.ts`.
- No renombrar columnas legacy (`nexus_clave`, `nexus_color`) sin migración planeada (P-005).
