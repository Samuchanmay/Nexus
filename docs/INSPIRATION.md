# Emet · Design Inspirations

Emet no copia: **toma decisiones de cada referente y las adapta a su identidad**. Esta página registra de quién se aprende qué, para que las futuras decisiones de diseño tengan un mapa y no vuelvan a inventarse desde cero.

## Apple (design language)

**Qué se toma**
- Superficies translúcidas con `backdrop-filter: blur(20px) saturate(1.5)` (glass), bordes de 0.5px.
- Paleta de tokens: fondos neutros (`#FBFBFD`), textos `#1D1D1F`/`#6E6E73`/`#8A8A90`, acento `#0066FF`, semánticos `#2FB344/#FF8A00/#FF3B30`.
- Tipografía del sistema (`-apple-system`/SF Pro) con antialiasing y `text-rendering: optimizeLegibility`.
- Radios grandes (22/16/11) y sombras suaves de 3 niveles.
- El saludo 👋 animado de "Hoy" y el hero de "Mi Día" heredan el espíritu de los headers grandes de Apple.

**Qué NO se copia**: la densidad de marketing; Emet es una herramienta de trabajo, no una landing.

## Notion

**Qué se toma**
- **Documentación como ciudadano de primera clase**: este mismo `docs/` y los ADRs.
- Espacio para respirar en listas y tarjetas; foco en la legibilidad sobre la decoración.
- La idea de "un solo lugar donde vive el conocimiento del equipo".

**Qué NO se copia**: los bloques libres tipo editor — Emet tiene layouts por módulo, no páginas en blanco.

## Linear

**Qué se toma**
- **El workspace premium del chat** (`.chat-ws`): paleta oscura `#05070B → #08111E → #101827 → #151D2B`, superficies con niveles claros de elevación, acento azul consistente.
- Detalles de ingeniería en la interfaz: skeletons, estados de sync, atajos, velocidad de interacción.
- El principio "el estado de la interfaz siempre es legible" (qué se está cargando, qué quedó pendiente).

**Qué NO se copia**: el tono de producto para desarrolladores — Emet habla para equipos de comunicación y operación.

## Stripe

**Qué se toma**
- **Claridad de formularios y foco**: los inputs de Emet (`.field-input`) usan anillo de foco azul de 4px con tinte — la misma seriedad que Stripe le da a los campos.
- Estados vacíos con acción: nunca una pantalla vacía sin "qué sigue".
- Copy corto y directo (ver `COPYWRITING.md`).

**Qué NO se copia**: el dashboard financiero denso.

## Signal

**Qué se toma**
- **Los gestos de swipe** en las conversaciones: `use-swipe-gesture` revela acciones con un dedo, con transiciones `--spring` y ack visual.
- El respeto por el estado de mensaje: enviado → entregado → leído, con RPC dedicadas (`nx_enlace_mark_*`).
- La privacidad como valor: RLS estricta, datos en Supabase propio.

**Qué NO se copia**: la paleta criptográfica verde/azul.

## Raycast

**Qué se toma**
- **Velocidad de comando**: acciones accesibles desde cualquier pantalla (búsqueda de conversaciones, accesos rápidos).
- La estética "terminal calmada": fondo oscuro profundo, texto de alto contraste, sin ruido.

**Qué NO se copia**: la dependencia de un launcher de teclado; Emet es pointer-first.

## Arc

**Qué se toma**
- **El meshing de fondo**: `data-mesh` en `<body>` con gradientes radiales por rol (`admin`, `empleado`, `rh`, `coordinador`), con `mix-blend-mode: multiply` en claro — heredado de la auditoría "el salto de color entre sidebar y contenido se notaba demasiado; mucho más sutil ahora, tipo Arc".
- La idea de que el fondo participa de la identidad sin competir con el contenido.

**Qué NO se copia**: la barra lateral de navegador; Emet es una app, no un navegador.

## GitHub

**Qué se toma**
- **El flujo de revisión disciplinado**: commits atómicos, ADRs, changelog, roadmap por fases. El repo se mantiene como un proyecto de software serio, no como un script suelto.
- **El directorio/equipo como fuente de verdad**: perfiles, avatares, estados.

**Qué NO se copia**: la densidad de información de un repositorio técnico.

---

## Tabla resumen

| Referente | Se usa para |
|---|---|
| Apple | Tokens, glass, tipografía del sistema, radios, sombras |
| Notion | Docs, espacio, un solo lugar para el conocimiento |
| Linear | Workspace premium del chat, estados, velocidad |
| Stripe | Formularios, foco, empty states, copy |
| Signal | Swipes, estados de mensaje, privacidad |
| Raycast | Acciones rápidas, estética oscura calmada |
| Arc | Mesh de fondo por rol, sutileza de color |
| GitHub | Disciplina de repo: ADRs, changelog, roadmap |
