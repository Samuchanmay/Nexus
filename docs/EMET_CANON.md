# Emet · El Canon (EMET_CANON)

> **Máxima autoridad del proyecto.** Emet es un sistema operativo empresarial, no una colección de apps. Todo lo que contradiga este canon es un bug. Antes de escribir código, lee esto. Este documento es corto a propósito: lo que aquí no está, se busca en `docs/` (y si no existe, se documenta antes de implementar).

---

## 1. Filosofía

1. **Un sistema, no una colección de módulos.** El chat, el checador, las vacaciones y los proyectos comparten shell, tokens, componentes, navegación y tono. Si una pantalla se ve "como otra app", está mal hecha.
2. **Emet no es un ERP, CRM, chat ni RH.** Integra módulos; ninguno debe sentirse como un producto aparte.
3. **Diseñado para humanos con prisa.** La interfaz respeta a la persona, sin jerga de sistema, sin "cargando…" vacíos, sin errores sin remedio.
4. **El tiempo es el pulso del equipo.** Checar, jornada, vacaciones e incidencias son ciudadanos de primera clase, no trámites.
5. **Menos, mejor.** Una acción primaria por pantalla; la complejidad se organiza, no se acumula.
6. **La documentación es parte del trabajo.** Código sin ADR/changelog es deuda técnica (sección 7).

## 2. Design for Humans (principios no negociables)

1. **Nada de feedback muerto**: toda carga usa skeleton; todo error es visible y ofrece salida.
2. **Sin texto "a secas"**: un botón dice lo que hace; un estado vacío explica por qué y qué sigue.
3. **Memoria**: el sistema recuerda lo que ignoraste y ofrece recordatorios (EMU).
4. **Accesibilidad**: foco visible, contraste legible, `prefers-reduced-motion` respetado en TODA la app.
5. **Mobile = nativo**: en pantallas chicas se respeta el scrollbar/overlay del navegador; el layout es responsive por defecto.
6. **El copy se escribe, no se rellena**: tono directo, sin saludos falsos ("Hola Samuel, espero que…"), sin exclamaciones de marketing (ver `docs/design/COPYWRITING.md`).

## 3. Identidad visual e interacción (resumen ejecutivo)

- Paleta en tokens CSS (`:root` y `[data-theme="dark"]` en `globals.css`). **Nunca** colores hex sueltos sin token.
- Acento azul `--accent`; semánticos `--ok/--warn/--danger/--purple` con sus `-tint`. En el chat, `--accent` remapea dentro de `.chat-ws` (excepción documentada).
- Tipografía: fuente del sistema (`-apple-system`), escala canónica `--fs-*` (ver `docs/design/TYPOGRAPHY.md`).
- Radios: `--radius-l 22 / --radius-m 16 / --radius-s 11`; píldoras para estados y segmentos.
- Sombras: `--shadow-1/2/3`. Elevación al hover con `--spring`.
- Movimiento: `--ease` (función) y `--spring` (alive); respetar `prefers-reduced-motion`.
- Superficies glass: `color-mix(in srgb, var(--surface) 72%, transparent)` + `blur(20px)`.
- Detalle completo: `docs/design/`.

## 4. Tecnologías oficiales

| Capa | Tecnología | Nota |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 | Server components por defecto; `"use client"` solo cuando hace falta |
| Lenguaje | TypeScript (strict) | Sin `any` sin justificar |
| Estilos | Tailwind 3.4 + CSS custom properties | Tokens en `globals.css`; utilidades para layout, tokens para color/forma |
| Backend | Supabase: Postgres + Auth + Realtime + Edge Functions + Storage | RLS obligatorio; cliente nunca confía en el cliente |
| Movimiento | framer-motion | Solo para lo que necesita física; el resto con CSS |
| Reportes | exceljs | Generación de XLSX server-side |
| Iconos | `Icon` (`src/components/os/icons.tsx`) | Set interno stroke-based |

**Reglas de dependencias**: no añadir una dependencia sin (a) autorización del mantenedor y (b) ADR o nota en el changelog. Preferir cero dependencias cuando el estándar web alcanza.

## 5. Patrones UX permitidos (los únicos oficiales)

- **Shell + Dominios + Hubs**: `AppShell`, `nav.ts`, `DomainTabs`. Rutas SIEMPRE vía `HREF[role][key]`.
- **Botones de 3 niveles**: `.btn-primary` / `.btn-secondary` / `.btn-tertiary` (más `.btn-ok` para el caso "guardar/confirmar verde"). Un primario por pantalla.
- **Pickers**: date/time/color/selectores nativos estilizados o `Sheet`/`Menu` (ver `docs/design/PICKERS.md`). Nada de datepickers de terceros.
- **Hojas (Sheet) vs modales (Dialog)**: Sheet para contexto (adjuntos, reenvío, cámara); Dialog para decisiones que interrumpen. Regla completa en ADR-0002.
- **Estados vacíos**: `EmptyState` con icono + título + pista + acción opcional.
- **Carga**: skeletons (`Skel`, `SkelList`, `SkelStatCard`) o `DelayedFallback` — nunca "Cargando…" como texto suelto.
- **Notificaciones y toasts**: `notifications` (campana) + toasts (con shake en error) + `PausaActivaPopup` + `EmuBanner`.
- **Formularios**: `Field` + `Input` + `Button` de `os/ui.tsx`; `aria-invalid` para errores.
- **Chat**: workspace `.chat-ws`, burbujas sólidas, estados, swipe, reacciones, outbox offline.

**Nada fuera de esta lista sin ADR.** Si necesitas un patrón nuevo: documéntalo (ADR + doc de diseño) y luego impleméntalo en el sistema de diseño; nunca "de una vez" en una pantalla.

## 6. Componentes oficiales

Ubicación canónica: `src/components/os/ui.tsx` (kit base) y `src/components/ui.tsx` (compartidos heredados). Revisar ambos ANTES de crear algo nuevo.

- `Button`, `IconButton`, `Card`, `SectionTitle`, `Skel*`, `Field`, `Input`, `Badge`, `SegmentPill`, `Kbd`, `EmptyState`, `StatCard`, `Dialog` — en `os/ui.tsx`.
- `ToastProvider`/`useToast`, `ThemeToggle`, `SlidingSegments`, `Avatar`, `Menu`/`MenuItem`, `CheckBox`, `Sheet`, `Pill` — en `components/ui.tsx`.
- `Icon` (set interno), `AppShell`, `DomainTabs`, `NotificationBell`, `ProfileModal`, `EmuBanner`, `PausaActivaPopup`, `JornadaWatcher`, `RouteError`, `ResolvePendingExit` — en `components/os/`.
- Chat: `conversation-row`, `attachment-sheet`, `camera-capture`, `sticker-picker`, `reactions`, `message-status`, `forward-sheet`, `conversation-search`, `smart-image` — en `components/chat/`.

> **Nunca duplicar componentes.** Si el que necesitas no existe, se crea en el kit oficial y se reutiliza. El kit es la única fuente de verdad visual.

## 7. Reglas para contribuir

### Antes de escribir código
1. Leer `EMET_CANON.md` y `docs/coding/AI_RULES.md`.
2. Leer `docs/02-BLUEPRINT.md`, la arquitectura (`docs/architecture/`) y el módulo afectado (`docs/modules/`).
3. Leer los ADR existentes; si la decisión no existe, el cambio **requiere un ADR**.
4. Leer el sistema de diseño (`docs/design/`) y confirmar que lo que se va a construir usa componentes/tokens oficiales.

### Después del cambio
1. Actualizar `docs/roadmap` si afecta lo planeado.
2. Actualizar `docs/changelog/CHANGELOG.md` (siempre).
3. Crear/actualizar ADR si hubo decisión de arquitectura o patrón nuevo.
4. Actualizar la doc del módulo (`docs/modules/`) si el comportamiento cambió.
5. Verificar build (`npm run build`) antes de proponer merge.

### Nunca
- **Nunca** duplicar un componente que ya existe en el kit.
- **Nunca** estilos globales sin justificación (y siempre vía tokens).
- **Nunca** dependencias nuevas sin autorización + documentación.
- **Nunca** romper el sistema de diseño "porque esta pantalla es especial".
- **Nunca** inventar patrones UX fuera de la sección 5.
- **Nunca** `any` silencioso, secretos en el repo, ni comentarios que contradigan el código.

## 8. Proceso obligatorio de documentación

| Cambio | ADR | Changelog | Roadmap | Doc de módulo | Doc de diseño |
|---|---|---|---|---|---|
| Fix de bug sin cambio de comportamiento | — | ✅ | — | — | — |
| Feature nueva en módulo existente | opcional | ✅ | ✅ | ✅ | — |
| Patrón/comportamiento UX nuevo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cambio de esquema / migración | ✅ | ✅ | ✅ | ✅ | — |
| Dependencia nueva | ✅ | ✅ | ✅ | — | — |
| Rediseño de identidad | ✅ | ✅ | ✅ | — | ✅ |

**El ADR es obligatorio cuando el cambio introduce una decisión que podría discutirse otra vez.** Si te da duda: escríbelo; un ADR de más nunca dañó un repo.
