"use client";
/**
 * Hoja de Reenviar mensaje (FASE 3) — Signal-style: eliges la conversación
 * destino de la lista (excluye la actual) y el mensaje se inserta ahí.
 *
 * · Texto → insert directo (RLS ya exige ser participante del destino).
 * · Imagen/archivo → copia del objeto en Storage (chat-files) a la ruta
 *   del destino y luego inserta mensaje + adjunto. Si la copia falla, se
 *   aborta con aviso — nunca se inserta un mensaje huérfano sin archivo.
 * · Notas de audio se reenvían igual que cualquier archivo (el destino
 *   renderiza el reproductor por mime_type).
 * · Stickers y ubicación → insert directo con su tipo (content/emoji o
 *   lat/lng), sin Storage.
 * · El canal de Anuncios solo aparece como destino si quien reenvía es
 *   admin (espejo de la política messages_insert de 0020).
 * · Al insertar se dispara triggerChatPush (FASE 2) best-effort.
 */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Sheet } from "@/components/ui";
import { Input, SkelList } from "@/components/os/ui";
import { triggerChatPush } from "@/lib/chat/push";
import type { EnlaceAttachment, EnlaceConversation, EnlaceMessage } from "@/lib/types";

type ParticipantLite = { id: string; display_name: string; avatar_url: string | null; nexus_color: string | null };

function display(c: EnlaceConversation, myId: string, participants: ParticipantLite[]) {
  if (c.type === "announcement") return { name: c.name ?? "Anuncios", avatarUrl: c.avatar_url, color: "#F59E0B" };
  if (c.type === "group") return { name: c.name ?? "Grupo", avatarUrl: c.avatar_url, color: "#5856D6" };
  const other = participants.find((p) => p.id !== myId);
  return { name: other?.display_name ?? "Conversación", avatarUrl: other?.avatar_url ?? null, color: other?.nexus_color ?? "#0066FF" };
}

export function ForwardSheet({
  open, onClose, message, attachment, myId, myRole, currentConversationId, onToast,
}: {
  open: boolean;
  onClose: () => void;
  message: EnlaceMessage | null;
  attachment: EnlaceAttachment | null;
  myId: string;
  myRole: "admin" | "member";
  currentConversationId: string;
  onToast: (msg: string, tone?: "ok" | "danger" | "warn") => void;
}) {
  const [conversations, setConversations] = useState<EnlaceConversation[]>([]);
  const [participants, setParticipants] = useState<Record<string, ParticipantLite[]>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    let active = true;
    const supabase = createClient();
    setLoading(true);
    (async () => {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, type, name, avatar_url, created_by, last_message_at, last_message_preview, last_message_sender_id, created_at, pinned_message_id, pinned_by, pinned_at")
        .neq("id", currentConversationId)
        .order("last_message_at", { ascending: false });
      if (!active) return;
      const ids = (convs ?? []).map((c) => c.id);
      const { data: rows } = ids.length
        ? await supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", ids)
        : { data: [] as { conversation_id: string; user_id: string }[] };
      const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
      // El lookup de nombres es por user_id (nunca por id de conversación —
      // si no, los directos saldrían como "Conversación").
      const { data: people } = userIds.length
        ? await supabase.from("users_directory").select("id, display_name, avatar_url, nexus_color").in("id", userIds)
        : { data: [] as ParticipantLite[] };
      if (!active) return;
      const peopleById = new Map((people ?? []).map((p) => [p.id, p]));
      const byConv: Record<string, ParticipantLite[]> = {};
      for (const r of rows ?? []) {
        const person = peopleById.get(r.user_id);
        if (person) (byConv[r.conversation_id] ??= []).push(person);
      }
      setConversations((convs ?? []) as EnlaceConversation[]);
      setParticipants(byConv);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [open, currentConversationId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const visible = conversations.filter((c) =>
      c.type !== "announcement" || myRole === "admin"
    );
    if (!q) return visible;
    return visible.filter((c) => {
      const { name } = display(c, myId, participants[c.id] ?? []);
      return name.toLowerCase().includes(q);
    });
  }, [conversations, participants, search, myId, myRole]);

  const forward = async (targetId: string) => {
    if (busy || !message) return;
    setBusy(true);
    const supabase = createClient();
    try {
      let type = message.type;
      let content = message.content;
      let newPath = "";

      if ((message.type === "image" || message.type === "file") && attachment) {
        const ext = attachment.file_path.includes(".")
          ? attachment.file_path.split(".").pop()
          : "bin";
        newPath = `${targetId}/${crypto.randomUUID()}.${ext}`;
        const { error: copyErr } = await supabase.storage.from("chat-files").copy(attachment.file_path, newPath);
        if (copyErr) {
          onToast("No se pudo copiar el archivo. Intenta de nuevo.", "danger");
          return;
        }
        type = attachment.mime_type.startsWith("image/") ? "image" : "file";
        content = attachment.file_name;
      }

      const { data: msgRow, error: msgErr } = await supabase
        .from("messages")
        .insert({
          conversation_id: targetId,
          sender_id: myId,
          type,
          content,
          client_id: crypto.randomUUID(),
          lat: message.type === "location" ? (message.lat ?? null) : null,
          lng: message.type === "location" ? (message.lng ?? null) : null,
        })
        .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng")
        .single();
      if (msgErr || !msgRow) {
        onToast(
          msgErr?.code === "42501" || msgErr?.message?.includes("row-level security")
            ? "No puedes reenviar a esa conversación."
            : "No se pudo reenviar el mensaje.",
          "danger",
        );
        return;
      }

      if (attachment && (type === "image" || type === "file")) {
        await supabase.from("message_attachments").insert({
          message_id: msgRow.id,
          file_name: attachment.file_name,
          file_path: newPath,
          file_size: attachment.file_size,
          mime_type: attachment.mime_type,
        });
      }

      void triggerChatPush(msgRow.id);
      onToast("Mensaje reenviado", "ok");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Reenviar mensaje">
      <Input
        icon="search"
        placeholder="Buscar conversación…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3"
      />
      <div className="max-h-[46vh] overflow-y-auto nx-scroll -mx-1">
        {loading ? (
          <SkelList rows={4} avatar />
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-center py-8" style={{ color: "var(--text-3)" }}>
            {conversations.length === 0 ? "No tienes otras conversaciones." : `Nada coincide con “${search}”`}
          </p>
        ) : (
          filtered.map((c) => {
            const { name, avatarUrl, color } = display(c, myId, participants[c.id] ?? []);
            return (
              <button
                key={c.id}
                onClick={() => forward(c.id)}
                disabled={busy}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-m hover:bg-hover transition-colors text-left"
              >
                <Avatar name={name} avatarUrl={avatarUrl} color={color} size={40} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-semibold truncate">{name}</span>
                  {c.last_message_preview && (
                    <span className="block text-[11.5px] truncate" style={{ color: "var(--text-3)" }}>{c.last_message_preview}</span>
                  )}
                </span>
                {c.type === "announcement" && (
                  <span className="shrink-0 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>Anuncios</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </Sheet>
  );
}
