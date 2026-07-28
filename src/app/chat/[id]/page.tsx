import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EnlaceConversation, EnlaceMessage } from "@/lib/types";
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
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("users").select("id").eq("auth_id", user!.id).single();
  const myId = me!.id;

  // RLS (conversations_select) ya exige ser participante — si no lo soy,
  // o la conversación no existe, esto simplemente no devuelve fila.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, type, name, avatar_url, created_by, last_message_at, last_message_preview, last_message_sender_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) notFound();

  const { data: participantRows } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", id);

  const userIds = (participantRows ?? []).map((p) => p.user_id);
  const { data: people } = userIds.length > 0
    ? await supabase.from("users_directory").select("id, display_name, avatar_url, nexus_color").in("id", userIds)
    : { data: [] as ParticipantLite[] };

  const { data: messagesDesc } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at")
    .eq("conversation_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const messages = [...(messagesDesc ?? [])].reverse() as EnlaceMessage[];

  return (
    <EnlaceConversationClient
      myId={myId}
      conversation={conversation as EnlaceConversation}
      participants={(people ?? []) as ParticipantLite[]}
      initialMessages={messages}
    />
  );
}
