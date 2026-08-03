# Emet · Decisiones pendientes

Documento vivo. Se registra **lo que aún no está decidido** para que ninguna decisión se tome dos veces ni se pierda. Cuando una entra en discusión y se resuelve, migra a `docs/decisions/` como ADR.

## Cómo se usa

- Abierto: decisión en discusión, sin dueño.
- En discusión: hay postura pero falta resolución.
- Cerrado → se convierte en ADR y se elimina de aquí.

---

## Pendientes abiertos

### P-001 · ¿LLM opcional en EMU?

**Estado:** Abierto
**Contexto:** EMU Fase 1 es determinista y sin LLM (reglas puras en `src/lib/emu/`). La arquitectura lo permite: `Context Engine → Decision Engine → Surface`. El salto natural es permitir que cada organización conecte un LLM opcional.
**En juego:** privacidad (datos a terceros), costo, y el canon "escrito a mano, tono Apple/Linear/Signal". Un LLM podría romper el tono si se deja libre.
**Camino sugerido:** decidir primero si el LLM propone texto o solo clasifica/ordena señales; nunca reemplaza el Decision Engine.

### P-002 · Alcance de la reorganización del menú (Fase 3)

**Estado:** En discusión
**Contexto:** La navegación por dominios/hubs está en `src/lib/nav.ts` (Fase 1 y 2 hechas). Quedan pulir: ¿el chat merece sección propia permanente o es un dominio más? ¿Recorridos debe seguir visible para admin o es una herramienta "de taller"?
**En juego:** foco de la sidebar; no sobrecargar.

### P-003 · Multi-tenant: cuándo y cómo

**Estado:** Abierto (futuro lejano)
**Contexto:** Hoy single-tenant (ver ADR-0003). La migración 0011 deja el patrón: `organization_id` en cada tabla y RLS vía `my_org_id()`.
**En juego:** no romper el producto actual; el canon exige una migración planeada global, no parches.

### P-004 · Framework de tests

**Estado:** Abierto
**Contexto:** No hay scripts de test (`package.json` solo tiene dev/build/start). Existen piezas ideales para unit tests: `emu/rules.ts`, `calendar-core.ts`, `domain/attendance/`, `recorridos/player/get-diffs.ts`.
**En juego:** Vitest vs Jest; si se valida solo con `tsc` + build por ahora (ver `coding/TESTING.md`).

### P-005 · Renombre de claves internas heredadas ("nexus_*")

**Estado:** Abierto
**Contexto:** Tras el rebrand a Emet quedan claves internas con el prefijo histórico: columnas `nexus_clave`/`nexus_color` en `users`, claves de localStorage (`nexus-theme`, `nexus_fichar_queue`, `nexus.context-header.cache`, `nexus_pending_dismissed`, `nexus:recorridos:visto`, `nexus_device_id`), dominio de envío de correo `nexus@cert.edu.mx`, y los alias `nexus-*.vercel.app` en middleware/Edge Functions.
**En juego:** renombrar rompería datos existentes (columnas usadas en queries + seeds) y sesiones guardadas (storage). Se documenta aquí como deuda consciente: solo se toca en una migración planificada con `ALTER TABLE ... RENAME COLUMN` + cobertura de ambos nombres en el código por un periodo.
**Camino sugerido:** hacerlo junto con la migración multi-tenant (P-003), nunca en caliente.

### P-006 · Sender de correos institucional

**Estado:** Abierto
**Contexto:** El reporte semanal y vacaciones se envían desde `Emet <nexus@cert.edu.mx>`. El dominio en el remitente sigue siendo `cert.edu.mx`.
**En juego:** si CERT migra a otro dominio, o si Emet se vende a otra organización, el sender debe ser configurable por organización (relacionado con P-003).

### P-007 · ¿Buscar deudas técnicas en `nexus-theme` tras el rebrand?

**Estado:** Cerrado (documentado)
**Contexto:** El nombre `nexus-theme` persiste en localStorage por compatibilidad de tema entre sesiones. Renombrarlo perdería el tema de los usuarios actuales. Decisión: **mantener**, con migración de clave leída+escrita en el próximo toque del `ThemeToggle` (ver P-005).

### P-008 · Acciones de conversación que requieren RPCs nuevos

**Estado:** En discusión
**Contexto:** El menú contextual de conversación (N1) expone hoy lo que ya tienen RPC (`nx_enlace_toggle_*`, `nx_enlace_mark_conversation_read`). El spec pide además: **silenciar por duración** (8h / 1 semana / siempre), **marcar como no leído**, **vaciar conversación** y **eliminar conversación**. Ninguno tiene RPC/migración todavía.
**En juego:** silenciar por duración cambia el esquema (`conversation_participants.muted` es booleano → fecha/hasta); vaciar/eliminar necesita política RLS de borrado y decisión sobre el preview de la lista. 
**Camino sugerido:** N1 considera "imprescindibles" los pendientes menores; estos cuatro son N2 (ver ROADMAP) porque cambian esquema. Decidir con migración planeada, no en caliente.

### P-009 · Emoji Apple: pila de fuentes en Windows

**Estado:** En discusión
**Contexto:** SPEC-004 (ver `EMET_CANON.md`) fija `Apple Color Emoji` como único diseño oficial. En Windows no existe ese font: el sistema renderiza con `Segoe UI Emoji` vía la pila de fuentes.
**En juego:** ¿el fallback nativo de Windows es aceptable (postura actual: sí, documentado) o se empaqueta un font Apple-style redistribuible? Empaquetar agrega dependencia y peso; el canon prefiere cero dependencias cuando el estándar alcanza.

---

## Historial de cierre

| ID | Decisión | ADR |
|---|---|---|
| P-000 | Integrar el chat como módulo del sistema (no app aparte) | ADR-0001 |
| P-001 (antiguo) | Sheet vs Modal como patrón oficial | ADR-0002 |
| P-002 (antiguo) | Single-tenant para v1 | ADR-0003 |
