import { redirect } from "next/navigation";
import { createClient, getAuthedUser } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/os/app-shell";
import { roleLabel } from "@/lib/nav";
import type { EnlaceConversation } from "@/lib/types";
import ChatShell, { type ParticipantLite } from "./client";

// Nunca cachear: la lista de conversaciones y su visibilidad (RLS)
// dependen de la sesión de quien pide la página, y ahora vive aquí (en el
// layout) en vez de en page.tsx.
export const dynamic = "force-dynamic";

// Chat es solo para el equipo interno de CERT (admin + empleado) — a
// diferencia del primer intento (Enlace), NO es para coordinador/
// departamento/rh: esos roles son contrapartes externas que le piden
// cosas a CERT vía Solicitudes, no compañeros de equipo. Mismo criterio
// de rol que ya usa comunicacion/layout.tsx para "la experiencia de equipo".
//
// La lista de conversaciones vive aquí (no en page.tsx) a propósito: este
// layout es lo único que NO se vuelve a montar al navegar entre /chat y
// /chat/[id], así que la lista de la izquierda queda fija en pantalla —
// como WhatsApp Web — en vez de recargarse cada vez que abres un chat.
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  if (!profile.active) redirect("/");
  if (!["admin", "empleado"].includes(profile.role)) redirect("/");

  const role = profile.role === "admin" ? "admin" : "empleado";
  const myId = profile.id as string;

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
      : { data: [] as ParticipantLite[] };
    const peopleById = new Map((people ?? []).map((p) => [p.id, p]));

    participantsByConv = {};
    for (const p of participants ?? []) {
      const person = peopleById.get(p.user_id);
      if (!person) continue;
      (participantsByConv[p.conversation_id] ??= []).push(person);
    }
  }

  // Mi propia fila de participante por conversación — silenciado/fijado/
  // archivado/último leído son por usuario (ver migración
  // chat_signal_style_foundations), así que se leen aparte de la lista de
  // "quién más está en la conversación" de arriba.
  let myStateByConv: Record<string, { muted: boolean; pinned: boolean; archived: boolean; last_read_at: string }> = {};
  if (convIds.length > 0) {
    const { data: mine } = await supabase
      .from("conversation_participants")
      .select("conversation_id, muted, pinned, archived, last_read_at")
      .eq("user_id", myId)
      .in("conversation_id", convIds);
    for (const row of mine ?? []) {
      myStateByConv[row.conversation_id] = {
        muted: row.muted, pinned: row.pinned, archived: row.archived, last_read_at: row.last_read_at,
      };
    }
  }

  return (
    <ToastProvider>
      <AppShell
        role={role}
        user={{
          id: profile.id,
          name: profile.display_name,
          avatarUrl: profile.avatar_url ?? null,
          birthDate: profile.birth_date ?? null,
          area: profile.area ?? "",
          color: profile.nexus_color ?? "#0066FF",
          roleLabel: roleLabel(role),
        }}
      >
        <ChatShell
          myId={myId}
          initialConversations={(conversations ?? []) as EnlaceConversation[]}
          participantsByConv={participantsByConv}
          myStateByConv={myStateByConv}
        >
          {children}
        </ChatShell>
      </AppShell>
    </ToastProvider>
  );
}
