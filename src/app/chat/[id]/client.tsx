"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import { IconButton } from "@/components/os/ui";
import type { EnlaceConversation, EnlaceMessage } from "@/lib/types";
import type { ParticipantLite } from "../client";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Hoy";
  if (sameDay(d, yesterday)) return "Ayer";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long" });
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

export default function EnlaceConversationClient({
  myId, conversation, participants, initialMessages,
}: {
  myId: string;
  conversation: EnlaceConversation;
  participants: ParticipantLite[];
  initialMessages: EnlaceMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const peopleById = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);

  const other = conversation.type === "direct" ? participants.find((p) => p.id !== myId) : null;
  const title = conversation.type === "group" ? (conversation.name ?? "Grupo") : (other?.display_name ?? "Conversación");
  const subtitle = conversation.type === "group"
    ? `${participants.length} ${participants.length === 1 ? "integrante" : "integrantes"}`
    : undefined;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as EnlaceMessage;
          setMessages((cur) => (cur.some((m) => m.id === row.id) ? cur : [...cur, row]));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversation.id, sender_id: myId, type: "text", content })
      .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at")
      .single();
    setSending(false);
    if (error) {
      setDraft(content);
      return;
    }
    const row = data as EnlaceMessage;
    setMessages((cur) => (cur.some((m) => m.id === row.id) ? cur : [...cur, row]));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  let lastDay = "";

  // Estructura propia de Chat (permiso explícito del usuario para romper
  // aquí — solo aquí — el molde de página normal de Nexus): esta vista ya
  // vive dentro del panel derecho de ChatShell (chat/client.tsx), que es
  // quien reserva la altura fija bajo el header del Shell — aquí solo se
  // llena ese panel (h-full) y solo la franja de mensajes tiene scroll
  // propio (min-h-0 + overflow-y-auto), con encabezado y compositor fijos
  // en su sitio, como en WhatsApp. La flecha de volver solo aparece en
  // celular: en escritorio la lista ya está siempre visible al lado.
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-3 pb-3 shrink-0" style={{ background: "var(--bg)" }}>
        <IconButton icon="chevron" label="Volver" onClick={() => router.push("/chat")} style={{ transform: "scaleX(-1)" }} className="md:hidden" />
        <Avatar name={title} avatarUrl={other?.avatar_url ?? conversation.avatar_url} color={other?.nexus_color ?? "#5856D6"} size={38} />
        <div className="min-w-0">
          <p className="text-[15px] font-bold truncate">{title}</p>
          {subtitle && <p className="text-[12px] truncate" style={{ color: "var(--text-2)" }}>{subtitle}</p>}
        </div>
      </div>

      {/* Fondo propio tipo WhatsApp (--wa-chat-bg) — deliberadamente distinto
          del --bg del resto de Nexus, para que el área de mensajes se sienta
          como "el chat" y no como una lista más de la app. Única franja con
          scroll propio (min-h-0 + overflow-y-auto) para que header y
          compositor queden fijos como en WhatsApp, sin que la página entera
          se desplace. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 px-3 py-3 rounded-[14px]" style={{ background: "var(--wa-chat-bg)" }}>
        {messages.length === 0 && (
          <p className="text-center text-[13px] py-10" style={{ color: "var(--text-2)" }}>
            Todavía no hay mensajes. Escribe el primero.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === myId;
          const sender = peopleById.get(m.sender_id);
          const showDaySeparator = dayLabel(m.created_at) !== lastDay;
          if (showDaySeparator) lastDay = dayLabel(m.created_at);
          const prevSameSender = i > 0 && messages[i - 1].sender_id === m.sender_id && !showDaySeparator;
          return (
            <div key={m.id}>
              {showDaySeparator && (
                <div className="flex justify-center py-3">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--wa-received-bg)", color: "var(--text-2)" }}>
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"} ${prevSameSender ? "mt-0.5" : "mt-2"}`}>
                <div className={`flex items-end gap-2 max-w-[78%] ${mine ? "flex-row-reverse" : ""}`}>
                  {!mine && conversation.type === "group" && !prevSameSender ? (
                    <Avatar name={sender?.display_name ?? "?"} avatarUrl={sender?.avatar_url} color={sender?.nexus_color} size={26} />
                  ) : (
                    !mine && conversation.type === "group" && <div style={{ width: 26 }} />
                  )}
                  <div
                    className="px-2.5 pt-1.5 pb-1 rounded-[9px] shadow-sm"
                    style={mine
                      ? { background: "var(--wa-sent-bg)", color: "var(--wa-sent-fg)", borderTopRightRadius: prevSameSender ? 9 : 2 }
                      : { background: "var(--wa-received-bg)", color: "var(--text-1)", borderTopLeftRadius: prevSameSender ? 9 : 2 }}
                  >
                    {!mine && conversation.type === "group" && !prevSameSender && (
                      <p className="text-[12px] font-semibold mb-0.5" style={{ color: sender?.nexus_color ?? "var(--accent)" }}>
                        {sender?.display_name ?? "Alguien"}
                      </p>
                    )}
                    <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">{m.content}</p>
                    <p className="text-[10.5px] text-right mt-0.5 opacity-60 select-none">{timeOnly(m.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="pt-2 pb-1 shrink-0" style={{ background: "var(--bg)" }}>
        <div className="flex items-end gap-2 rounded-[20px] border border-border p-1.5" style={{ background: "var(--surface)" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-[14px] focus:outline-none max-h-[120px]"
          />
          <IconButton
            icon="send"
            label="Enviar"
            onClick={send}
            className="shrink-0"
            style={{ background: draft.trim() ? "var(--wa-sent-bg)" : undefined, color: draft.trim() ? "var(--wa-sent-fg)" : undefined }}
          />
        </div>
      </div>
    </div>
  );
}
