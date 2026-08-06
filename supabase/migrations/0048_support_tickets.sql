-- ═══════════════════════════════════════════════════════════════════
--  0048 — Soporte interno: bandeja de tickets (FASE W8)
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: hasta hoy, si un empleado tenía un problema con la app (o
--  con cualquier otra cosa dentro de su trabajo diario) no tenía un
--  canal DENTRO de EMET para reportarlo — solo podía escribirle a un
--  admin por chat o de palabra, sin quedar registrado ni trackeado.
--
--  Alcance "simple" (decisión del usuario, 6 ago 2026): título +
--  descripción + categoría, bandeja del admin con 3 estados
--  (abierto/en_progreso/resuelto), un campo de respuesta del admin.
--  Sin SLA, sin prioridades, sin hilo de comentarios — si hace falta
--  ida y vuelta, se resuelve por chat (ya existe Enlace) y el ticket
--  solo queda como el registro + resolución final.
--
--  Mismo patrón de RLS que attendance_correction_requests (migración
--  0043): el empleado ve/crea los suyos, el admin ve/edita todos.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null default 'otro'
    check (category in ('tecnico', 'asistencia', 'nomina_rh', 'equipo_chat', 'cuenta', 'otro')),
  title text not null,
  description text not null,
  status text not null default 'abierto'
    check (status in ('abierto', 'en_progreso', 'resuelto')),
  admin_id uuid references public.users(id) on delete set null,
  admin_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.support_tickets is
  'Bandeja interna de soporte — el empleado reporta un problema (título+descripción+categoría), el admin cambia el estado y responde. Sin SLA ni hilo de comentarios (alcance simple, ver decisión 6 ago 2026).';
comment on column public.support_tickets.category is 'tecnico, asistencia, nomina_rh, equipo_chat, cuenta, otro.';
comment on column public.support_tickets.status is 'abierto, en_progreso, resuelto.';

create index if not exists idx_support_tickets_status
  on public.support_tickets(status) where status <> 'resuelto';
create index if not exists idx_support_tickets_user
  on public.support_tickets(user_id, created_at desc);

alter table public.support_tickets enable row level security;

create policy st_insert_own on public.support_tickets
  for insert with check (user_id = my_user_id());

create policy st_read on public.support_tickets
  for select using (user_id = my_user_id() or my_role() = 'admin');

create policy st_admin_update on public.support_tickets
  for update using (my_role() = 'admin') with check (my_role() = 'admin');

-- updated_at se mantiene fresco en cada cambio (mismo criterio que otras
-- tablas con updated_at en el proyecto — trigger simple, no depende de
-- que el cliente se acuerde de mandarlo).
create or replace function public.trg_support_tickets_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_support_tickets_touch on public.support_tickets;
create trigger trg_support_tickets_touch
  before update on public.support_tickets
  for each row execute function public.trg_support_tickets_touch();
