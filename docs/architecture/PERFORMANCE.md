# Emet · Rendimiento

Principio: **Emet debe sentirse instantáneo para un equipo pequeño, sin caro infraestructura.** Las decisiones de rendimiento están pensadas para una organización de decenas de personas, no para millones de usuarios.

## Decisiones estructurales

1. **Server Components por defecto.** `page.tsx` resuelve datos en el servidor; el cliente solo recibe lo que va a pintar. Menos JS y menos round-trips.
2. **RLS como filtro** en Supabase: el servidor nunca baja datos de más; cada query devuelve solo lo que el rol puede ver.
3. **Realtime solo donde hace falta** (chat). El resto usa refetch dirigido/on-demand — no hay polling global.
4. **Sin store global**: evitar re-renders en cascada; el estado vive donde se usa.
5. **Imágenes del chat optimizadas**: pipeline WebP (thumb/medium/original) en `chat-files`, render con `SmartImage`, acceso vía URL firmada/proxy en vez de exponer el bucket.
6. **Escala tipográfica base 110%** (`html { font-size: 110% }`) en lugar de `zoom` (estándar, sin distorsión de hit-testing ni scroll horizontal). En móvil se respeta 100% para no generar scroll horizontal.
7. **Build estático donde es posible**: rutas públicas (`/login`, `/legal/*`, `/contact`, `/os`, sitemap/robots/manifest) se prerenderizan; las dinámicas se sirven bajo demanda.
8. **Skeletons sobre spinners**: `Skel*` + `DelayedFallback` (350ms) para que la percepción de carga sea corta y no se parpadee.

## Carga de JS

- Un solo bundle compartido (~106 kB first load JS en build de referencia) + chunks por ruta.
- Componentes del chat (con framer-motion, worker de imágenes, etc.) viven en su ruta; no se cargan en el shell general.

## Base de datos

- Índices: `attendance_user_date`, `idx_conversations_last_message`, `unique(...)` en catálogos y en `project_assignments`, etc.
- Funciones `security definer` (`my_role`/`my_user_id`) estables → el planner las usa bien en policies.
- El reporte semanal y los agregados se calculan en la Edge Function (server-side), no en el navegador.

## Percepción y animación

- Las animaciones usan `transform`/`opacity` (GPU-friendly) con curvas `--ease`/`--spring`.
- `will-change` solo donde se justifica (`.seg-thumb`).
- Todo respeta `prefers-reduced-motion`: en ese modo las animaciones duran 0.01ms (ver `globals.css`).

## Impresión

- Reportes → "Guardar como PDF" usa `@media print`: se oculta el chrome del shell, el contenido queda a ancho completo en blanco/negro legible, `break-inside: avoid` en tarjetas.

## Lo que deliberadamente NO hacemos

- No CDN de imágenes de terceros (los assets viven en Supabase Storage propio).
- No caché de página completa con revalidación compleja: la app es de sesión, cada persona ve su contexto.
- No WebSockets propios: Realtime de Supabase cubre el caso.
- No bundle de iconos externo: `Icon` de `os/icons.tsx` es un set propio (stroke-based) que solo incluye lo usado.

## Métricas sugeridas

Sin observabilidad instalada, se puede medir con:
- `next build` (sizes por ruta, ver tabla del build).
- Lighthouse en `emet.uno` (foco: CLS y LCP de las rutas principales).
- Network tab en el checador físico (el quiosco corre en dispositivos modestos).
