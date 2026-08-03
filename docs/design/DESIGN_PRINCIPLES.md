# Emet · Principios de diseño

Los principios son el "por qué" detrás de cada decisión visual. Si una decisión contradice uno de estos, se corrige el diseño, no el principio.

## 1. Un sistema, no una colección

Todos los módulos comparten shell, tokens y componentes. Si una pantalla parece "otra app" (otro color de fondo, otra tipografía, otra altura de botón), es un bug de diseño.

## 2. La interfaz le habla a una persona con prisa

- Una acción primaria por pantalla.
- Los estados (carga, error, vacío) son explícitos y dan una salida.
- Nada de jerga técnica: se dice "Guardar" no "Submit"; "Ya casi" no "Refreshing".

## 3. Forma antes que decoración

- Las superficies usan glass (`blur(20px)`) y bordes de 0.5px para jerarquía, no para lucir.
- Las sombras tienen 3 niveles y solo se suben de nivel cuando el elemento merece elevarse (hover, popover, modal).
- Radios grandes (22/16/11) dan calma; las píldoras marcan estados y acciones de bajo perfil.

## 4. El acento es azul, el resto es neutro

- El color habla: azul = acción, verde = ok, naranja = atención, rojo = peligro, morado = especial/vacaciones.
- Si algo no significa nada de eso, no se pinta de color.
- El mesh de fondo por rol es sutil: acompaña, nunca compite (blend `multiply` en claro, tipo Arc).

## 5. El detalle se siente, no se anuncia

- Micro-interacciones: ripple, swipe con `--spring`, pop de reacción, saludo 👋 una vez por carga, pausa activa con ilustración respirando.
- Nada se mueve "por moverse": el movimiento siempre justifica la jerarquía (segmented control desliza su thumb; el hover eleva la tarjeta).

## 6. Mobile = nativo, Desktop = workspace

- En móvil, los componentes respetan el scrollbar/overlay del navegador; el FAB aparece solo en pantallas chicas (`@media max-width:720px`).
- En desktop, el shell presenta el workspace (sidebar + topbar + mesh), con la escala base 110% para legibilidad.

## 7. El tema oscuro es ciudadano de primera clase

- Todos los tokens tienen su par oscuro (`[data-theme="dark"]`). No es "invertir colores": cada tono se eligió (superficies `#161617/#1C1C1E/#262628`, textos `#F5F5F7/#98989D/#67676C`).

## 8. Preferencia del usuario > preferencia del diseño

- `prefers-reduced-motion` se respeta en TODA la app (globals y `.chat-ws`).
- El tema se puede fijar manualmente; el sistema solo sugiere con `prefers-color-scheme`.

## Derivación

Estos principios concretan el canon y el blueprint. Para el detalle operativo ir a:
- `DESIGN_SYSTEM.md` (cómo se materializan en tokens)
- `DESIGN_FOR_HUMANS.md` (cómo se sienten al interactuar)
- `COPYWRITING.md` (cómo suenan)
