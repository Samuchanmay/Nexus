# Emet · Accesibilidad

## Estado

Emet persigue accesibilidad práctica (WCAG 2.1 AA en lo aplicable) sin convertirlo en un proyecto académico. Lo que ya está implementado y lo que es obligatorio en código nuevo:

## Implementado en el sistema

- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` global (y en `.chat-ws`) — animaciones a 0.01ms, scroll instantáneo.
- **Foco visible**: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px }` global. Excepción intencional y documentada: `.seg button` (el thumb deslizante marca la selección).
- **Contraste**: tokens diseñados para ≥4.5:1 (texto normal) y ≥3:1 (grande/UI) en ambos temas.
- **Campos**: `aria-invalid="true"` como señal única de error (ojo + lector de pantalla).
- **Icon buttons**: requieren `aria-label`/`label` (sin icono como único acceso).
- **Idioma**: `<html lang="es">`.
- **Tema**: respeta `prefers-color-scheme` como sugerencia; el usuario puede fijarlo.
- **Semántica**: headers por sección (`h1`→`h3`), listas reales, botones reales (`<button>`) para acciones (nunca `<div onClick>`).

## Guías obligatorias para código nuevo

1. **Todo elemento interactivo** es un `<button>`/`<a>`/input real con accesible name.
2. **Foco**: nunca `outline: none` sin alternativa; nunca remover focus de controles.
3. **Color**: ninguna información se comunica solo por color (píldora = color + texto; estado = color + icono/label).
4. **Alt**: imágenes decorativas `alt=""`; avatares con `name` en el `Avatar` (iniciales como fallback).
5. **Formularios**: `label` asociado (`Field`), `hint` con `aria-describedby` si aplica.
6. **Overlays** (Sheet/Dialog): foco atrapado, `Escape` cierra, y el fondo es `aria-hidden`.
7. **Contraste manual**: si se añade un color de texto no token, verificar 4.5:1 sobre su fondo.
8. **Reduced motion**: cualquier animación nueva respeta el media query (o usa la utilidad global que ya lo hace).
9. **Skeletons**: `aria-hidden` (no anunciar "cargando" cada frame); el contenido llega y el SR lo lee.

## Verificación

- Revisión manual con Tab (foco), lectores de pantalla (VoiceOver/NVDA) en las rutas críticas: login, Mi Día, chat, vacaciones.
- Lighthouse a11y en cada build de referencia.
- No hay suite automatizada aún (ver `coding/TESTING.md`); la revisión de a11y es parte del proceso de contribución (canon §2).
