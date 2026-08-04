-- ═══════════════════════════════════════════════════════════════════
--  0033 — Chat: tabla de suscripciones Web Push
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: el cliente (src/lib/use-push-notifications.ts) y la Edge
--  Function send-chat-push YA estaban escritos y esperaban esta tabla —
--  nunca se creó, así que el push con la app cerrada no hacía nada
--  (fallaba en silencio, a propósito, como best-effort).
--
--  Esquema explícito según lo que ya consume send-chat-push/index.ts:
--    admin.from("push_subscriptions").select("id, user_id, subscription")
--    ...JSON.parse(sub.subscription as string)
--  → `subscription` es TEXTO (JSON.stringify de PushSubscription.toJSON()),
--    no jsonb — si fuera jsonb, supabase-js ya lo devolvería como objeto y
--    ese JSON.parse tronaría en runtime.
--
--  RLS: cada usuario administra sus propias suscripciones (las escribe su
--  propio navegador vía /api/push/subscribe, con su sesión). La Edge
--  Function lee con service_role — no necesita política de lectura.
--
--  Aditivo. No depende de nada nuevo (usa my_user_id(), ya existente).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null,
  subscription text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (endpoint)
);

create index if not exists idx_push_subscriptions_user
  on push_subscriptions(user_id);

comment on table push_subscriptions is 'Suscripciones Web Push del chat (una fila por navegador/dispositivo suscrito).';
comment on column push_subscriptions.endpoint is 'Endpoint único del push service del navegador — identifica el dispositivo/instalación.';
comment on column push_subscriptions.subscription is 'JSON.stringify(PushSubscription.toJSON()) completo — lo consume send-chat-push tal cual.';

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own_all" on push_subscriptions;
create policy "push_subscriptions_own_all"
  on push_subscriptions for all to authenticated
  using (user_id = my_user_id())
  with check (user_id = my_user_id());
