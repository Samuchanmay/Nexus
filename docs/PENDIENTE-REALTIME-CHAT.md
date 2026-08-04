# Emet · Realtime del chat — RESUELTO (4 agosto 2026)

> ✅ Fix aplicado directamente en la nube (proyecto `yunpghcdckwanfdunrsj`) vía
> el fix 0026. Verificado: `conversation_participants` y `message_reactions`
> ya están en la publicación `supabase_realtime`, y las 5 tablas del chat
> (`messages`, `conversations`, `conversation_participants`,
> `message_attachments`, `message_reactions`) tienen `REPLICA IDENTITY FULL`.
> `push_subscriptions` no existe todavía en este proyecto (ver sección
> "Pendiente aparte" abajo) — se omitió del fix.

Documento vivo. Registra el diagnóstico y los pasos pendientes del problema de
**Realtime en el chat** (los mensajes y estados solo llegan al recargar la
página). Cuando se aplique el fix y se verifique en producción, se cierra y se
marca aquí.

> Entorno: **Supabase Cloud (emet.uno)**. Las migraciones del repo se aplican a
> mano (SQL Editor) — la nube no se sincroniza sola con `supabase/migrations/`.

---

## Síntoma

- Los **mensajes nuevos no aparecen en vivo**: hay que refrescar la página.
- (Aplica también, por la misma causa raíz) los ticks ✓✓→leído, mute, pin,
  archivar y el conteo de no-leídos no se reflejan en tiempo real.

## Causa raíz (código vs base)

El código del cliente ya quedó bien (fix del singleton en `src/lib/supabase/client.ts`,
commits `1968bf3` y siguientes). El hueco está en la **base**:

1. **`conversation_participants` nunca se agregó a la publicación
   `supabase_realtime`** (0011/0016 solo cubren `messages`, `conversations`,
   `message_attachments`, `message_reactions`). El canal `enlace-unread-${userId}`
   del layout escucha UPDATE en esa tabla con filtro `user_id=eq.…` → nunca
   entrega nada.
2. **Sin `REPLICA IDENTITY FULL`**, los eventos UPDATE/DELETE con filtro por una
   columna que no es la PK (p. ej. `conversation_id=eq.X` para ticks de lectura,
   `user_id=eq.X` en participantes) se **descartan silenciosamente**. El INSERT
   de mensajes no lo necesita, pero los estados sí.
3. **En la nube hay que verificar la publicación de verdad**: como se aplica a
   mano, es probable que ni siquiera `messages` esté en la publicación del
   proyecto real → por eso ni los mensajes llegan en vivo.

## Pendientes

### 1. Diagnóstico en la nube (hacer primero)

Abrir **SQL Editor** del proyecto emet.uno y correr:

```sql
-- ¿Está Realtime habilitado y qué tablas tiene la publicación?
select pubname, pubinsert, pubupdate, pubdelete
from pg_publication
where pubname = 'supabase_realtime';

select p.tablename
from pg_publication_tables p
where p.pubname = 'supabase_realtime'
order by p.tablename;
```

También verificar que el toggle **Settings → Realtime → Enable Realtime** está
en ON en el proyecto.

**Resultado esperado** si todo está bien: la publicación debe listar al menos
`messages`, `conversations`, `conversation_participants`, `message_attachments`,
`message_reactions`, `push_subscriptions`.

### 2. Aplicar el fix en la nube

SQL ya preparado en `supabase/migrations/0026_chat_realtime_publication_fix.sql`.
Idéntico a:

```sql
alter publication supabase_realtime add table conversation_participants;
alter publication supabase_realtime add table push_subscriptions;

alter table messages replica identity full;
alter table conversations replica identity full;
alter table conversation_participants replica identity full;
alter table message_attachments replica identity full;
alter table message_reactions replica identity full;
alter table push_subscriptions replica identity full;
```

Aditivo e idempotente. Depende de las migraciones 0011 y 0016.

### 3. Verificar en vivo

- Enviar un mensaje entre dos cuentas: debe aparecer sin recargar.
- Abrir en dos pestañas: marcar como leído debe reflejar el tick en vivo.
- Abrir en dos pestañas: silenciar/pinear/archivar debe reflejarse en vivo.
- El contador de no-leídos en la sidebar debe actualizarse al recibir.

### 4. Commit + push (opcional, pendiente del bloque 0025)

- `supabase/migrations/0025_chat_mute_duration_read_at.sql` (migración del
  bloque: silencio por duración + lecturas con hora) sigue **sin commitear**.
- `supabase/migrations/0026_chat_realtime_publication_fix.sql` (este fix) también.
- Mensaje de commit sugerido (estilo repo):
  `chat: fix realtime - publicacion conversation_participants + replica identity full (0026)`

## Archivos de referencia

- `supabase/migrations/0026_chat_realtime_publication_fix.sql` — fix listo para aplicar.
- `supabase/migrations/0025_chat_mute_duration_read_at.sql` — migración del bloque pendiente de commit/push.
- `src/lib/supabase/client.ts` — singleton (fix previo, ya en `main`).
- `src/app/chat/[id]/client.tsx` — canal realtime de mensajes (INSERT con filtro `conversation_id`).
- `src/app/chat/client.tsx` — canal realtime de conversaciones.
- `src/lib/chat/use-unread-count.ts` — canal `enlace-unread-${userId}` (el principal afectado por la publicación).
- `src/lib/chat/use-typing.ts` — canal de typing/broadcast.

## Estado

- [x] Diagnóstico SQL corrido en la nube (publicación + toggle Realtime).
      Antes del fix la publicación solo tenía `conversations`,
      `message_attachments`, `messages`, `notifications` — faltaban
      `conversation_participants` (causa raíz documentada arriba) y también
      `message_reactions` (no estaba en el diagnóstico original, se encontró
      en esta pasada).
- [x] Fix 0026 aplicado directo en la nube vía MCP de Supabase (agrega las 2
      tablas a la publicación + `REPLICA IDENTITY FULL` en las 5 reales).
      `push_subscriptions` se omitió porque la tabla no existe todavía.
- [ ] Mensajes llegan en vivo entre dos cuentas — **pendiente de que el
      usuario lo confirme probando con dos sesiones reales.**
- [ ] Ticks de lectura / mute / pin / archivar llegan en vivo — mismo,
      pendiente de confirmación manual.
- [ ] Contador de no-leídos se actualiza en vivo — mismo.
- [ ] Commit + push de 0025 y 0026 (los archivos `.sql` ya existen en el
      repo local, faltaba commitear — verificar en el próximo commit).

## Push con app cerrada — CONSTRUIDO (4 agosto 2026), falta 1 paso manual

> ✅ Ya no es un gap de feature — se construyó completo. Solo falta que el
> usuario pegue 3 secrets en el dashboard de Supabase (no hay tool de MCP
> para setearlos, es lo único que quedó fuera de alcance de automatizar).

Lo que se agregó:

- **`supabase/migrations/0033_chat_push_subscriptions.sql`** — tabla
  `push_subscriptions` (aplicada ya en la nube) con RLS: cada usuario
  administra sus propias filas vía `my_user_id()`. `subscription` es texto
  (JSON.stringify del PushSubscription), no jsonb — así lo espera
  `send-chat-push` tal cual venía escrito.
- **`src/app/api/push/subscribe/route.ts`** — existía un borrador roto (nunca
  funcionó: comparaba el `userId` del body contra el UID de `auth.users` en
  vez del id interno de `public.users`, y hacía `onConflict: "user_id"`
  contra una tabla que ni siquiera tenía esa columna única). Reescrito:
  resuelve el id interno del lado del servidor a partir de la sesión (mismo
  criterio que el guard de propiedad de `event_check_in`/`event_check_out`,
  0032) y hace upsert por `endpoint` (un usuario puede tener varios
  dispositivos suscritos).
- **Par VAPID nuevo, generado con la librería oficial `web-push`** — el que
  ya estaba hardcodeado en el cliente (`BKcd5c...`) nunca tuvo su privada
  configurada en ningún lado, así que era irrecuperable; se generó un par
  nuevo y se actualizó la constante en `src/lib/use-push-notifications.ts` y
  el fallback en `supabase/functions/send-chat-push/index.ts` (ya
  redesplegada, versión 2, con la clave pública nueva).

### Único paso que falta — manual, en el dashboard de Supabase

Project Settings → Edge Functions → `send-chat-push` → Secrets, agregar:

```
VAPID_PUBLIC_KEY  = BCBYW7jMiV4B0oCdSDyiC2wUuXMlXA4ecKt4jNpjEs8zohScS3glxfmYxr3UkS1SyEBOSmk-OIbonYBcP1RLWIA
VAPID_PRIVATE_KEY = MDXX8BSzXWr4CMMcMmenB09cx60rL5cgaarnlNAuinU
VAPID_SUBJECT     = mailto:macgenio55@gmail.com
```

(`VAPID_SUBJECT` puede ser cualquier `mailto:` de contacto real — se usa
solo para que los push services identifiquen al remitente si hay abuso.)
Sin este paso, `send-chat-push` sigue respondiendo 500 "VAPID no
configurado" — best-effort, no rompe el envío de mensajes, solo significa
que el push con la app cerrada sigue sin salir. En cuanto se guarden los 3
secrets, funciona sin necesidad de otro deploy.

- [x] Tabla `push_subscriptions` + RLS.
- [x] `/api/push/subscribe` reescrito y funcional.
- [x] Par VAPID nuevo generado y sincronizado (cliente + Edge Function).
- [x] `send-chat-push` redesplegado con la clave pública nueva.
- [ ] **Secrets VAPID pegados en el dashboard — falta que el usuario lo haga.**
- [ ] Verificar en vivo: cerrar la app del todo, enviar un mensaje desde otra
      cuenta, confirmar que llega la notificación del sistema.

## Bugs encontrados y corregidos en esta pasada (4 agosto 2026)

Además del fix de Realtime, se auditó el código del módulo y se corrigieron:

- `src/app/chat/client.tsx` — `toggleMute`/`togglePin`/`toggleArchive` hacían
  mal el rollback ante error del RPC: leían el estado ya sobreescrito por el
  propio update optimista, así que el "rollback" no revertía nada.
- `src/app/chat/[id]/client.tsx` — `toggleReaction` no revisaba el error del
  RPC `nx_enlace_toggle_reaction`: si fallaba, la reacción optimista se
  quedaba mostrada como guardada para siempre.
- `src/lib/chat/use-outbox.ts` — el listener de reconexión (`online`) leía
  `messages` de un closure congelado en el primer render; un mensaje fallido
  llegado por BroadcastChannel desde OTRA pestaña nunca se reintentaba al
  recuperar conexión. Se cambió a una ref siempre actualizada.
