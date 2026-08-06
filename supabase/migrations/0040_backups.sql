-- ══════════════════════════════════════════════════════════════════
--  0040 — Backups + restauración (FASE W8.1)
--  ══════════════════════════════════════════════════════════════════
--  Respaldo bajo demanda de las tablas operativas críticas (asistencia,
--  vacaciones, incidencias, eventos, proyectos, catálogos...). Se
--  excluyen a propósito: chat (privacidad + ya vive en Realtime),
--  demos/onboarding (no es dato operativo), y cualquier tabla con
--  secretos (google_oauth_tokens, mfa_recovery_codes, push_subscriptions,
--  known_devices) — un respaldo nunca debe poder filtrar credenciales.
--
--  Cada respaldo es un único JSON subido al bucket privado 'backups'
--  (solo admin, mismo patrón que el bucket 'demos' de la migración
--  0023). La fila en `backups` es el índice: qué tablas incluye, cuántas
--  filas trajo cada una y dónde vive el archivo.
--
--  Restauración: por tabla, vía upsert (nunca DELETE) — restaurar un
--  respaldo viejo jamás borra filas que ya existan hoy y no estén en el
--  respaldo, solo inserta/actualiza las que sí vienen en el JSON. La
--  lógica de restauración vive en la API route (no aquí), porque hace
--  falta poder acotar la restauración a UNA tabla a la vez con
--  confirmación explícita del admin.
-- ══════════════════════════════════════════════════════════════════

create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  storage_path text not null,
  size_bytes bigint not null default 0,
  tables text[] not null default '{}',
  row_counts jsonb not null default '{}'::jsonb,
  status text not null default 'completo' check (status in ('completo', 'error')),
  error_message text
);

create index if not exists backups_created_at_idx on public.backups (created_at desc);

alter table public.backups enable row level security;

drop policy if exists backups_admin_all on public.backups;
create policy backups_admin_all on public.backups
  for all to authenticated
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

drop policy if exists backups_storage_admin on storage.objects;
create policy backups_storage_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'backups' and my_role() = 'admin')
  with check (bucket_id = 'backups' and my_role() = 'admin');
