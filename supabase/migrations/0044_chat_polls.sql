-- ═══════════════════════════════════════════════════════════════════
--  FASE W7 — Encuestas en el chat (Enlace). Alcance confirmado por el
--  usuario: opción única o múltiple, resultados en vivo. Sin voto
--  anónimo configurable ni cierre programado (eso queda para una fase
--  futura si se pide).
--
--  La encuesta vive como un mensaje más (messages.type = 'poll') para
--  que aparezca en el orden cronológico normal del chat, reutilizando
--  toda la infraestructura ya existente (Realtime sobre `messages`,
--  paginación, búsqueda, reenvío). chat_polls cuelga 1:1 de ese mensaje.
-- ═══════════════════════════════════════════════════════════════════

alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type = any (array['text','system','image','file','location','sticker','poll']));

create table if not exists public.chat_polls (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  creator_id uuid not null references public.users(id),
  question text not null,
  multiple_choice boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_chat_polls_message on public.chat_polls(message_id);

create table if not exists public.chat_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.chat_polls(id) on delete cascade,
  label text not null,
  position int not null default 0
);
create index if not exists idx_chat_poll_options_poll on public.chat_poll_options(poll_id);

create table if not exists public.chat_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.chat_polls(id) on delete cascade,
  option_id uuid not null references public.chat_poll_options(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, option_id, user_id)
);
create index if not exists idx_chat_poll_votes_poll on public.chat_poll_votes(poll_id);

alter table public.chat_polls enable row level security;
alter table public.chat_poll_options enable row level security;
alter table public.chat_poll_votes enable row level security;

-- Mismo criterio que el resto de Enlace: solo participantes de la
-- conversación pueden ver/interactuar. Se reutiliza conversation_participants
-- (ya existe, es la fuente de verdad de membresía de Enlace).
create policy chat_polls_rw on public.chat_polls for all using (
  exists (select 1 from public.conversation_participants cp where cp.conversation_id = chat_polls.conversation_id and cp.user_id = my_user_id())
) with check (
  exists (select 1 from public.conversation_participants cp where cp.conversation_id = chat_polls.conversation_id and cp.user_id = my_user_id())
);

create policy chat_poll_options_rw on public.chat_poll_options for all using (
  exists (
    select 1 from public.chat_polls p
    join public.conversation_participants cp on cp.conversation_id = p.conversation_id
    where p.id = chat_poll_options.poll_id and cp.user_id = my_user_id()
  )
) with check (
  exists (
    select 1 from public.chat_polls p
    join public.conversation_participants cp on cp.conversation_id = p.conversation_id
    where p.id = chat_poll_options.poll_id and cp.user_id = my_user_id()
  )
);

-- Votos: cualquier participante lee todos los votos del poll (para calcular
-- % en vivo); solo puede insertar/borrar SUS PROPIOS votos.
create policy chat_poll_votes_read on public.chat_poll_votes for select using (
  exists (
    select 1 from public.chat_polls p
    join public.conversation_participants cp on cp.conversation_id = p.conversation_id
    where p.id = chat_poll_votes.poll_id and cp.user_id = my_user_id()
  )
);
create policy chat_poll_votes_insert_own on public.chat_poll_votes for insert with check (user_id = my_user_id());
create policy chat_poll_votes_delete_own on public.chat_poll_votes for delete using (user_id = my_user_id());
