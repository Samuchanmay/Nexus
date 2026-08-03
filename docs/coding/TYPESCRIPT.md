# Emet · TypeScript

## Configuración base

- `strict: true` en `tsconfig.json`. Todo el repo está tipado; los bordes de Supabase/RPC se tipan con generics.
- **React 19 / Next 15**: los componentes tipan sus props con `interface Props`; Server Components no necesitan la directiva `"use client"`.

## Tipos de dominio

- Los tipos del modelo viven junto a su dominio (ej. tipos de chat cerca de `src/components/chat/`; tipos de EMU en `src/lib/emu/types.ts`).
- Se evita duplicar el esquema de la DB: cuando la DB define algo (tablas, enums, RPC), el tipo del cliente es el "contrato" del RPC, no una copia manual de toda la tabla.

## Reglas

1. **Sin `any` suelto.** En bordes de librerías/RPC se permite `as` con justificación y comentario (el porqué, no el qué).
2. **`unknown` antes que `any`** en funciones que reciben datos externos (Edge Functions, payloads de webhooks).
3. **Generics para RPC**: `supabase.rpc("nx_enlace_mark_read", { p_id: id })` con los tipos del helper; el resultado se valida antes de usar.
4. **Union types para estados**: `type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada" | "cancelada"` — los estados se modelan como unions, no como strings sueltos.
5. **NonNullable en render**: el acceso a datos opcionales se desenvuelve una vez (`const msg = data?.[0]`) y luego se trata como presente; evitar `?.` en cascada en JSX.
6. **Fecha**: los timestamps viajan ISO (`string`); el formateo vive en `tz.ts` y utilidades de tiempo. Nunca `Date` en props de componentes de presentación.
7. **Enums de negocio en DB**: preferir enums/check constraints de Postgres para estados; el tipo TS los refleja como union.

## Errores comunes a evitar

- `props: any` en componentes (rompe el contrato).
- `as` para silenciar errores de forma en vez de tipar el origen.
- Copiar `Prisma`-style types completos cuando el RPC ya valida el payload.
- Timestamps mal tipados (number vs string) entre Edge Functions y cliente.
