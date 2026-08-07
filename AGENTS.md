# AGENTS.md — EMET (bridge hacia la bóveda Obsidian)

**Documentación canónica del proyecto EMET en la bóveda de Obsidian.**

> **Primera acción de toda sesión:** leer la bóveda antes de modificar código.

## Bóveda de conocimiento (fuente de verdad)

- Ruta: `C:\Users\Samuel\Downloads\Emet Proyect\Emet Proyect`
- Dashboard: `HOME.md`
- Gobernanza obligatoria: `emet/00_AI_GOVERNANCE.md`
- Última sesión: `emet/05_AI_HANDOFF.md`
- Memoria: `emet/04_PROJECT_MEMORY.md`
- Pendientes: `emet/08_PENDING.md`
- Reglas de auditoría previa al cierre: `emet/03_SYSTEM_RULES.md`

## Reglas mínimas de EMET (resumen)

1. **Nunca duplicar lógica ni crear módulos redundantes.**
2. **Documentar antes de programar** y actualizar la documentación en el mismo cambio.
3. **Toda decisión importante genera un ADR** (`emet/decisiones/`, índice `emet/30_ARCHITECTURE_DECISIONS.md`).
4. **Todo bug corregido** se cierra en `emet/27_BUG_REGISTRY.md`, se retira de `emet/26_KNOWN_ISSUES.md` y se agrega a `emet/09_CHANGELOG.md`.
5. **Toda feature nueva actualiza** `emet/07_ROADMAP.md`.
6. **Usar siempre los motores centralizados** (Settings, Permissions, Events, Notifications): nunca bypassearlos.
7. **UI:** usar tokens y componentes del kit (`emet/19_DESIGN_SYSTEM.md`; código `src/components/os/ui.tsx`). Sin hex sueltos, sombras arbitrarias ni `window.prompt`/`confirm`.
8. **Verificación antes de cerrar:** `npx tsc --noEmit` limpio y `npx next build` exitoso.
9. **Auditoría previa al cierre:** responder el checklist de `emet/03_SYSTEM_RULES.md` (módulos dependientes, reportes, dashboards, notificaciones, historial, permisos, documentación, pruebas, deuda técnica, regresión). Si algo aplica, la tarea no está cerrada.
10. **Al terminar la sesión:** registrar la sesión en `emet/05_AI_HANDOFF.md`.

## Sincronización con Claude

Ambos asistentes (Open Code y Claude) trabajan sobre la misma bóveda. Cuando Open Code detecte una decisión, bug, mejora UX, auditoría o cambio de arquitectura, debe registrarlo en la bóveda correspondiente (bug → `emet/bugs/`, ADR → `emet/decisiones/`, feature → `emet/features/`) y actualizar changelog + handoff.

## Nota sobre `/docs` del repo

El repositorio conserva una carpeta `docs/` histórica. La fuente canónica y viva es la bóveda de Obsidian; `/docs` puede consultarse como referencia previa. No duplicar: todo contenido nuevo se escribe en la bóveda.
