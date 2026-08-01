-- ═══════════════════════════════════════════════════════════════════
--  0016 — Chat: Realtime + Storage
--  ═══════════════════════════════════════════════════════════════════
--  Depende de: 0013_chat_schema.sql, 0014_chat_rls.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Realtime publications ─────────────────────────────────────
alter publication supabase_realtime add table message_attachments;
alter publication supabase_realtime add table message_reactions;

-- ── 2. Storage bucket ────────────────────────────────────────────
-- NOTA: Esto debe ejecutarse desde Supabase Dashboard o CLI:
--   supabase storage create chat-files --public=false
--
-- Luego configurar RLS en Storage:
--   - SELECT: authenticated users can read files in conversations
--     they participate in (misma lógica que attachments_select)
--   - INSERT: authenticated users can upload to their own
--     conversation folders
