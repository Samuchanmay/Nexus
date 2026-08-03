-- ═══════════════════════════════════════════════════════════════════
--  0023 — Chat: bucket privado + RLS Storage + pipeline de imagen
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: el bucket `chat-files` se creaba a mano (solo estaba
--  documentado en 0016). Esta migración lo crea/idempotente y añade las
--  policies de RLS en storage.objects: solo un participante de la
--  conversación puede leer/subir objetos dentro de su carpeta.
--
--  Además prepara el pipeline de imagen (thumb/medium/original en WebP):
--  columnas derivadas en message_attachments apuntando a los objetos
--  procesados en el cliente.
--  Depende de: 0014 (RLS messages/attachments), 0011 (participantes).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Bucket privado (25 MB por objeto, como valida el cliente) ─────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 26214400, null)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. RLS en storage.objects ────────────────────────────────────────
-- La ruta de cada objeto es `<conversation_id>/<uuid>.<ext>`; la policy
-- deriva la conversación del primer segmento del nombre y exige
-- participación. `my_user_id()` mapea auth.uid() → public.users.id.

drop policy if exists "chat_files_select_member" on storage.objects;
create policy "chat_files_select_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-files'
    and (
      exists (
        select 1 from conversation_participants cp
        where cp.conversation_id = split_part(storage.objects.name, '/', 1)
          and cp.user_id = public.my_user_id()
      )
    )
  );

drop policy if exists "chat_files_insert_member" on storage.objects;
create policy "chat_files_insert_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-files'
    and (
      exists (
        select 1 from conversation_participants cp
        where cp.conversation_id = split_part(storage.objects.name, '/', 1)
          and cp.user_id = public.my_user_id()
      )
    )
  );

-- ── 3. Pipeline de imagen: columnas derivadas en message_attachments ─
-- thumb/medium apuntan a objetos WebP generados en el cliente
-- (image-resize.worker.ts); `file_path` sigue siendo el original.
-- NULL para adjuntos antiguos o no-imagen (el render cae a `file_path`).
alter table message_attachments
  add column if not exists thumb_path text,
  add column if not exists thumb_size bigint,
  add column if not exists thumb_mime text,
  add column if not exists medium_path text,
  add column if not exists medium_size bigint,
  add column if not exists medium_mime text;
