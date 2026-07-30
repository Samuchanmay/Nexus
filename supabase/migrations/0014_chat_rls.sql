-- ═══════════════════════════════════════════════════════════════════
--  0014 — Chat: RLS Policies
--  ═══════════════════════════════════════════════════════════════════
--  Depende de: 0013_chat_schema.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Corregir RLS messages_insert ──────────────────────────────
-- Antes: solo permitía type = 'text'
-- Ahora: permite text, image, file
drop policy if exists messages_insert on messages;
create policy messages_insert on messages
  for insert with check (
    sender_id = my_user_id()
    and type in ('text', 'image', 'file')
    and exists (
      select 1 from conversation_participants
      where conversation_id = messages.conversation_id and user_id = my_user_id()
    )
  );

-- ── 2. RLS para message_attachments ──────────────────────────────
alter table message_attachments enable row level security;

create policy attachments_select on message_attachments
  for select using (
    exists (
      select 1 from messages
      join conversation_participants
        on conversation_participants.conversation_id = messages.conversation_id
      where messages.id = message_attachments.message_id
        and conversation_participants.user_id = my_user_id()
    )
  );

create policy attachments_insert on message_attachments
  for insert with check (
    exists (
      select 1 from messages
      where messages.id = message_attachments.message_id
        and messages.sender_id = my_user_id()
    )
  );

-- ── 3. RLS para message_reactions ────────────────────────────────
alter table message_reactions enable row level security;

create policy reactions_select on message_reactions
  for select using (
    exists (
      select 1 from messages
      join conversation_participants
        on conversation_participants.conversation_id = messages.conversation_id
      where messages.id = message_reactions.message_id
        and conversation_participants.user_id = my_user_id()
    )
  );

create policy reactions_insert on message_reactions
  for insert with check (
    exists (
      select 1 from messages
      where messages.id = message_reactions.message_id
        and messages.sender_id = my_user_id()
    )
  );

create policy reactions_delete on message_reactions
  for delete using (
    user_id = my_user_id()
  );
