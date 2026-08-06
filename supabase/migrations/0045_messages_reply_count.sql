-- ═══════════════════════════════════════════════════════════════════
--  FASE W7 — Hilos en el chat. reply_to_id ya existía (se usaba para la
--  cita "respondiendo a…" en línea); esta columna es NUEVA: cuenta
--  cuántas respuestas tiene un mensaje, para pintar "3 respuestas" bajo
--  el mensaje raíz sin depender de que el cliente tenga cargado TODO el
--  historial (los mensajes se paginan — ver MAX_MESSAGES_BEFORE_TRIM en
--  chat/[id]/client.tsx — así que contar del lado del cliente
--  subestimaría hilos viejos que salieron de la ventana cargada).
--
--  Mismo patrón que trg_enlace_touch_conversation (AFTER INSERT en
--  messages, ya existente) — se agrega un trigger hermano en vez de
--  inventar otra arquitectura.
-- ═══════════════════════════════════════════════════════════════════

alter table public.messages add column if not exists reply_count integer not null default 0;

create or replace function public.trg_messages_reply_count() returns trigger
language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    if new.reply_to_id is not null then
      update public.messages set reply_count = reply_count + 1 where id = new.reply_to_id;
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    if old.reply_to_id is not null then
      update public.messages set reply_count = greatest(0, reply_count - 1) where id = old.reply_to_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_messages_reply_count on public.messages;
create trigger trg_messages_reply_count
  after insert or delete on public.messages
  for each row execute function public.trg_messages_reply_count();
