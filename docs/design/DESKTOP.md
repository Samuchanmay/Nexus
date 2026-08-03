# Emet · Desktop

## El workspace

Desktop es el entorno de trabajo "de oficina": shell completo (sidebar + topbar + mesh) con ancho generoso. La escala base sube a 110% para legibilidad.

## Anatomía del shell

- **Sidebar** (`AppShell`): dominios en secciones (Inicio, Trabajo, Chat, Personas, Tiempo, Reportes, Recorridos, Config). Translúcida (`glass-bar`).
- **Topbar**: título del contexto actual, acciones (búsqueda, notificaciones, perfil, tema).
- **Mesh de fondo**: degradado radial por rol (`data-mesh`), muy sutil, con `mix-blend-mode: multiply` en claro.
- **Contenido**: `max-width` razonable; las listas se agrupan en grids (2–3 columnas) para no estirar las filas.

## Comportamientos

| Feature | Desktop |
|---|---|
| Ventana | Sidebar siempre visible; contenido fluido |
| Chat | 2 paneles: lista de conversaciones + conversación abierta |
| Tablas | Se muestran completas (reportes) |
| Hover | Elevación de tarjetas, reveal de acciones en filas |
| FAB | Oculto; la acción vive en línea |
| Atajos | `Kbd` (⌘K búsqueda, etc.) — ver `COMPONENTS.md` |
| Impresión | Reportes → PDF con `@media print` |

## Reglas

1. Máximo ~1200px de contenido útil; el resto es mesh/respiro (no llenar el ancho total en tablas de lectura).
2. El sidebar colapsa a iconos si la ventana < ~1100px (mantener accesible, nunca desaparecer).
3. Hover siempre con feedback: la tarjeta se eleva o el icono cambia; nada "muerto".
4. En desktop los Sheets centran (no deslizan de abajo como en móvil).
5. El mouse con rueda sobre grids de actividades: el grid es estático (no horizontal-scroll); la página scrollea.
6. Múltiples columnas: grids con `repeat(5,1fr)` (actividades) o 2-3 columnas para tarjetas de listas; colapsan a 1 en móvil.

## Ver también

- `DESKTOP`/`MOBILE` se complementan; el mismo componente se adapta por breakpoint (Tailwind `md:`/`lg:`), no se duplica.
