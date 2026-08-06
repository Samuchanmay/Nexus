-- ═══════════════════════════════════════════════════════════════════
--  FASE W7 — Stickers Emu con generador IA real. Alcance confirmado por
--  el usuario: cualquiera escribe un prompt y se genera un sticker con
--  IA al vuelo, reusable después (biblioteca compartida, is_public=true
--  por defecto — mismo criterio simple que un pack de stickers normal).
--
--  El mensaje sigue siendo type='sticker' (ya existía, se usaba para
--  emoji-como-sticker) — se agrega sticker_image_path para el caso de
--  sticker con imagen real. Si es null, el cliente sigue tratando
--  `content` como el emoji (compatibilidad total con lo ya enviado).
--
--  La generación real corre en el Edge Function generate-sticker
--  (service role — sube a Storage e inserta aquí), NUNCA desde el
--  cliente directo, porque necesita la clave de OpenAI (ai_openai_api_key
--  vía nx_get_ai_config, ya existente — no se agrega un proveedor nuevo).
-- ═══════════════════════════════════════════════════════════════════

alter table public.messages add column if not exists sticker_image_path text;

create table if not exists public.chat_stickers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id) on delete cascade,
  prompt text not null,
  image_path text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_stickers_public on public.chat_stickers(created_at desc) where is_public;

comment on table public.chat_stickers is
  'Biblioteca de stickers "Emu" generados con IA (generate-sticker Edge Function). is_public=true los hace visibles/reusables por cualquiera en el picker — mismo criterio que un pack de stickers compartido.';

alter table public.chat_stickers enable row level security;

-- Cualquier usuario autenticado ve la biblioteca pública + la suya propia
-- (por si algún día is_public=false se usa); solo el propio Edge Function
-- (service role, bypassa RLS) inserta filas nuevas — no hay policy de
-- INSERT para clientes normales a propósito: la generación SIEMPRE pasa
-- por el Edge Function (control de costo/moderación centralizado).
create policy chat_stickers_read on public.chat_stickers for select using (
  is_public or creator_id = my_user_id()
);
