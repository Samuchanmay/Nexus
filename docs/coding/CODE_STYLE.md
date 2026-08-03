# Emet · Estilo de código

## Base

- **TypeScript estricto** en todo el stack (`tsconfig.json`): `strict: true`, tipos explícitos en bordes (props, RPC, Edge Functions).
- **React 19 + Next.js 15** (App Router): componentes "use client" solo cuando hay interactividad; Server Components por defecto.
- **Tailwind CSS 3.4** + tokens CSS: los colores/radios/sombras SIEMPRE por variable (`var(--...)` de `globals.css`), nunca valores sueltos.

## Reglas no negociables

1. **Cero comentarios de relleno.** Un comentario explica un *porqué* no obvio (decisión, tradeoff), nunca el qué (el código ya lo dice). El rebrand dejó comentarios limpios en `src/` y `supabase/` — mantenerlos así.
2. **Nombres en español** para dominio (`solicitudes`, `asistencia`, `saldo_vacaciones`, `personas`); **inglés** para infraestructura técnica (`updateSession`, `CookieOptions`, `middleware`). La mezcla es intencional: el dominio pertenece al negocio.
3. **Dos espacios**, UTF-8, `lf`. Prettier de hecho: el código del repo ya está formateado así.
4. **Componentes:** funciones puras, sin efectos colaterales en render, props tipadas explícitamente (ver `COMPONENT_GUIDE.md`).
5. **Sin `any`** salvo en bordes tipo `as any` justificado en utilidades de RPC/Supabase (y entonces con comentario de porqué).
6. **Código muerto = borrado.** No dejar componentes/constantes sin usar (el rebrand eliminó `NexusMark` precisamente por esto).

## Estructura de un archivo de componente

```
imports (externos → locales)
tipos locales / interfaces de props
constantes (colores, opciones, defaults)
componente(s) puros
helpers / utilidades privadas al archivo
```

## Server vs Client (importante)

- Archivos con hooks (useState/useEffect/useRealtime) o handlers de evento → `"use client"` al inicio.
- Lógica de datos en Server Components (listas iniciales, metadata) se mantiene sin la directiva.
- El acceso a Supabase del servidor usa las cookies del SSR (ver `REACT.md`/`SUPABASE.md`).

## Verificación

- No hay linter configurado (sin ESLint en `package.json`; decisión pendiente P-004).
- Regla práctica: `npm run build` debe pasar sin errores antes de commitear.
