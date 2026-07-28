-- FASE W5b — Hallazgos de AUDITORIA-PROFUNDA.md, verificados contra el
-- código y la BD real (no contra el documento, que cita un schema.sql
-- desactualizado). Cubre S-03 y S-05.

-- ───────────────────────────────────────────────────────────────────
-- S-03 — Al verificar contra la BD real (no contra el schema.sql
-- desactualizado que cita el audit) resultó que YA existía un trigger
-- para esto — `users_protect_self_update` / trg_users_protect_self_update()
-- — de una sesión anterior no reflejada en supabase/migrations/. Bloqueaba
-- ya `role`, `vacation_balance`, `vacation_days_per_year`, `hire_date`,
-- `active`, `email`, `nexus_clave` con un error explícito (no silencioso)
-- si quien escribe no es admin. Es decir: la escalada de privilegios de rol
-- que reportaba el audit YA estaba cerrada.
--
-- Lo que SÍ faltaba: varias columnas sensibles que el trigger original no
-- cubría (requester_kind, nexus_color, specialties, area, termination_date,
-- vacation_balance_reset, nivel, phone, extension). Se AMPLÍA la función
-- existente (mismo nombre, mismo trigger, mismo estilo de error explícito)
-- en vez de crear un trigger paralelo.
--
-- birth_date/rfc/curp NO se agregan a la lista — components/os/profile-modal.tsx
-- deja que cada quien edite su propia fecha de nacimiento, RFC y CURP, y
-- eso es legítimo. hire_date ya estaba protegido desde antes de esta ronda
-- (correcto: es dato de RH) — el campo editable de "Fecha de ingreso" en
-- ProfileModal se vuelve solo-lectura en el mismo cambio, ya que antes
-- dejaba editarlo en la UI pero el guardado fallaba en silencio.
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
  or new.phone                  is distinct from old.phone
  or new.extension              is distinct from old.extension then
    raise exception 'No puedes modificar ese campo de tu perfil';
  end if;
  return new;
end $function$;

-- ───────────────────────────────────────────────────────────────────
-- S-05 (aditivo, no rompe nada) — `users_read` deja leer TODAS las
-- columnas de TODOS los usuarios a cualquier autenticado (email,
-- teléfono, RFC/CURP, fecha de nacimiento/contratación, saldo de
-- vacaciones). El propio código ya asume una frontera más angosta para
-- Coordinador/Departamento/RH ("Directorio Institucional: solo lookup de
-- contacto" — comentario en empleados/client.tsx), pero RLS no la
-- impone: esos roles pueden pedir cualquier columna vía API directa.
--
-- No se endurece `users_read` en esta migración (requiere auditar cada
-- .from("users").select(...) de la app para no romper lecturas
-- legítimas de admin/self). En su lugar se agrega esta vista, de solo
-- lectura y sin RFC/CURP/salarios/fechas sensibles, para que las
-- pantallas de directorio (Coordinador/Departamento/RH) migren a ella
-- cuando se audite ese flujo con calma.
create or replace view public.users_directory
with (security_invoker = true) as
  select id, display_name, full_name, avatar_url, role, title, honorific,
         area, area_id, nexus_color, active, phone, extension
  from public.users;

comment on view public.users_directory is
  'Lectura segura para roles de solo-directorio (Coordinador/Departamento/RH) — sin email, RFC/CURP, fechas de nacimiento/contratación ni saldos de vacaciones. Pendiente: migrar esas pantallas de public.users a esta vista (S-05).';
