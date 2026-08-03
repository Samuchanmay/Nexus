# Emet · Componentes

Ubicación canónica: `src/components/os/ui.tsx` (kit base del OS) y `src/components/ui.tsx` (compartidos heredados). **Nunca duplicar**: revisar esta lista antes de crear algo.

## Kit base (`os/ui.tsx`)

| Componente | Props | Uso |
|---|---|---|
| `cx(...cls)` | strings | Combina clases condicionales |
| `Button` | variante, icon, tamaño | Botón unificado; envuelve los estilos `.btn-*` |
| `IconButton` | icon, label, size | Acción solo-icono (requiere `label` accesible) |
| `Card` | pad, hover | Superficie base de contenido |
| `SectionTitle` | hint | Título de sección con pista opcional |
| `Skel` / `SkelRow` / `SkelStatCard` / `SkelList` | — | Skeletons de carga |
| `Field` | label, hint | Contenedor label+control+ayuda |
| `Input` | icon, +HTML input | Campo de texto del sistema |
| `Badge` | tone, dot, pulse | Estado/píldora (neutral/accent/ok/warn/danger/purple) |
| `SegmentPill` | active | Pestaña/píldora de segmento |
| `Kbd` | children | Atajo de teclado |
| `EmptyState` | icon, title, hint, action | Estado vacío oficial |
| `StatCard` | label, value, icon, tone, delta | Tarjeta de métrica |
| `Dialog` | — | Modal de decisión (ver ADR-0002) |

## Compartidos heredados (`components/ui.tsx`)

| Componente | Uso |
|---|---|
| `ToastProvider` / `useToast` | Toasts globales (éxito/error; error con shake) |
| `ThemeToggle` | Alternador claro/oscuro (persiste `nexus-theme`) |
| `SlidingSegments` | Segmented control (Semana/Mes/…) con thumb deslizante |
| `Avatar` | Avatar con color personal, avatarUrl, badge de cumpleaños y estado |
| `Menu` / `MenuItem` | Menú contextual (trigger, align, width; items con icono/danger/href) |
| `CheckBox` | Check animado |
| `Sheet` | Hoja deslizante para contexto (ver ADR-0002) |
| `Pill` | Píldora de estado por tone |

## OS (`components/os/`)

- `AppShell` — el shell completo (sidebar + topbar + mesh + notificaciones).
- `DomainTabs` — pestañas de un dominio-hub (resuelve rutas vía `nav.ts`).
- `NotificationBell` — campana con no-leídos.
- `ProfileModal` — perfil del usuario (avatar, datos, tema).
- `EmuBanner` — superficie de presentación de EMU (recibe `EmuDecision`, no decide).
- `PausaActivaPopup` — recordatorio de pausa (silenciable).
- `JornadaWatcher` — reloj que dispara recordatorios de jornada.
- `ResolvePendingExit` — resuelve salidas pendientes.
- `RouteError` — error boundary de ruta.
- `DelayedFallback` — fallback tras 350ms.
- `ImageCropper` — recorte de avatar/imágenes.
- `Shell` — variante del shell.
- `Icon` — set de iconos.

## Chat (`components/chat/`)

`conversation-row` · `attachment-sheet` · `camera-capture` · `sticker-picker` · `reactions` · `message-status` · `forward-sheet` · `conversation-search` · `smart-image`. Detalle en `modules/CHAT.md`.

## Reglas de composición

1. Antes de escribir un componente nuevo: buscar en esta lista y en `components/os`, `components/ui`, `components/chat`.
2. Si se crea un componente reutilizable, vive en `os/ui.tsx` o su carpeta de dominio; si es de una pantalla, es local al archivo.
3. Los componentes del kit aceptan `className` para layout, pero **no** para romper tokens (color/radio/sombra).
4. El estado de un componente se marca con atributos (`data-active`, `aria-invalid`), no con clases inventadas.
