-- FASE W5 — Endurecimiento de seguridad, hallazgos del advisor de Supabase.
--
-- 1) create_notification() (ambas sobrecargas) NO validaba quién la llama:
--    cualquier usuario autenticado podía invocar directamente
--    /rest/v1/rpc/create_notification con cualquier p_user_id, sin pasar
--    por la UI — falsificando notificaciones a nombre de quien fuera. Se
--    revisó cada llamador real en el código (src/lib/notify.ts::notifyUser)
--    y los tres únicos usos son siempre desde pantallas de Administrador
--    (admin/solicitudes, admin/incidencias, admin/vacaciones). notify_admins
--    NO se toca: sus llamadores sí son legítimamente empleados normales
--    (avisar a los admins de su propia solicitud/vacación), y su destino
--    siempre son los admins — no hay usuario arbitrario que falsificar.
--    Mismo patrón de guardia que ya usan approve_vacation/cancel_vacation/
--    edit_vacation/register_vacation_direct.
create or replace function public.create_notification(
  p_user_id uuid, p_title text, p_body text default null::text, p_kind text default 'info'::text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.my_role() <> 'admin' then
    raise exception 'Solo el administrador puede notificar a otra persona';
  end if;
  insert into public.notifications (user_id, title, body, kind)
  values (p_user_id, p_title, p_body, p_kind);
end;
$function$;

create or replace function public.create_notification(
  p_user_id uuid, p_title text, p_body text default null::text, p_kind text default 'info'::text, p_link text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.my_role() <> 'admin' then
    raise exception 'Solo el administrador puede notificar a otra persona';
  end if;
  insert into public.notifications (user_id, title, body, kind, link)
  values (p_user_id, p_title, p_body, p_kind, p_link);
end;
$function$;

-- 2) touch_google_oauth_tokens() tenía search_path mutable (lint del
--    advisor) — se fija igual que el resto de funciones de la BD.
create or replace function public.touch_google_oauth_tokens()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- Nota (no requiere cambio de código): el advisor también marca
-- `google_oauth_tokens` con RLS activo y CERO políticas. Se verificó que
-- es intencional — esa tabla solo se lee/escribe desde el callback de
-- OAuth (src/app/auth/callback/route.ts) y las Edge Functions de Google
-- Calendar/Drive, todas con la service role, que ignora RLS por diseño.
-- Cero políticas = cero acceso posible desde el cliente (anon/authenticated),
-- que es el estado más seguro posible para tokens de OAuth.
