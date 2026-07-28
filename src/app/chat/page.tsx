import { createClient } from "@/lib/supabase/server";

// Nunca cachear esta ruta: la lista de conversaciones y su visibilidad
// (RLS) dependen 100% de la sesión de quien pide la página.
export const dynamic = "force-dynamic";
import type { EnlaceConversation } from "@/lib/types";
import EnlaceListClient, { type ParticipantLite } from "./client";

export default async function EnlacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("users").select("id").eq("auth_id", user!.id).single();
  const myId = me!.id;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, type, name, avatar_url, created_by, last_message_at, last_message_preview, last_message_sender_id, created_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const convIds = (conversations ?? []).map((c) => c.id);
  let participantsByConv: Record<string, ParticipantLite[]> = {};

  if (convIds.length > 0) {
    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds);

    const userIds = Array.from(new Set((participants ?? []).map((p) => p.user_id)));
    const { data: people } = userIds.length > 0
      ? await supabase.from("users_directory").select("id, display_name, avatar_url, nexus_color").in("id", userIds)
      : { data: [] as { id: string; display_name: string; avatar_url: string | null; nexus_color: string | null }[] };
    const peopleById = new Map((people ?? []).map((p) => [p.id, p]));

    participantsByConv = {};
    for (const p of participants ?? []) {
      const person = peopleById.get(p.user_id);
      if (!person) continue;
      (participantsByConv[p.conversation_id] ??= []).push(person);
    }
  }

  return (
    <EnlaceListClient
      myId={myId}
      initialConversations={(conversations ?? []) as EnlaceConversation[]}
      participantsByConv={participantsByConv}
    />
  );
}
