-- ═══════════════════════════════════════════════════════════════════
--  0051 — vacations.resolved_by / resolved_at (Reporte de Vacaciones)
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: el nuevo Reporte 2 (Vacaciones) pide columna "Quién
--  autorizó" por solicitud. La tabla vacations solo guardaba admin_note
--  (texto libre) — sin quién ni cuándo se decidió. Se agregan dos
--  columnas reales y se actualiza la RPC approve_vacation (única vía de
--  aprobación — atómica, ver migración 0002_f0_fixes.sql) para llenarlas
--  usando public.my_user_id(), que ya existe para este propósito.
--
--  El rechazo NO pasa por RPC (update directo desde
--  admin/vacaciones/client.tsx) — ese código se actualiza en el mismo
--  cambio para mandar resolved_by/resolved_at explícitos.
--
--  Histórico: las solicitudes ya decididas antes de este cambio quedan
--  con resolved_by/resolved_at en NULL — es un dato real que no existe,
--  no se inventa un responsable retroactivo.
-- ═══════════════════════════════════════════════════════════════════

alter table public.vacations
  add column if not exists resolved_by uuid references public.users(id),
  add column if not exists resolved_at timestamptz;

comment on column public.vacations.resolved_by is
  'Quién aprobó/rechazó la solicitud (Reporte de Vacaciones, 7 ago 2026). NULL = pendiente o decidida antes de esta columna.';
comment on column public.vacations.resolved_at is
  'Cuándo se aprobó/rechazó — acompaña a resolved_by.';

-- Reescribe approve_vacation (misma firma, mismo contrato transaccional)
-- para registrar quién aprobó usando my_user_id().
create or replace function public.approve_vacation(p_vacation_id uuid, p_note text default null)
returns table (new_balance int) language plpgsql security definer set search_path = public as $$
declare
  v record;
begin
  if public.my_role() <> 'admin' then
    raise exception 'Solo el administrador puede aprobar vacaciones';
  end if;

  select * into v from public.vacations where id = p_vacation_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v.status <> 'Pendiente' then raise exception 'La solicitud ya fue decidida (%).', v.status; end if;

  update public.users
     set vacation_balance = vacation_balance - v.days
   where id = v.user_id and vacation_balance >= v.days;
  if not found then
    raise exception 'Saldo insuficiente: la solicitud pide % días', v.days;
  end if;

  update public.vacations
     set status = 'Aprobada', admin_note = coalesce(p_note, admin_note),
         resolved_by = public.my_user_id(), resolved_at = now()
   where id = p_vacation_id;

  return query select vacation_balance from public.users where id = v.user_id;
end $$;

revoke all on function public.approve_vacation(uuid, text) from public;
grant execute on function public.approve_vacation(uuid, text) to authenticated;
