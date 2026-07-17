-- Agrega columna "link" a notifications para que cada notificación pueda
-- llevar al usuario directo a la pantalla relevante al hacer clic (ej. la
-- solicitud de vacaciones que la generó), en vez de ser solo informativa.
alter table public.notifications add column if not exists link text;

create or replace function public.create_notification(p_user_id uuid, p_title text, p_body text default null::text, p_kind text default 'info'::text, p_link text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.notifications (user_id, title, body, kind, link)
  values (p_user_id, p_title, p_body, p_kind, p_link);
end;
$function$;

create or replace function public.notify_admins(p_title text, p_body text default null::text, p_kind text default 'info'::text, p_link text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.notifications (user_id, title, body, kind, link)
  select id, p_title, p_body, p_kind, p_link from public.users where role = 'admin' and active = true;
end;
$function$;
