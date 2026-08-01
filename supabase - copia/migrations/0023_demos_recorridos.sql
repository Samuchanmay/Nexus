-- ============================================================
--  RECORRIDOS - Demos interactivas (onboarding primer login)
--  CERT Comunicacion | Derivado de Fable (Apache 2.0)
--  Ejecutar en: SQL Editor del panel de Supabase
--  Depende del esquema Nexus (public.users con auth_id y role)
-- ============================================================

-- ============================================================
-- 1. TABLAS
-- ============================================================

-- Demo: unidad principal del tour
create table public.demos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  thumbnail_url text,
  status text not null default 'borrador' check (status in ('borrador','publicado')),
  target_role text not null default 'todos' check (target_role in ('todos','admin','empleado','rh','coordinador','departamento')),
  created_by uuid references public.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pantallas que componen la demo (snapshots JSON capturados por la extension)
create table public.demo_screens (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demos(id) on delete cascade,
  screen_index int not null,
  snapshot_url text not null,
  thumbnail_url text,
  interaction_ctx jsonb not null default '{}'::jsonb,
  unique (demo_id, screen_index)
);

-- Assets proxeados (imagenes/css capturadas por la extension)
create table public.demo_assets (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demos(id) on delete cascade,
  original_url text not null,
  proxied_url text not null
);

-- Hubs (futuro: agrupacion de demos por area) - reservado
create table public.demo_hubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Analytics de visualizacion de demos
create table public.demo_views (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demos(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event text not null check (event in ('abierta','clic','completada')),
  created_at timestamptz not null default now()
);

create index demo_screens_demo_idx on public.demo_screens(demo_id);
create index demo_views_demo_idx on public.demo_views(demo_id);
create index demo_views_user_idx on public.demo_views(user_id);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================

alter table public.demos enable row level security;
alter table public.demo_screens enable row level security;
alter table public.demo_assets enable row level security;
alter table public.demo_hubs enable row level security;
alter table public.demo_views enable row level security;

-- El acceso de lectura de miembros se hace via RPC (abajo).
-- En las tablas de detalle solo los admins acceden directo.

-- DEMOS: admin hace todo; lecturas pasan por RPC get_onboarding_demos
create policy demos_admin_all on public.demos
  for all to authenticated
  using (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'));

-- DEMO_SCREENS: solo admin directo (el reproductor lee via RPC)
create policy demo_screens_admin_all on public.demo_screens
  for all to authenticated
  using (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'));

-- DEMO_ASSETS: solo admin
create policy demo_assets_admin_all on public.demo_assets
  for all to authenticated
  using (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'));

-- DEMO_HUBS: solo admin
create policy demo_hubs_admin_all on public.demo_hubs
  for all to authenticated
  using (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'));

-- DEMO_VIEWS: cualquier miembro registra su evento (insert), nadie lee la de otros
create policy demo_views_member_insert on public.demo_views
  for insert to authenticated
  with check (true);

-- ============================================================
-- 3. RPC (lecturas controladas)
-- ============================================================

-- Demos publicadas que un miembro debe ver en su onboarding
-- (filtra por target_role del usuario logueado)
create or replace function public.get_onboarding_demos()
returns setof public.demos
language sql stable security definer
set search_path = public
as $$
  select d.*
  from public.demos d
  where d.status = 'publicado'
    and (d.target_role = 'todos'
         or d.target_role = (select u.role from public.users u where u.auth_id = auth.uid()));
$$;

-- Demo completa (demo + pantallas) por slug, para embebido publico o onboarding
create or replace function public.get_public_demo(p_slug text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'demo', to_jsonb(d),
    'screens', coalesce(jsonb_agg(
      jsonb_build_object(
        'index', s.screen_index,
        'snapshot_url', s.snapshot_url,
        'thumbnail_url', s.thumbnail_url,
        'interaction_ctx', s.interaction_ctx
      ) order by s.screen_index
    ), '[]'::jsonb)
  )
  from public.demos d
  left join public.demo_screens s on s.demo_id = d.id
  where d.slug = p_slug and d.status = 'publicado'
  group by d.id;
$$;

-- ============================================================
-- 4. STORAGE (buckets)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('demos', 'demos', false),
       ('demos-public', 'demos-public', true)
on conflict (id) do nothing;

-- Bucket privado 'demos': solo admin sube/lee/borra
create policy demos_storage_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'demos'
         and exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'))
  with check (bucket_id = 'demos'
         and exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'));
