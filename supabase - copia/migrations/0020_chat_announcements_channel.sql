-- FASE W6 (cierre) — Canal de Anuncios: la única pieza que quedó fuera de
-- la ronda 1 (ver comentario de 0011_enlace_mvp.sql). Un solo canal para
-- toda la empresa (single-tenant, igual que el resto del esquema): admin
-- publica, empleado solo lee. Se modela como un tercer `type` de
-- conversación en vez de una tabla aparte para reusar TODO lo que ya
-- funciona (lista, realtime, adjuntos, reacciones, fijado, no-leídos).

alter table public.conversations drop constraint conversations_type_check;
alter table public.conversations add constraint conversations_type_check
  check (type = any (array['direct'::text, 'group'::text, 'announcement'::text]));

-- Idempotente + auto-sanador: quien sea que la llame (se hace desde
-- chat/layout.tsx en cada carga) garantiza que el canal existe y que su
-- membresía/roles reflejan el equipo activo actual — altas, bajas de
-- actividad y promociones a admin no requieren backfill manual.
create or replace function public.nx_enlace_get_or_create_announcement()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := my_user_id();
  v_conv_id uuid;
begin
  if v_me is null then
    raise exception 'No autenticado';
  end if;
  if my_role() not in ('admin', 'empleado') then
    raise exception 'El chat es solo para el equipo interno';
  end if;

  select id into v_conv_id from conversations where type = 'announcement' and deleted_at is null limit 1;

  if v_conv_id is null then
    insert into conversations (type, name, created_by) values ('announcement', 'Anuncios', v_me) returning id into v_conv_id;
  end if;

  insert into conversation_participants (conversation_id, user_id, role)
  select v_conv_id, u.id, case when u.role = 'admin' then 'admin' else 'member' end
  from users u
  where u.active = true and u.role in ('admin', 'empleado')
    and not exists (
      select 1 from conversation_participants cp
      where cp.conversation_id = v_conv_id and cp.user_id = u.id
    )
  on conflict do nothing;

  update conversation_participants cp
  set role = case when u.role = 'admin' then 'admin' else 'member' end
  from users u
  where cp.conversation_id = v_conv_id and cp.user_id = u.id
    and cp.role <> (case when u.role = 'admin' then 'admin' else 'member' end);

  return v_conv_id;
end;
$function$;

-- Solo admins pueden publicar en un canal de anuncios — el resto de la
-- lógica de esta política (quién puede mandar mensajes en general) queda
-- igual para direct/group.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
with check (
  sender_id = my_user_id()
  and type = any (array['text'::text, 'image'::text, 'file'::text])
  and exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = my_user_id()
      and (
        not exists (select 1 from conversations c where c.id = messages.conversation_id and c.type = 'announcement')
        or cp.role = 'admin'
      )
  )
);
