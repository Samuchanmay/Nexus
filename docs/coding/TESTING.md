# Emet · Testing

## Estado actual

- **No hay suite de tests configurada.** `package.json` no tiene scripts de test ni dependencias de testing (sin ESLint tampoco).
- Decisión pendiente registrada en `docs/DECISIONES-PENDIENTES.md` **P-004**: no se ha elegido el framework (Vitest vs Jest vs Playwright).

## Lo que SÍ se verifica hoy

| Nivel | Práctica |
|---|---|
| Compilación | `npm run build` (Next 15) — debe pasar sin errores |
| Migraciones | Aplicación secuencial en base de referencia + schema.sql consistente |
| Edge Functions | `deno check` / deploy sin errores (Deno) |
| RLS | Revisión manual del acceso por rol en las rutas críticas |
| Accesibilidad | Revisión manual (Lighthouse + tab + lectores) en rutas clave |
| Manual | Smoke de flujos críticos: login+MFA, fichar, chat, vacaciones, reporte |

## Qué se debería probar cuando exista framework (P-004)

1. **RPC/triggers** (lo más valioso): saldos de vacaciones, validación de `min_hours_required`, estados de mensaje.
2. **RLS**: matrices de acceso por rol (admin vs empleado vs coordinador).
3. **Decision engine EMU**: casos deterministas (sin LLM) — reglas, prioridad, contexto.
4. **Flujos E2E**: login → MFA → Mi Día; chat 1:1 con reacción/read receipt; solicitud → aprobación → cobertura.

## Recomendación al resolver P-004

- `vitest` para unit/integration de RPC y EMU (rápido, TS nativo).
- `playwright` para E2E de los flujos críticos (SSR + Realtime).
- `pgTAP` opcional si se quiere testar RLS/triggers dentro de Postgres.

## Regla mientras no exista la suite

1. Todo cambio de RPC/trigger se acompaña de un caso manual reproducible documentado en el PR/commit.
2. El build es la puerta: si `npm run build` falla, no hay commit.
