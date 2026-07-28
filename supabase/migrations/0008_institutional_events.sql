-- FASE U — Calendarios institucionales. Fusionados dentro del Calendario
-- general existente (no una pantalla aparte): eventos administrados
-- directamente por Administrador (académico, evento, administrativo,
-- aviso), visibles para todos los roles autenticados como una capa más
-- junto a días inhábiles, actividades y vacaciones. Mismo patrón de RLS
-- que `holidays` (admin ALL, resto solo lectura).
create table public.institutional_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'evento' check (kind in ('academico','evento','administrativo','aviso')),
  start_date date not null,
  end_date date not null,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.institutional_events enable row level security;

create policy ie_admin on public.institutional_events for all to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

create policy ie_read on public.institutional_events for select to authenticated
  using (true);

create index institutional_events_range_idx on public.institutional_events (start_date, end_date);
