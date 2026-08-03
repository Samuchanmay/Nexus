# Emet · Blueprint

El blueprint es la fuente de la filosofía del producto. Es más profundo que la visión (qué y por qué) y más general que el sistema de diseño (cómo se ve). Responde a: **¿cómo se siente usar Emet?**

## 1. La metáfora del sistema operativo

Emet no es una "app web con menú". Es un **entorno** donde la persona inicia sesión y vive su día. Tres capas:

- **El Shell** (`AppShell`): la ventana. Sidebar por dominios, topbar contextual, centro de notificaciones, perfil, tema. Es el marco que hace que todo se sienta igual.
- **Los Dominios** (`nav.ts`): la organización del trabajo por negocio, no por pantalla. Inicio, Trabajo, Chat, Personas, Tiempo, Reportes, Recorridos, Configuración.
- **Los Hubs** (`DOMAIN_VIEWS`): dominios que agrupan varias vistas como pestañas (Personas → Lista/Carga; Tiempo → Mi día/Vacaciones/Incidencias/Asistencia/Días inhábiles).

Regla de oro: **las URL nunca se escriben a mano** — se resuelven contra `HREF[role][key]` (`src/lib/nav.ts`), única fuente de verdad. Un módulo nuevo que necesita una ruta la declara ahí.

## 2. Design for Humans

Ver el documento completo en `docs/design/DESIGN_FOR_HUMANS.md`. En una frase: **la interfaz le habla a una persona con prisa, con respeto, sin jerga de sistema.**

Principios que gobiernan toda decisión de producto:

1. **Nada de "cargando…" a secas.** El sistema prefiere skeletons (`.nx-skel`) a spinners y spinners a texto. El usuario siempre sabe *qué* se está cargando.
2. **Los errores se explican y se remedian.** Un error silencioso es un bug. Un error visible sin salida es una falla de diseño.
3. **La memoria importa.** Si el sistema ignoró una señal varias veces, aprende (ver EMU Fase 1). Las reglas se escriben a mano, sin saludos falsos.
4. **Menos, mejor.** Una acción primaria por pantalla. Los botones tienen tres niveles (primario/secundario/terciario) y se usan en ese orden.
5. **El detalle es el producto.** Micro-interacciones (ripple, swipe, pop de reacción, saludo 👋) existen para que el sistema se sienta vivo, no para decorar.

## 3. Identidad visual

- **Paleta**: estilo Apple — fondos neutros (`#FBFBFD` claro / `#0F1115` oscuro), superficies translúcidas (glass), acento azul (`#0066FF` / `#0A84FF`), semánticos: verde ok, naranja warn, rojo danger, morado.
- **Tipografía**: sistema del SO (`-apple-system` / SF Pro), con una escala canónica de 13 tamaños nombrados (`--fs-2xs`…`--fs-hero`). Base 13.5px; `html { font-size: 110% }` en desktop para legibilidad.
- **Formas**: radios grandes (22/16/11px), píldoras para estados, tarjetas glass con sombras suaves de 3 niveles.
- **Tema oscuro/claro**: tokens CSS completos bajo `[data-theme="dark"]`, persistidos en `nexus-theme` (localStorage) con detección de `prefers-color-scheme`.

El chat es una excepción deliberada y documentada: un **workspace premium** (`.chat-ws`) que remapea los tokens dentro de su scope, inspirado en Linear/Discord/Slack/Apple Messages. En claro usa superficies frías azuladas; en oscuro `#05070B`. Pero su acento sigue siendo azul Emet — para que incluso el módulo "más propio" se sienta parte del sistema.

## 4. Identidad de interacción

- **Movimiento**: dos curvas — `--ease` (`cubic-bezier(.22,.61,.36,1)`) para la mayoría y `--spring` (`cubic-bezier(.34,1.4,.64,1)`) para lo que debe sentirse vivo (segmented control, cards, swipe). Todo respeta `prefers-reduced-motion`.
- **Gestos**: swipe en conversaciones de chat (estilo Signal) con botones revelados y ack haptico visual.
- **Entrada**: fields con foco azul + anillo (`box-shadow 0 0 0 4px var(--accent-tint)`), `aria-invalid` para errores, botones con ripple.
- **Feedback**: toasts (con shake en errores), notificaciones, pausa activa con ilustración respirando (sin emojis ruidosos).

## 5. Cómo se relacionan los módulos

```
                     ┌────────────── AppShell ──────────────┐
                     │   sidebar · topbar · notificaciones  │
                     └──────────────────────────────────────┘
   Inicio      Trabajo          Chat         Personas   Tiempo    Reportes   Config
   ─────       ───────          ────         ───────   ──────    ────────   ──────
   Hoy/Admin   Solicitudes      Convers.     Lista     Mi día    Semanal    Horarios
   Coordinador Proyectos        [id]        Carga     Vacaciones           GPS/Dispositivos
   RH          Checklist        reacciones            Incidencias          Pausa activa
   Fichar      Bibliotecas      adjuntos              Asistencia          Estados de jornada
   Calendario  (compartido)     push                  Días inhábiles       Tipos de actividad
                                                      Colores
```

La base de datos comparte **una sola tabla `users`** y una fuente de contexto (EMU). Los datos no se duplican por módulo: vacaciones, incidencias, asistencia y horarios son tablas hermanas que comparten persona y calendario.

## 6. EMU — capa de inteligencia contextual

`src/lib/emu/` es el "asistente silencioso" de Emet. Fase 1 es un **motor de reglas determinista, sin LLM**:

```
Context Engine (recolecta señales una vez)
   → Decision Engine (reglas puras, elige un solo ganador por prioridad)
   → Surface (Banner/Toast/Card — nunca decide por sí sola)
```

- Cada regla devuelve un `EmuCandidate` con `priority` y `tone`; el texto está **escrito a mano** (tono Apple/Linear/Signal).
- Memoria mínima: si una señal se ignora ≥3 veces, se marca `offerAutoRemind` para un CTA extra.
- Fase 1 solo cubre señales de jornada (¿abrió jornada? ¿lleva horas? ¿cumplió objetivo?) y bandeja de solicitudes. Se amplía módulo por módulo.

## 7. Recorridos — onboarding que enseña

El primer login no se explica con un PDF: se **hace**. Los recorridos (módulo `preptour` + player en `src/lib/recorridos/player/`) son demos guiadas que los admins crean y publican desde `/preptour`. El jugador aplica diffs de DOM sobre la app real, marcando con overlay qué hay que tocar.

## 8. Reglas de integridad

1. Un solo login (Google, whitelist por email → `public.users`), MFA obligatorio para `admin` y `rh`.
2. RLS por rol en cada tabla (ver `docs/architecture/PERMISSIONS.md`); el cliente nunca confía en el cliente.
3. Todo lo que el usuario ve pasa por el sistema de diseño o es un bug.
4. Documentación: ADR si hay decisión, changelog siempre, roadmap si aplica.
