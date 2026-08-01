-- FASE W6 (ronda 1) — Enlace: módulo de mensajería interna.
--
-- Adaptado de EQUIPO-ARCHITECTURE.md / EQUIPO-DESIGN.md (documentos de
-- referencia, no implementados literalmente): el diseño original es
-- multi-tenant (organization_id en cada tabla, RLS vía my_org_id()). Nexus
-- hoy es de un solo tenant (CERT) — se decidió con el usuario (2026-07-28)
-- no adelantar esa complejidad: sin organization_id en ninguna tabla nueva.
-- Cuando exista la migración a multi-tenant (plan emet.uno), se agrega
-- organization_id a TODO el esquema de una vez, no solo aquí.
--
-- Alcance de esta ronda (deliberadamente mínimo, ver EQUIPO-DESIGN.md §22
-- "Fundamentos"): conversaciones directas y de grupo, mensajes de texto,
-- envío y lectura en vivo. Fuera de esta ronda (backlog real, no olvidado):
-- archivos adjuntos, reacciones, mensajes fijados, canal de anuncios,
-- tarjetas inteligentes, EMU, bandeja "Necesita mi atención", búsqueda,
-- push notifications (no existe infraestructura FCM todavía), editar/
-- eliminar mensaje, archivar/silenciar conversación, panel rápido.
--
-- Otra desviación deliberada del documento: el documento propone que todo
-- envío pase por una Edge Function que hace broadcast manual por
-- Realtime. Para esta ronda se usa el patrón que YA funciona en Nexus
-- (ver src/components/os/notifications.tsx): INSERT directo del cliente
-- (autorizado por RLS) + suscripción postgres_changes, que Supabase
-- Realtime ya autoriza por RLS de forma nativa. Evita construir una Edge
-- Function nueva (con su propia superficie de CORS) el mismo día que se
-- corrigió un apagón de producción por un error de CORS en otra función.
-- La Edge Function se añade cuando de verdad haga falta lógica de servidor
-- (menciones → bandeja de atención, push a ausentes) — no antes.

-- ── Tablas ──────────────────────────────────────────────────────────────

create table conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  name text,                    -- NULL para directas, requerido para grupo
  avatar_url text,
  created_by uuid not null references users(id),
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid references users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conversations_last_message
  on conversations(last_message_at desc nulls last) where deleted_at is null;

create table conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id),
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

create index idx_participants_conversation on conversation_participants(conversation_id);
create index idx_participants_user on conversation_participants(user_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id),
  type text not null default 'text' check (type in ('text', 'system')),
  content text,
  reply_to_id uuid references messages(id),
  edited boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_messages_conversation on messages(conversation_id, created_at desc);

-- ── Trigger: denormalizar último mensaje en la conversación ───────────
-- SECURITY DEFINER a propósito: si dependiera de RLS del invocador (el
-- remitente), necesitaría una policy UPDATE en conversations que no existe
-- en esta ronda (la edición de conversación se deja para cuando haya UI
-- real de "editar grupo"). El trigger corre con privilegios del dueño de
-- la función, no del usuario — comportamiento intencional y acotado a
-- exactamente esta actualización.
create or replace function nx_enlace_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
  set last_message_at = new.created_at,
      last_message_preview = left(coalesce(new.content, ''), 120),
      last_message_sender_id = new.sender_id,
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger trg_enlace_touch_conversation
  after insert on messages
  for each row
  execute function nx_enlace_touch_conversation();

-- ── RPCs de creación (única vía para crear conversaciones en esta ronda) ─
-- Sin policy INSERT en conversations/conversation_participants para el rol
-- authenticated: la única forma de crear una conversación es a través de
-- estas dos funciones SECURITY DEFINER, que validan reglas de negocio
-- (2 participantes en directa, sin duplicados, admin automático en grupo)
-- que una policy declarativa no puede expresar bien.

create or replace function nx_enlace_get_or_create_direct(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_conv_id uuid;
begin
  if v_me is null then
    raise exception 'No autenticado';
  end if;
  if v_me = p_other_user_id then
    raise exception 'No puedes iniciar una conversación contigo mismo';
  end if;
  if not exists (select 1 from users where id = p_other_user_id and active = true) then
    raise exception 'Usuario no encontrado';
  end if;

  select c.id into v_conv_id
  from conversations c
  where c.type = 'direct'
    and c.deleted_at is null
    and exists (select 1 from conversation_participants where conversation_id = c.id and user_id = v_me)
    and exists (select 1 from conversation_participants where conversation_id = c.id and user_id = p_other_user_id)
    and (select count(*) from conversation_participants where conversation_id = c.id) = 2
  limit 1;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  insert into conversations (type, created_by) values ('direct', v_me) returning id into v_conv_id;
  insert into conversation_participants (conversation_id, user_id, role) values
    (v_conv_id, v_me, 'member'),
    (v_conv_id, p_other_user_id, 'member');

  return v_conv_id;
end;
$$;

create or replace function nx_enlace_create_group(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := my_user_id();
  v_conv_id uuid;
  v_member uuid;
  v_clean_name text := trim(coalesce(p_name, ''));
begin
  if v_me is null then
    raise exception 'No autenticado';
  end if;
  if length(v_clean_name) = 0 then
    raise exception 'El grupo necesita un nombre';
  end if;
  if p_member_ids is null or array_length(p_member_ids, 1) is null or array_length(p_member_ids, 1) < 1 then
    raise exception 'Selecciona al menos un integrante';
  end if;
  if array_length(p_member_ids, 1) > 19 then
    raise exception 'Máximo 20 integrantes por grupo';
  end if;

  insert into conversations (type, name, created_by) values ('group', v_clean_name, v_me) returning id into v_conv_id;
  insert into conversation_participants (conversation_id, user_id, role) values (v_conv_id, v_me, 'admin');

  foreach v_member in array p_member_ids loop
    if v_member <> v_me then
      insert into conversation_participants (conversation_id, user_id, role)
      values (v_conv_id, v_member, 'member')
      on conflict do nothing;
    end if;
  end loop;

  return v_conv_id;
end;
$$;

grant execute on function nx_enlace_get_or_create_direct(uuid) to authenticated;
grant execute on function nx_enlace_create_group(text, uuid[]) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────

alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;

-- conversations: solo lectura directa por el cliente (creación vía RPC).
create policy conversations_select on conversations
  for select using (
    deleted_at is null
    and exists (
      select 1 from conversation_participants
      where conversation_id = conversations.id and user_id = my_user_id()
    )
  );

-- conversation_participants: lectura de participantes de conversaciones
-- propias (patrón estándar de auto-referencia para chat, documentado por
-- Supabase; a esta escala — 20 usuarios — no es un problema de rendimiento).
create policy participants_select on conversation_participants
  for select using (
    exists (
      select 1 from conversation_participants cp2
      where cp2.conversation_id = conversation_participants.conversation_id
        and cp2.user_id = my_user_id()
    )
  );

-- messages: leer y enviar solo si eres participante. Edición/eliminación
-- se deja para cuando haya UI real (ronda 2).
create policy messages_select on messages
  for select using (
    exists (
      select 1 from conversation_participants
      where conversation_id = messages.conversation_id and user_id = my_user_id()
    )
  );

create policy messages_insert on messages
  for insert with check (
    sender_id = my_user_id()
    and type = 'text'
    and exists (
      select 1 from conversation_participants
      where conversation_id = messages.conversation_id and user_id = my_user_id()
    )
  );

-- ── Realtime ────────────────────────────────────────────────────────────
-- postgres_changes ya respeta RLS del usuario conectado (mismo patrón que
-- notifications, ver notifications.tsx) — no se necesita Edge Function
-- para el broadcast en esta ronda.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
