-- FASE self-service — teléfono editable por el propio empleado.
--
-- Contexto (auditoría 4 ago 2026, docs/AUDITORIA-LOGICA-NEGOCIO.md): hoy
-- profile-modal.tsx no tiene NINGÚN campo de teléfono — el empleado no puede
-- verlo ni editarlo, solo un admin puede escribirlo desde Equipo/Directorio.
-- Se decidió (con el admin) que es dato de contacto de bajo riesgo, no
-- sensible como rol/vacaciones/salario/email, y que dejarlo auto-editable
-- reduce captura manual del admin y mantiene el contacto al día — mismo
-- criterio ya aplicado a birth_date/rfc/curp (ver comentario en
-- 0010_w5b_security_findings.sql).
--
-- Se quita `phone` de la lista de columnas protegidas de
-- trg_users_protect_self_update(); `extension` se queda protegida (esa sí
-- la asigna el admin según la estructura interna, no el propio empleado).
create or replace function public.trg_users_protect_self_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.my_role() = 'admin' then return new; end if;
  if new.role                   is distinct from old.role
  or new.vacation_balance       is distinct from old.vacation_balance
  or new.vacation_days_per_year is distinct from old.vacation_days_per_year
  or new.vacation_balance_reset is distinct from old.vacation_balance_reset
  or new.hire_date              is distinct from old.hire_date
  or new.termination_date       is distinct from old.termination_date
  or new.active                 is distinct from old.active
  or new.email                  is distinct from old.email
  or new.nexus_clave            is distinct from old.nexus_clave
  or new.requester_kind         is distinct from old.requester_kind
  or new.nexus_color            is distinct from old.nexus_color
  or new.specialties            is distinct from old.specialties
  or new.area                   is distinct from old.area
  or new.nivel                  is distinct from old.nivel
  or new.extension              is distinct from old.extension then
    raise exception 'No puedes modificar ese campo de tu perfil';
  end if;
  return new;
end $function$;
