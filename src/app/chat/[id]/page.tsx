import { notFound } from "next/navigation";
import { createClient, getAuthedUser } from "@/lib/supabase/server";
import type { EnlaceAttachment, EnlaceConversation, EnlaceMessage, EnlaceReaction, ChatPollFull } from "@/lib/types";
import type { ParticipantLite } from "../client";
import EnlaceConversationClient from "./client";

// Nunca cachear esta ruta: se navega aquí justo después de crear la
// conversación (RPC nx_enlace_get_or_create_direct/create_group), y el
// Router Cache / Data Cache de Next no debe servir una respuesta previa
// (p.ej. un intento anterior fallido) para el mismo id.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function EnlaceConversationPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { id } = await params;
  const { msg } = await searchParams;
  const supabase = await createClient();
  const user = await getAuthedUser();
  const { data: me } = await supabase.from("users").select("id").eq("auth_id", user!.id).single();
  const myId = me!.id;

  // RLS (conversations_select) ya exige ser participante — si no lo soy,
  // o la conversación no existe, esto simplemente no devuelve fila.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, type, name, avatar_url, created_by, last_message_at, last_message_preview, last_message_sender_id, created_at, pinned_message_id, pinned_by, pinned_at")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) notFound();

  const { data: participantRows } = await supabase
    .from("conversation_participants")
    .select("user_id, role, muted, muted_until")
    .eq("conversation_id", id);

  const mine = (participantRows ?? []).find((p) => p.user_id === myId);
  const myRole = (mine?.role ?? "member") as "admin" | "member";
  const myMuted = mine?.muted ?? false;
  const myMutedUntil = (mine?.muted_until as string | null) ?? null;

  const userIds = (participantRows ?? []).map((p) => p.user_id);
  const otherUserId = conversation.type === "direct"
    ? (participantRows ?? []).find((p) => p.user_id !== myId)?.user_id ?? null
    : null;
  const [{ data: people }, { data: heartbeats }, { data: otherProfileRaw }, { data: creatorRaw }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("users_directory").select("id, display_name, avatar_url, nexus_color, presence_status").in("id", userIds)
      : Promise.resolve({ data: [] as (ParticipantLite & { presence_status?: string | null })[] }),
    // Presencia — reusa user_heartbeats, que ya alimenta la presencia del
    // dashboard admin; no es infraestructura nueva, solo un consumidor más.
    // manual_status (FASE W7.1, legado) vive en user_heartbeats; el estado
    // global "de verdad" vive en users_directory.presence_status y manda
    // sobre el heartbeat (ver mapeo abajo).
    userIds.length > 0
      ? supabase.from("user_heartbeats").select("user_id, last_seen_at, manual_status").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; last_seen_at: string; manual_status: string | null }[] }),
    // Perfil del interlocutor en directas — para el panel contextual rico
    // (InfoPanel): área, puesto y teléfono del otro lado.
    otherUserId
      ? supabase.from("users_directory").select("area, phone, title").eq("id", otherUserId).maybeSingle()
      : Promise.resolve({ data: null }),
    conversation.created_by
      ? supabase.from("users_directory").select("display_name").eq("id", conversation.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: presenceSetting } = await supabase
    .from("app_settings").select("value").eq("key", "chat_presence_visible").maybeSingle();
  const presenceVisible = (presenceSetting?.value ?? "true") === "true";

  const roleByUser = new Map((participantRows ?? []).map((p) => [p.user_id, p.role as "admin" | "member"]));
  const lastSeenByUser = new Map((heartbeats ?? []).map((h) => [h.user_id, h.last_seen_at]));
  const manualStatusByUser = new Map((heartbeats ?? []).map((h) => [h.user_id, h.manual_status]));
  const peopleWithRole = (people ?? []).map((p) => {
    // presence_status (global, users_directory) manda; heartbeat.manual_status
    // (legado, FASE W7.1) es el respaldo — mismo criterio que layout.tsx.
    const { presence_status, ...rest } = p;
    return {
      ...rest,
      role: roleByUser.get(p.id) ?? "member",
      last_seen_at: presenceVisible ? (lastSeenByUser.get(p.id) ?? null) : null,
      manual_status: presenceVisible ? (presence_status ?? manualStatusByUser.get(p.id) ?? null) : null,
    };
  });

  // Últimos PAGE_SIZE mensajes — el resto se trae bajo demanda al hacer
  // scroll hasta arriba (ver loadMore en client.tsx). Se pide PAGE_SIZE+1
  // para saber si hay más sin una segunda consulta de conteo. No se filtra
  // deleted_at: un mensaje borrado debe seguir viéndose como "Mensaje
  // eliminado" para todos (borrado suave, no desaparición).
  const { data: messagesDesc } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng, read_at, sticker_image_path, reply_count")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  const hasMore = (messagesDesc ?? []).length > PAGE_SIZE;
  const messages = [...(messagesDesc ?? []).slice(0, PAGE_SIZE)].reverse() as EnlaceMessage[];
  const messageIds = messages.map((m) => m.id);

  const [{ data: attachmentsRaw }, { data: pinnedRaw }, { data: recentFilesRaw }, { data: reactionsRaw }] = await Promise.all([
    messageIds.length > 0
      ? supabase.from("message_attachments").select("id, message_id, file_name, file_path, file_size, mime_type, created_at, thumb_path, thumb_size, thumb_mime, medium_path, medium_size, medium_mime").in("message_id", messageIds)
      : Promise.resolve({ data: [] as EnlaceAttachment[] }),
    conversation.pinned_message_id
      ? supabase.from("messages").select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng, read_at, sticker_image_path, reply_count").eq("id", conversation.pinned_message_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Archivos recientes de TODA la conversación (no solo la página cargada) — para el panel derecho.
    supabase.from("message_attachments").select("id, message_id, file_name, file_path, file_size, mime_type, created_at, thumb_path, thumb_size, thumb_mime, medium_path, medium_size, medium_mime, messages!inner(conversation_id)")
      .eq("messages.conversation_id", id).order("created_at", { ascending: false }).limit(20),
    messageIds.length > 0
      ? supabase.from("message_reactions").select("id, message_id, user_id, emoji, created_at").in("message_id", messageIds)
      : Promise.resolve({ data: [] as EnlaceReaction[] }),
  ]);

  const attachmentsByMessage: Record<string, EnlaceAttachment> = {};
  for (const a of (attachmentsRaw ?? []) as EnlaceAttachment[]) attachmentsByMessage[a.message_id] = a;

  const reactionsByMessage: Record<string, EnlaceReaction[]> = {};
  for (const r of (reactionsRaw ?? []) as EnlaceReaction[]) (reactionsByMessage[r.message_id] ??= []).push(r);

  // FASE W7 — encuestas de los mensajes ya cargados en esta página (mismo
  // criterio que attachments/reactions: un mapa aparte keyed por
  // message_id, armado con 3 consultas en lote en vez de una por mensaje).
  const pollMessageIds = messages.filter((m) => m.type === "poll").map((m) => m.id);
  const { data: pollsRaw } = pollMessageIds.length > 0
    ? await supabase.from("chat_polls").select("*").in("message_id", pollMessageIds)
    : { data: [] as ChatPollFull["poll"][] };
  const pollRows = (pollsRaw ?? []) as ChatPollFull["poll"][];
  const pollIds = pollRows.map((p) => p.id);
  const [{ data: pollOptionsRaw }, { data: pollVotesRaw }] = await Promise.all([
    pollIds.length > 0
      ? supabase.from("chat_poll_options").select("*").in("poll_id", pollIds).order("position")
      : Promise.resolve({ data: [] as ChatPollFull["options"] }),
    pollIds.length > 0
      ? supabase.from("chat_poll_votes").select("*").in("poll_id", pollIds)
      : Promise.resolve({ data: [] as ChatPollFull["votes"] }),
  ]);
  const pollsByMessage: Record<string, ChatPollFull> = {};
  for (const poll of pollRows) {
    pollsByMessage[poll.message_id] = {
      poll,
      options: ((pollOptionsRaw ?? []) as ChatPollFull["options"]).filter((o) => o.poll_id === poll.id),
      votes: ((pollVotesRaw ?? []) as ChatPollFull["votes"]).filter((v) => v.poll_id === poll.id),
    };
  }

  const otherProfile = (otherProfileRaw ?? null) as { area: string | null; phone: string | null; title: string | null } | null;
  const creatorName = (creatorRaw?.display_name ?? null) as string | null;

  const recentFiles = ((recentFilesRaw ?? []) as (EnlaceAttachment & { messages?: unknown })[])
    .map(({ messages: _messages, ...a }) => a);

  return (
    <EnlaceConversationClient
      myId={myId}
      myRole={myRole}
      initialMuted={myMuted}
      initialMutedUntil={myMutedUntil}
      conversation={conversation as EnlaceConversation}
      participants={peopleWithRole}
      initialMessages={messages}
      hasMoreOlder={hasMore}
      attachmentsByMessage={attachmentsByMessage}
      reactionsByMessage={reactionsByMessage}
      initialPinnedMessage={pinnedRaw as EnlaceMessage | null}
      recentFiles={recentFiles}
      creatorName={creatorName}
      otherProfile={otherProfile}
      initialJumpTarget={msg ?? null}
      initialPollsByMessage={pollsByMessage}
    />
  );
}
