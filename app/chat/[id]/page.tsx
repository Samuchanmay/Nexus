import { notFound } from "next/navigation";
import { createClient, getAuthedUser } from "@/lib/supabase/server";
import type { EnlaceAttachment, EnlaceConversation, EnlaceMessage } from "@/lib/types";
import type { ParticipantLite } from "../client";
import EnlaceConversationClient from "./client";

// Nunca cachear esta ruta: se navega aquí justo después de crear la
// conversación (RPC nx_enlace_get_or_create_direct/create_group), y el
// Router Cache / Data Cache de Next no debe servir una respuesta previa
// (p.ej. un intento anterior fallido) para el mismo id.
export const dynamic = "force-dynamic";

export default async function EnlaceConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    .select("user_id, role, muted")
    .eq("conversation_id", id);

  const mine = (participantRows ?? []).find((p) => p.user_id === myId);
  const myRole = (mine?.role ?? "member") as "admin" | "member";
  const myMuted = mine?.muted ?? false;

  const userIds = (participantRows ?? []).map((p) => p.user_id);
  const { data: people } = userIds.length > 0
    ? await supabase.from("users_directory").select("id, display_name, avatar_url, nexus_color").in("id", userIds)
    : { data: [] as ParticipantLite[] };

  const roleByUser = new Map((participantRows ?? []).map((p) => [p.user_id, p.role as "admin" | "member"]));
  const peopleWithRole = (people ?? []).map((p) => ({ ...p, role: roleByUser.get(p.id) ?? "member" }));

  const { data: messagesDesc } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at")
    .eq("conversation_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const messages = [...(messagesDesc ?? [])].reverse() as EnlaceMessage[];
  const messageIds = messages.map((m) => m.id);

  const [{ data: attachmentsRaw }, { data: pinnedRaw }, { data: recentFilesRaw }] = await Promise.all([
    messageIds.length > 0
      ? supabase.from("message_attachments").select("id, message_id, file_name, file_path, file_size, mime_type, created_at").in("message_id", messageIds)
      : Promise.resolve({ data: [] as EnlaceAttachment[] }),
    conversation.pinned_message_id
      ? supabase.from("messages").select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at").eq("id", conversation.pinned_message_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Archivos recientes de TODA la conversación (no solo los últimos 50 mensajes cargados) — para el panel derecho.
    supabase.from("message_attachments").select("id, message_id, file_name, file_path, file_size, mime_type, created_at, messages!inner(conversation_id)")
      .eq("messages.conversation_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  const attachmentsByMessage: Record<string, EnlaceAttachment> = {};
  for (const a of (attachmentsRaw ?? []) as EnlaceAttachment[]) attachmentsByMessage[a.message_id] = a;

  const recentFiles = ((recentFilesRaw ?? []) as (EnlaceAttachment & { messages?: unknown })[])
    .map(({ messages: _messages, ...a }) => a);

  return (
    <EnlaceConversationClient
      myId={myId}
      myRole={myRole}
      initialMuted={myMuted}
      conversation={conversation as EnlaceConversation}
      participants={peopleWithRole}
      initialMessages={messages}
      attachmentsByMessage={attachmentsByMessage}
      initialPinnedMessage={pinnedRaw as EnlaceMessage | null}
      recentFiles={recentFiles}
    />
  );
}
