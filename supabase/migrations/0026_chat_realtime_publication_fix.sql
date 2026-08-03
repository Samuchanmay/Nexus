-- ═══════════════════════════════════════════════════════════════════
--  0026 — Chat: arreglo de Realtime (publicación + REPLICA IDENTITY)
--  ═══════════════════════════════════════════════════════════════════
--  Síntoma: los mensajes y los estados (ticks de lectura, mute, pin,
--  archivar) solo llegan al recargar la página, nunca en vivo.
--
--  Causa raíz (documentada en el código y en la guía oficial de Supabase
--  "Realtime + postgres_changes"):
--   1. `conversation_participants` nunca se agregó a la publicación
--      `supabase_realtime` (0011/0016 solo cubren messages, conversations,
--      message_attachments, message_reactions). El canal `enlace-unread`
--      del layout escucha UPDATE en esa tabla con filtro `user_id=eq.…`
--      → ese canal nunca entrega nada.
--   2. Los eventos UPDATE/DELETE con FILTRO sobre una columna que no es la
--      PK (p. ej. `conversation_id=eq.X` para los ticks de lectura, o
--      `user_id=eq.X` en conversation_participants) exigen
--      `REPLICA IDENTITY FULL`: sin ello, Realtime no puede evaluar el
--      filtro contra la fila vieja y DESCARTÁ silenciosamente el evento.
--      El INSERT de mensajes sí funciona sin esto (fila nueva completa),
--      pero los ticks ✓✓→leído, editar/eliminar en vivo y el conteo de
--      no-leídos no.
--
--  Fix (configuración recomendada por Supabase para filtros en
--  postgres_changes). Aditivo e idempotente. Depende de: 0011, 0016.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Publicación: cubrir TODAS las tablas que el chat escucha ─────
-- (idempotente: añadir una tabla ya publicada no falla, y una tabla que
--  no existe todavía se cubrirá con la migración que la cree).
alter publication supabase_realtime add table conversation_participants;
alter publication supabase_realtime add table push_subscriptions;

-- ── 2. REPLICA IDENTITY FULL ────────────────────────────────────────
-- Necesario para que Realtime entregue los UPDATE/DELETE filtrados por
-- columnas no-PK (message_id, conversation_id, user_id, etc.).
alter table messages replica identity full;
alter table conversations replica identity full;
alter table conversation_participants replica identity full;
alter table message_attachments replica identity full;
alter table message_reactions replica identity full;
alter table push_subscriptions replica identity full;
