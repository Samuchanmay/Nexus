# Fix: tema oscuro se perdía al entrar a /chat (Agosto 2026)

> ⚠️ **No revertir ni "limpiar" `readStoredTheme()` / el `useEffect` de
> auto-sanación en `src/lib/theme.tsx`.** Se agregaron a propósito para
> corregir el bug descrito abajo, confirmado en producción. Si algo se
> quiere refactorizar en ese archivo, mantener el mismo comportamiento:
> el estado inicial se lee de `localStorage`/preferencia de sistema (no
> del DOM), y el `data-theme` del `<html>` se re-aplica si no coincide.

## Síntoma

Con el sistema operativo en modo oscuro, al entrar a `/chat` la app se
quedaba en modo claro y no volvía a modo oscuro solo, ni siquiera al
refrescar. En un intento de arreglarlo manualmente, el problema se
volvió más grave: el modo claro se quedaba pegado **globalmente**, en
cualquier pestaña, incluso después de refrescar.

## Causa raíz

`/chat` (`src/app/chat/layout.tsx`) tiene `export const dynamic =
"force-dynamic"` y hace 6+ consultas async a Supabase antes de poder
renderizar (perfil, RPC de canal de Anuncios, conversaciones,
participantes, heartbeats, estado propio por conversación). Es, por
lejos, la ruta más pesada/lenta de la app para hidratar.

El `<html>` recibe su atributo `data-theme="dark"` de un script inline
en `src/app/layout.tsx` que corre antes del primer render (para evitar
parpadeo). Ese script funciona bien — el problema es lo que pasa
**después**: se confirmó en vivo (`emet.uno/chat`, DevTools) que en esa
ruta pesada el atributo `data-theme` terminaba en `null` al terminar de
cargar, **aunque `localStorage.nexus-theme` seguía diciendo
correctamente `"dark"`**. En `/inicio` (ruta liviana) esto no pasaba.

`ThemeProvider` (`src/lib/theme.tsx`) se monta de cero en cada layout de
nivel superior (vía `AppShell`), y su estado inicial se leía
**directamente del atributo del DOM** en ese momento:

```tsx
const [theme, setTheme] = useState<Theme>(() => {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
});
```

En `/chat`, para cuando este código corría, el atributo ya estaba
limpio (por la hidratación tardía de esa ruta pesada) — así que el
Provider heredaba el valor ya roto y **nunca lo corregía**, aunque
`localStorage` tuviera el valor correcto todo el tiempo.

### Por qué se volvió global y persistente

Al ver la app en modo claro (aunque el sistema estuviera en oscuro), el
intento de arreglo manual incluyó tocar el botón de alternar tema. Ese
botón (`toggle()` en `src/components/os/shell.tsx`) decide a qué modo
cambiar según el estado de React (`theme`), no según lo que se ve en
pantalla. Si React seguía creyendo `theme === "dark"` (porque en algún
momento sí lo leyó bien) pero el DOM mostraba claro, tocar el botón
mandaba a `"light"` de verdad — y **esa sí se escribe en
`localStorage`**. A partir de ahí, el valor guardado quedó en `"light"`
para siempre, en cualquier pestaña/ruta, hasta el próximo toggle manual.

## Solución aplicada

`src/lib/theme.tsx`:

1. El estado inicial de `ThemeProvider` ya no lee el atributo del DOM.
   Lee `localStorage.nexus-theme` (o la preferencia de sistema como
   respaldo) — la misma regla que usa el script inline de
   `layout.tsx` — vía la función `readStoredTheme()`.
2. Un `useEffect` nuevo compara ese estado contra el atributo real del
   `<html>` al montar y, si no coinciden, **corrige el DOM** (lo
   llamamos auto-sanación). Esto pasa después de que termine el commit
   de React, así que corrige el atributo aunque algo lo haya limpiado
   durante la hidratación de la ruta.

Con esto, cualquier ruta — incluida `/chat` — se auto-corrige sola al
montar el Provider, sin depender de que el DOM ya esté bien en ese
momento. Y como el DOM deja de mostrar un modo incorrecto, ya no hay
motivo para que un toggle manual "confirme" un valor equivocado en
`localStorage`.

## Verificación

Reproducido y confirmado en `emet.uno/chat` con Chrome (DevTools/JS)
antes del fix: `data-theme` quedaba en `null` con `localStorage` en
`"dark"`, de forma consistente (2/2 intentos). `/inicio` no mostraba el
problema. El fix es aditivo — no cambia el comportamiento cuando el DOM
ya está correcto (caso normal en el resto de la app).

## Archivos tocados

- `src/lib/theme.tsx` — único archivo modificado para este fix.
