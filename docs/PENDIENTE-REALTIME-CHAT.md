# Emet · Pendiente: Realtime del chat no entrega en vivo

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

- [ ] Diagnóstico SQL corrido en la nube (publicación + toggle Realtime).
- [ ] Toggle **Settings → Realtime** verificado en ON.
- [ ] Fix 0026 aplicado en el SQL Editor de emet.uno.
- [ ] Mensajes llegan en vivo entre dos cuentas.
- [ ] Ticks de lectura / mute / pin / archivar llegan en vivo.
- [ ] Contador de no-leídos se actualiza en vivo.
- [ ] (Opcional) Commit + push de 0025 y 0026.
