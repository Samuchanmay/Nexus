# Emet · Reglas para agentes de IA y contribuciones

Este documento es **vinculante** para cualquier agente (IA o humano) que toque el repo. Complementa a `docs/EMET_CANON.md` (cómo se documenta) con el *cómo se escribe código*.

## Antes de escribir código

1. **Leer la doc canónica del área afectada** (`docs/modules/*`, `docs/architecture/*`, `docs/design/*`). La doc es fuente de verdad: describe el estado REAL del código.
2. **Ubicar la pieza**: buscar en el repo el componente/archivo que tocar (capa os vs chat vs dominio; `src/lib` si es lógica). Reutilizar antes que crear.
3. **Respetar el sistema de diseño**: tokens (`var(--...)`), kit (`os/ui.tsx`, `ui.tsx`), roles y rutas de `src/lib/nav.ts`. No introducir hex sueltos ni rutas nuevas fuera del mapa.
4. **Preguntar cuando sea ambiguo** (p. ej. decisiones de dominio, deuda P-00X). No inventar comportamiento.

## Mientras se escribe

1. **Cero comentarios de relleno**; solo el "porqué" no obvio.
2. **Nombres de dominio en español**, infra en inglés (ver `NAMING.md`).
3. **TypeScript estricto**: sin `any`, props tipadas, unions para estados.
4. **No tocar** (deuda registrada, rompería o es innecesario): columnas `nexus_clave`/`nexus_color`, dominios legacy en middleware/ALLOWED_ORIGINS, claves localStorage `nexus-*`/`nexus:`, dominio de correo `nexus@cert.edu.mx`, prefijo de RPC `nx_*`. Ver `DECISIONES-PENDIENTES.md`.
5. **No reescribir CSS global** ni tokens sin pasar por el sistema; los cambios de diseño se documentan en `docs/design/`.

## Después del cambio

1. **Verificar**: `npm run build` sin errores (no hay linter/tests aún, P-004).
2. **Si cambia la estructura/datos/UI**: actualizar la doc canónica correspondiente (canon §proceso). La doc que describe un comportamiento inexistente es un bug.
3. **Si introduce deuda nueva**: registrarla en `docs/DECISIONES-PENDIENTES.md` (nuevo P-0XX), no dejarla en un comentario perdido.
4. **Commit con mensaje claro** del cambio (inglés breve), sin archivos irrelevantes, sin secretos.

## Nunca

1. **Nunca** editar una migración ya aplicada (`supabase/migrations/*`); se agrega una nueva aditiva y se refleja en `schema.sql`.
2. **Nunca** commitear secrets: VAPID privado, claves de servicio, tokens, `.env`. El par público de VAPID está documentado en `SECURITY.md`; el privado solo en secretos de Supabase.
3. **Nunca** hardcodear fechas/horarios fuera de `America/Merida` ni depender del reloj del cliente para negocio (fichaje).
4. **Nunca** añadir emojis a copy de sistema/notificaciones ni a docs, salvo el marcador de estado permitido en ROADMAP (`✅/🟡/🟢`).
5. **Nunca** introducir librerías nuevas (design, testing, iconos) sin validar que no rompen el stack actual (React 19/Next 15/Tailwind 3) y sin documentarlo en `docs/architecture/STACK.md`.
6. **Nunca** inventar rutas, roles, tablas o RPC que no existen en `nav.ts`, schema.sql o el código real.
7. **Nunca** borrar código comentado "por si acaso" sin confirmar; **sí** borrar código muerto real.
8. **Nunca** duplicar componentes del kit en una pantalla; reusar `os/ui.tsx`/`ui.tsx`.
9. **Nunca** escribir en inglés el contenido visible de la UI (la UI es es_MX) ni en español la infraestructura técnica.
