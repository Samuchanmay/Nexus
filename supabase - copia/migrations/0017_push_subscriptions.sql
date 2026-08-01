-- ═══ Push subscriptions para notificaciones del navegador ═══

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.push_subscriptions enable row level security;

-- Solo el usuario puede ver/modificar su propia suscripción
create policy "own_subscription"
  on public.push_subscriptions
  for all
  using (user_id = (select id from public.users where auth_id = auth.uid()))
  with check (user_id = (select id from public.users where auth_id = auth.uid()));

-- Los admins pueden ver todas (para enviar push)
create policy "admin_read_subscriptions"
  on public.push_subscriptions
  for select
  using (
    exists (
      select 1 from public.users
      where auth_id = auth.uid() and role = 'admin'
    )
  );
