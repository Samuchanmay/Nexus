# Migraciones pendientes para Supabase (emet.uno)

> **Instrucciones**: Copia y pega cada bloque en el **SQL Editor** del proyecto Supabase `emet.uno`. Ejecutar en orden (0025 primero, luego 0026).

---

## Migración 0025 — Silencio por duración + hora de lectura

**Qué hace**:
- Añade columna `muted_until` en `conversation_participants` (silenciar hasta fecha/hora específica)
- Añade columna `read_at` en `messages` (hora exacta de lectura)
- Crea RPCs: `nx_enlace_set_mute`, `nx_enlace_unmute`, `nx_enlace_mark_read`

**SQL**:
```sql
-- 1. Columnas nuevas
alter table conversation_participants add column if not exists muted_until timestamptz;
alter table messages add column if not exists read_at timestamptz;

-- 2. RPC: silenciar con vencimiento (p_until = NULL → para siempre)
create or replace function nx_enlace_set_mute(p_conversation_id uuid, p_until timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update conversation_participants
  set muted = (p_until is null), muted_until = p_until
  where conversation_id = p_conversation_id and user_id = my_user_id();
end; $$;
grant execute on function nx_enlace_set_mute(uuid, timestamptz) to authenticated;

-- 3. RPC: desactivar silencio
create or replace function nx_enlace_unmute(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update conversation_participants
  set muted = false, muted_until = null
  where conversation_id = p_conversation_id and user_id = my_user_id();
end; $$;
grant execute on function nx_enlace_unmute(uuid) to authenticated;

-- 4. RPC: marcar leído con hora
create or replace function nx_enlace_mark_read(p_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update messages
  set status = 'read', read_at = coalesce(read_at, now())
  where id = p_message_id and status in ('sent', 'delivered');
end; $$;
grant execute on function nx_enlace_mark_read(uuid) to authenticated;
```

---

## Migración 0026 — Fix Realtime (mensajes en vivo)

**Qué hace**:
- Añade `conversation_participants` y `push_subscriptions` a la publicación `supabase_realtime`
- Activa `REPLICA IDENTITY FULL` en todas las tablas del chat (necesario para UPDATE/DELETE con filtros)

**Sin esto**: los mensajes y estados (ticks de lectura, mute, pin, archivar) solo llegan al recargar la página.

**SQL**:
```sql
-- 1. Publicación: cubrir todas las tablas que el chat escucha
alter publication supabase_realtime add table conversation_participants;
alter publication supabase_realtime add table push_subscriptions;

-- 2. REPLICA IDENTITY FULL (necesario para filtros en columnas no-PK)
alter table messages replica identity full;
alter table conversations replica identity full;
alter table conversation_participants replica identity full;
alter table message_attachments replica identity full;
alter table message_reactions replica identity full;
alter table push_subscriptions replica identity full;
```

---

## Verificación post-aplicación

Después de aplicar ambas migraciones:

1. **El chat debe volver a funcionar** (el código ya lee `muted_until`)
2. **Mensajes en vivo**: enviar un mensaje entre dos cuentas → debe aparecer sin recargar
3. **Ticks de lectura**: abrir en dos pestañas → marcar como leído debe reflejar el tick en vivo
4. **Silencio por duración**: silenciar conversación por 8h → debe mostrar "Silenciado hasta HH:MM"

---

## Archivos de referencia

- `supabase/migrations/0025_chat_mute_duration_read_at.sql`
- `supabase/migrations/0026_chat_realtime_publication_fix.sql`
- `docs/PENDIENTE-REALTIME-CHAT.md` (diagnóstico completo)
