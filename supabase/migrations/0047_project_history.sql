-- ═══════════════════════════════════════════════════════════════════
--  0047 — Historial de cambios en Actividades (FASE W8 — versionado)
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: event_history (migración 0029) ya registra qué cambió en
--  un evento institucional y quién lo cambió, pero las Actividades
--  (tabla projects) no tienen equivalente — un cambio de estado,
--  prioridad o fecha límite no deja rastro visible más allá del
--  admin_activity_log genérico del sitio (que no es por-actividad).
--
--  Mismo patrón exacto que event_history: tabla simple (una fila por
--  cambio), sin trigger de base de datos — el cliente arma el resumen
--  legible ("Prioridad: normal → urgente") comparando antes/después y
--  hace el insert justo después de guardar, igual que
--  buildEventChanges() en admin/calendario/client.tsx.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.project_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  admin_id uuid references public.users(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

comment on table public.project_history is
  'Historial de cambios de una actividad (status/priority/deadline/evento vinculado) — mismo patrón que event_history. El cliente arma el resumen y hace el insert tras guardar, no hay trigger de BD.';

create index if not exists idx_project_history_project
  on public.project_history(project_id, created_at desc);

alter table public.project_history enable row level security;

-- Solo admin escribe (mismo criterio que event_history: hoy solo el admin
-- edita actividades desde saveProjectEdit/Pipeline).
create policy project_history_admin_insert on public.project_history
  for insert with check (my_role() = 'admin');

-- Lectura: mismo criterio que prj_read (proyectos) — admin, asignados a
-- la actividad, o quien la solicitó.
create policy project_history_read on public.project_history
  for select using (
    my_role() = 'admin'
    or exists (select 1 from public.project_assignments a where a.project_id = project_history.project_id and a.user_id = my_user_id())
    or exists (select 1 from public.projects p join public.requests r on r.id = p.request_id where p.id = project_history.project_id and r.requester_id = my_user_id())
  );
