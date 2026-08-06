# Recorridos EMET — extensión de Chrome para grabar demos

Captura pantallas de EMET paso a paso y las sube como un "recorrido"
(demo) para el onboarding de empleados en `/preptour`. Consume el mismo
endpoint que ya existía (`src/app/api/demos/ingest/route.ts`) y produce
snapshots compatibles con el reproductor ya integrado
(`src/lib/recorridos/player/*`, componente `SerPlayerFrame`).

## Cómo cargarla en Chrome (sin empaquetar)

1. Abre `chrome://extensions`.
2. Activa "Modo de desarrollador" (interruptor arriba a la derecha).
3. Pulsa "Cargar descomprimida" y selecciona esta carpeta
   (`recorridos-extension/`).
4. Aparecerá el icono de la extensión (genérico, sin ícono propio en
   esta v1) junto a la barra de direcciones. Puedes anclarlo.

No requiere `npm install` ni build: es JS/HTML/CSS plano cargado
directo por Chrome.

## Cómo grabar un recorrido

1. Inicia sesión como **admin** en la pestaña donde vas a grabar
   (`https://emet.uno` o `http://localhost:3000` si pruebas local — el
   endpoint de subida exige rol admin).
2. Abre el popup de la extensión, llena título/slug/descripción/rol
   destino/estado y confirma el servidor (por defecto `https://emet.uno`).
3. "Iniciar grabación".
4. Navega en esa misma pestaña hasta el primer paso que quieras mostrar
   y pulsa "Capturar pantalla actual". Repite por cada paso siguiente.
   El popup se puede cerrar entre capturas — la grabación se guarda en
   `chrome.storage.local` y sigue ahí al reabrirlo.
5. "Deshacer última" quita el último paso si te equivocaste.
6. Cuando termines, "Finalizar y subir". Si algo falla, el mensaje que
   se muestra es el real que devolvió el servidor (nunca un objeto
   crudo ni un genérico que oculte la causa).
7. El recorrido queda como **borrador** (o publicado, según elegiste) y
   aparece en `/preptour` para revisarlo/publicarlo.

## Atajos de teclado (grabar sin abrir el popup)

Mientras una grabación está en curso puedes capturar pantallas desde la
página, sin tener el popup abierto:

- `Ctrl+Shift+E` — capturar la pantalla actual como paso nuevo.
- `Ctrl+Shift+R` — abrir el popup (para revisar / finalizar).

El popup se refresca solo cuando capturas con el atajo. Si no hay una
grabación en curso, el atajo de captura simplemente abre el popup.

## Contador de preparación

Cada captura (botón o atajo) muestra un contador 3-2-1 centrado en la
página para que tengas el cursor y las ventanas fuera del área a capturar:

- `Enter` (o botón "Capturar ahora") — captura de inmediato.
- `Esc` (o botón "Cancelar") — aborta la captura.

El contador es solo visual: la captura se toma justo al terminar, así que
el overlay nunca sale en la pantalla guardada.

## Editor de pasos

Desde "Mis recorridos" → "Editar" puedes:

- **Reordenar** (↑/↓) y **eliminar** pasos.
- **Insertar** una captura nueva en medio de un recorrido ya guardado
  (el botón ➕ captura la pestaña activa y la coloca después del paso
  seleccionado).
- **Editar highlights/blurs** de un paso: la extensión recuerda el
  scroll de ese paso, lo restaura y entra en modo selección (H para
  resaltar, B para ocultar, Esc para terminar).
- **Vista previa** de cada paso con los highlights/blurs escalados al
  tamaño real de la captura.

## Qué captura exactamente

Cada pantalla se serializa a un árbol `SerNode` (mismo formato que
espera `deser.ts`): etiqueta, atributos, y para inputs/selects el
**valor actual** (no solo el atributo HTML). Las URLs de recursos
(`href`, `src`, `poster`, etc.) se capturan ya resueltas a absolutas,
porque el iframe del reproductor no tiene URL base propia.

## Limitaciones conocidas de esta v1

- **Sin Shadow DOM**: no se serializan `shadowRoot` ni
  `adoptedStyleSheets`. Si algún componente de EMET los usa, ese
  fragmento no aparecerá en el demo.
- **Sin `<iframe>`/`<object>` anidados**: se capturan como elemento
  vacío (no se desciende a su `contentDocument`). El resto de la página
  se captura normal.
- **`<script>`/`<noscript>` se omiten siempre**: el reproductor no debe
  ejecutar JS ajeno dentro del iframe de reproducción — es intencional,
  no un bug.
- **Contraseñas**: los campos `type="password"` se capturan con valor
  vacío, nunca el valor real tecleado.
- **Un solo servidor por grabación**: si cambias el campo "Servidor" a
  mitad de una grabación en curso no afecta a esa grabación (ya quedó
  guardada con el servidor que tenía al iniciar); créala de nuevo si
  necesitas cambiarlo.

## Estructura

```
recorridos-extension/
├── manifest.json        Manifest V3, service worker (atajos globales) + popup
├── background.js        Service worker: captura con Ctrl+Shift+E y abre popup
├── popup.html/.css/.js  UI del popup y orquestación de captura/subida/edición
├── content-capture.js   Serializador DOM → SerNode, inyectado bajo demanda
├── countdown.js         Contador 3-2-1 de preparación antes de cada captura
├── select-mode.js       Modo selección: highlights/blurs por clic sobre el DOM
└── README.md
```
