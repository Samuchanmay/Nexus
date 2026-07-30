"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import { IconButton } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { useOutbox } from "@/lib/chat/use-outbox";
import { useAttachmentUpload } from "@/lib/chat/use-attachment-upload";
import { useTyping } from "@/lib/chat/use-typing";
import { useSwipeGesture } from "@/lib/chat/use-swipe-gesture";
import { formatPresence } from "@/lib/chat/format-presence";
import { MessageStatusIcon } from "@/components/chat/message-status";
import { ReactionStrip, ReactionPicker } from "@/components/chat/reactions";
import { AttachmentSheet } from "@/components/chat/attachment-sheet";
import type { EnlaceAttachment, EnlaceConversation, EnlaceMessage, EnlaceReaction } from "@/lib/types";
import type { ParticipantLite } from "../client";

const MAX_MESSAGES_BEFORE_TRIM = 400; // ver nota en loadMore()

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

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileEmoji(mime: string): string {
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime === "application/pdf") return "📄";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return "📊";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  return "📦";
}

type PersonLite = ParticipantLite & { role?: "admin" | "member"; muted?: boolean; last_seen_at?: string | null };

export default function EnlaceConversationClient({
  myId, myRole, initialMuted, conversation, participants, initialMessages, hasMoreOlder,
  attachmentsByMessage: initialAttachments, reactionsByMessage: initialReactions,
  initialPinnedMessage, recentFiles,
}: {
  myId: string;
  myRole: "admin" | "member";
  initialMuted: boolean;
  conversation: EnlaceConversation;
  participants: PersonLite[];
  initialMessages: EnlaceMessage[];
  hasMoreOlder: boolean;
  attachmentsByMessage: Record<string, EnlaceAttachment>;
  reactionsByMessage: Record<string, EnlaceReaction[]>;
  initialPinnedMessage: EnlaceMessage | null;
  recentFiles: EnlaceAttachment[];
}) {
  const router = useRouter();
  const { messages, setMessages, send, retry } = useOutbox(conversation.id, myId, initialMessages);
  const [attachmentsByMessage, setAttachmentsByMessage] = useState(initialAttachments);
  const [reactionsByMessage, setReactionsByMessage] = useState(initialReactions);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [pinnedMessage, setPinnedMessage] = useState(initialPinnedMessage);
  const [muted, setMuted] = useState(initialMuted);
  const [infoOpen, setInfoOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<EnlaceMessage | null>(null);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(hasMoreOlder);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const peopleById = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);

  const upload = useAttachmentUpload(conversation.id, myId);
  const { typingLabel, notifyTyping } = useTyping(conversation.id, myId, peopleById.get(myId)?.display_name ?? "Alguien");

  const other = conversation.type === "direct" ? participants.find((p) => p.id !== myId) : null;
  const title = conversation.type === "group" ? (conversation.name ?? "Grupo") : (other?.display_name ?? "Conversación");
  const presence = other ? formatPresence(other.last_seen_at) : null;
  const subtitle = typingLabel
    ?? (conversation.type === "group"
      ? `${participants.length} ${participants.length === 1 ? "integrante" : "integrantes"}`
      : presence ?? undefined);
  const puedoFijar = conversation.type === "direct" || myRole === "admin";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Marca como leída la conversación al entrar — coherente con el "swipe
  // para marcar leído" de la lista, y evita que quede el punto de no
  // leído después de haber abierto y visto los mensajes.
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("nx_enlace_mark_conversation_read", { p_conversation_id: conversation.id });
  }, [conversation.id]);

  // Marca "leído" los mensajes ajenos que ya están en pantalla al abrir —
  // simplificación consciente (ver message-state.ts): no hay observer de
  // scroll por mensaje individual, se marca el lote visible al entrar.
  useEffect(() => {
    const supabase = createClient();
    const unread = messages.filter((m) => m.sender_id !== myId && m.status !== "read" && !m.id.startsWith("local-"));
    for (const m of unread.slice(-30)) {
      supabase.rpc("nx_enlace_mark_read", { p_message_id: m.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Carga la página anterior de mensajes cuando el usuario llega arriba
  // del scroll — "últimos 50, scroll infinito hacia arriba", no la
  // conversación completa de una vez.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    const supabase = createClient();
    const { data } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id")
      .eq("conversation_id", conversation.id)
      .is("deleted_at", null)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(51);
    setLoadingMore(false);
    if (!data) return;
    setHasMore(data.length > 50);
    const older = [...data.slice(0, 50)].reverse() as EnlaceMessage[];
    if (older.length === 0) return;

    const ids = older.map((m) => m.id);
    const [{ data: atts }, { data: reacts }] = await Promise.all([
      supabase.from("message_attachments").select("id, message_id, file_name, file_path, file_size, mime_type, created_at").in("message_id", ids),
      supabase.from("message_reactions").select("id, message_id, user_id, emoji, created_at").in("message_id", ids),
    ]);
    setAttachmentsByMessage((cur) => {
      const next = { ...cur };
      for (const a of (atts ?? []) as EnlaceAttachment[]) next[a.message_id] = a;
      return next;
    });
    setReactionsByMessage((cur) => {
      const next = { ...cur };
      for (const r of (reacts ?? []) as EnlaceReaction[]) (next[r.message_id] ??= []).push(r);
      return next;
    });

    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setMessages((cur) => {
      // No dejar crecer la lista sin límite en una sesión muy larga —
      // recorta las más viejas del lado contrario a donde se está
      // navegando. A la escala real de Nexus esto casi nunca se alcanza.
      const combined = [...older, ...cur];
      return combined.length > MAX_MESSAGES_BEFORE_TRIM ? combined.slice(combined.length - MAX_MESSAGES_BEFORE_TRIM) : combined;
    });
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }, [loadingMore, hasMore, messages, conversation.id, setMessages]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el && el.scrollTop < 80) loadMore();
  }, [loadMore]);

  // Firma URLs de descarga bajo demanda — el bucket es privado, así que no
  // hay una URL pública fija; se piden cuando aparece un adjunto nuevo
  // (carga inicial o realtime) y se guardan en memoria por 30 min.
  useEffect(() => {
    const faltantes = Object.values(attachmentsByMessage).filter((a) => !signedUrls[a.id]);
    if (faltantes.length === 0) return;
    let active = true;
    const supabase = createClient();
    (async () => {
      const entries = await Promise.all(
        faltantes.map(async (a) => {
          const { data } = await supabase.storage.from("chat-files").createSignedUrl(a.file_path, 1800);
          return [a.id, data?.signedUrl ?? null] as const;
        })
      );
      if (!active) return;
      setSignedUrls((cur) => {
        const next = { ...cur };
        for (const [id, url] of entries) if (url) next[id] = url;
        return next;
      });
    })();
    return () => { active = false; };
  }, [attachmentsByMessage, signedUrls]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as EnlaceMessage;
          const matches = (m: EnlaceMessage) => m.id === row.id || (!!m.client_id && m.client_id === row.client_id);
          setMessages((cur) => (cur.some(matches) ? cur.map((m) => (matches(m) ? row : m)) : [...cur, row]));
          if (row.sender_id !== myId) supabase.rpc("nx_enlace_mark_delivered", { p_message_id: row.id });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as EnlaceMessage;
          setMessages((cur) => cur.map((m) => (m.id === row.id ? { ...m, status: row.status } : m)));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_attachments" },
        (payload) => {
          const row = payload.new as EnlaceAttachment;
          setAttachmentsByMessage((cur) => (cur[row.message_id] ? cur : { ...cur, [row.message_id]: row }));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => {
          // Sin filtro fino por conversación (la tabla no tiene esa
          // columna directa) — se vuelve a pedir el lote de reacciones de
          // los mensajes visibles, que es una consulta barata y evita
          // tener que mantener un segundo canal por mensaje.
          const ids = messages.map((m) => m.id);
          if (ids.length === 0) return;
          supabase.from("message_reactions").select("id, message_id, user_id, emoji, created_at").in("message_id", ids)
            .then(({ data }) => {
              const grouped: Record<string, EnlaceReaction[]> = {};
              for (const r of (data ?? []) as EnlaceReaction[]) (grouped[r.message_id] ??= []).push(r);
              setReactionsByMessage(grouped);
            });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as EnlaceConversation;
          if (!row.pinned_message_id) { setPinnedMessage(null); return; }
          setMessages((cur) => {
            const found = cur.find((m) => m.id === row.pinned_message_id);
            if (found) setPinnedMessage(found);
            else {
              const supabase2 = createClient();
              supabase2.from("messages").select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id")
                .eq("id", row.pinned_message_id).maybeSingle()
                .then(({ data }) => setPinnedMessage(data as EnlaceMessage | null));
            }
            return cur;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, myId]);

  const sendMessage = () => {
    const content = draft.trim();
    if (!content) return;
    send(content, replyTo?.id ?? null);
    setDraft("");
    setReplyTo(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const onDraftChange = (v: string) => {
    setDraft(v);
    if (v.trim()) notifyTyping();
  };

  const handleUpload = async (file: File) => {
    const result = await upload.upload(file);
    if (!result) return;
    setMessages((cur) => (cur.some((m) => m.id === result.message.id) ? cur : [...cur, result.message]));
    setAttachmentsByMessage((cur) => ({ ...cur, [result.message.id]: result.attachment }));
    upload.reset();
  };

  const togglePin = useCallback(async (messageId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("nx_enlace_toggle_pin", { p_conversation_id: conversation.id, p_message_id: messageId });
    if (error) return;
    setPinnedMessage((cur) => (cur?.id === messageId ? null : messages.find((m) => m.id === messageId) ?? cur));
  }, [conversation.id, messages]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const supabase = createClient();
    setReactionsByMessage((cur) => {
      const list = cur[messageId] ?? [];
      const mine = list.find((r) => r.user_id === myId && r.emoji === emoji);
      const next = mine
        ? list.filter((r) => r !== mine)
        : [...list, { id: `local-${crypto.randomUUID()}`, message_id: messageId, user_id: myId, emoji, created_at: new Date().toISOString() }];
      return { ...cur, [messageId]: next };
    });
    setReactionPickerFor(null);
    await supabase.rpc("nx_enlace_toggle_reaction", { p_message_id: messageId, p_emoji: emoji });
  }, [myId]);

  const toggleMuted = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("nx_enlace_toggle_mute", { p_conversation_id: conversation.id });
    if (!error && typeof data === "boolean") setMuted(data);
  };

  let lastDay = "";

  return (
    <div className="w-full h-full flex">
      <AttachmentSheet
        open={attachSheetOpen}
        onClose={() => setAttachSheetOpen(false)}
        onPickGallery={handleUpload}
        onPickDocument={handleUpload}
      />

      {/* Columna de conversación — permiso explícito del usuario para romper
          aquí, solo aquí, el molde de página normal de Nexus. Vive dentro
          del panel derecho de ChatShell, que reserva la altura fija bajo el
          header del Shell; aquí solo se llena ese panel (h-full) y solo la
          franja de mensajes tiene scroll propio, con encabezado y
          compositor fijos, como en WhatsApp/Signal. */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <div
          onClick={() => setInfoOpen((v) => !v)}
          className="flex items-center gap-3 pb-3 shrink-0 cursor-pointer"
          style={{ background: "var(--bg)" }}
        >
          <IconButton icon="chevron" label="Volver" onClick={(e) => { e?.stopPropagation(); router.push("/chat"); }} style={{ transform: "scaleX(-1)" }} className="md:hidden" />
          <Avatar name={title} avatarUrl={other?.avatar_url ?? conversation.avatar_url} color={other?.nexus_color ?? "#5856D6"} size={38} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold truncate">{title}</p>
            {subtitle && (
              <p className="text-[12px] truncate" style={{ color: typingLabel ? "var(--accent)" : "var(--text-2)" }}>{subtitle}</p>
            )}
          </div>
          <IconButton
            icon="info"
            label="Información de la conversación"
            onClick={(e) => { e?.stopPropagation(); setInfoOpen((v) => !v); }}
            className="hidden md:flex"
            style={infoOpen ? { background: "var(--accent-tint)", color: "var(--accent)" } : undefined}
          />
        </div>

        {pinnedMessage && (
          <div
            onClick={() => setInfoOpen(true)}
            role="button"
            tabIndex={0}
            className="mb-2 shrink-0 flex items-center gap-2 rounded-[10px] px-3 py-2 text-left cursor-pointer"
            style={{ background: "var(--accent-tint)" }}
          >
            <Icon name="pin" size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <span className="text-[12.5px] font-medium truncate flex-1" style={{ color: "var(--text-1)" }}>
              {pinnedMessage.content ?? "Archivo adjunto"}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); togglePin(pinnedMessage.id); }}
              className="shrink-0 p-1 rounded-full hover:opacity-70"
            >
              <Icon name="close" size={12} style={{ color: "var(--text-3)" }} />
            </button>
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 px-3 py-3 rounded-[14px]"
          style={{ background: "var(--wa-chat-bg)" }}
        >
          {loadingMore && (
            <p className="text-center text-[11.5px] py-2" style={{ color: "var(--text-3)" }}>Cargando mensajes anteriores…</p>
          )}
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
            const attachment = attachmentsByMessage[m.id];
            const isPinned = pinnedMessage?.id === m.id;
            const reactions = reactionsByMessage[m.id] ?? [];
            const repliedTo = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;

            if (m.type === "system") {
              return (
                <div key={m.id} className="flex justify-center py-1.5">
                  <span className="text-[11.5px] px-2.5 py-1" style={{ color: "var(--text-3)" }}>
                    {m.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={m.id}>
                {showDaySeparator && (
                  <div className="flex justify-center py-3">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--wa-received-bg)", color: "var(--text-2)" }}>
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={m}
                  mine={mine}
                  myId={myId}
                  sender={sender}
                  showAvatar={!mine && conversation.type === "group" && !prevSameSender}
                  showName={!mine && conversation.type === "group" && !prevSameSender}
                  prevSameSender={prevSameSender}
                  attachment={attachment}
                  signedUrl={attachment ? signedUrls[attachment.id] : undefined}
                  isPinned={isPinned}
                  puedoFijar={puedoFijar}
                  reactions={reactions}
                  repliedTo={repliedTo}
                  reactionPickerOpen={reactionPickerFor === m.id}
                  onTogglePin={() => togglePin(m.id)}
                  onReply={() => setReplyTo(m)}
                  onOpenReactionPicker={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)}
                  onPickReaction={(emoji) => toggleReaction(m.id, emoji)}
                  onRetry={() => m.client_id && retry(m.client_id)}
                />
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {upload.error && (
          <div className="mt-2 shrink-0 flex items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: "var(--danger-tint)" }}>
            <Icon name="close" size={13} style={{ color: "var(--danger)" }} />
            <span className="text-[12px] font-medium flex-1" style={{ color: "var(--danger)" }}>{upload.error}</span>
            <button onClick={upload.retry} className="text-[11.5px] font-semibold shrink-0" style={{ color: "var(--danger)" }}>Reintentar</button>
            <button onClick={upload.reset}><Icon name="close" size={12} style={{ color: "var(--text-3)" }} /></button>
          </div>
        )}

        {replyTo && (
          <div className="mt-2 shrink-0 flex items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: "var(--surface-2)" }}>
            <span className="text-[15px] leading-none" style={{ color: "var(--accent)", flexShrink: 0 }} aria-hidden>↩</span>
            <span className="text-[12px] flex-1 truncate">
              <span className="font-semibold" style={{ color: "var(--accent)" }}>Respondiendo: </span>
              {replyTo.content ?? "Archivo adjunto"}
            </span>
            <button onClick={() => setReplyTo(null)}><Icon name="close" size={12} style={{ color: "var(--text-3)" }} /></button>
          </div>
        )}

        {/* Compositor minimalista — solo "+", campo de texto, enviar. Todo
            lo demás (cámara/galería/documento/ubicación/audio) vive detrás
            del "+" en la hoja inferior, no como botones sueltos. */}
        <div className="pt-2 pb-1 shrink-0" style={{ background: "var(--bg)" }}>
          <div className="flex items-end gap-1.5 rounded-[20px] border border-border p-1.5" style={{ background: "var(--surface)" }}>
            <IconButton
              icon="plus"
              label="Adjuntar"
              onClick={() => setAttachSheetOpen(true)}
              disabled={upload.status === "uploading"}
              className="shrink-0"
            />
            <textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={upload.status === "uploading" ? `Subiendo archivo… ${upload.progress}%` : "Escribe un mensaje..."}
              rows={1}
              className="flex-1 resize-none bg-transparent px-1 py-2 text-[14px] focus:outline-none max-h-[120px]"
            />
            <IconButton
              icon="send"
              label="Enviar"
              onClick={sendMessage}
              className="shrink-0"
              style={{ background: draft.trim() ? "var(--wa-sent-bg)" : undefined, color: draft.trim() ? "var(--wa-sent-fg)" : undefined }}
            />
          </div>
        </div>
      </div>

      {infoOpen && (
        <InfoPanel
          conversation={conversation}
          participants={participants}
          myId={myId}
          muted={muted}
          onToggleMuted={toggleMuted}
          recentFiles={recentFiles}
          onClose={() => setInfoOpen(false)}
        />
      )}
    </div>
  );
}

function MessageBubble({
  message: m, mine, myId, sender, showAvatar, showName, prevSameSender, attachment, signedUrl,
  isPinned, puedoFijar, reactions, repliedTo, reactionPickerOpen,
  onTogglePin, onReply, onOpenReactionPicker, onPickReaction, onRetry,
}: {
  message: EnlaceMessage; mine: boolean; myId: string; sender?: PersonLite; showAvatar: boolean; showName: boolean;
  prevSameSender: boolean; attachment?: EnlaceAttachment; signedUrl?: string; isPinned: boolean; puedoFijar: boolean;
  reactions: EnlaceReaction[]; repliedTo?: EnlaceMessage | null; reactionPickerOpen: boolean;
  onTogglePin: () => void; onReply: () => void; onOpenReactionPicker: () => void;
  onPickReaction: (emoji: string) => void; onRetry: () => void;
}) {
  // Deslizar el mensaje hacia la derecha para responder — como Signal, sin
  // depender del menú contextual. El ícono de responder aparece detrás
  // mientras se arrastra y la acción se dispara al soltar pasado el umbral
  // (no se queda "abierto": es una acción, no un panel).
  const { dx, dragging, bind } = useSwipeGesture({
    maxOffset: 56, threshold: 40, stayOpenOnComplete: false, onSwipeRightComplete: onReply,
  });

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"} ${prevSameSender ? "mt-0.5" : "mt-2"} relative`}>
      {dx > 4 && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 text-[15px]"
          style={{ opacity: Math.min(dx / 40, 1), color: "var(--accent)" }}
          aria-hidden
        >
          ↩
        </span>
      )}
      <div
        {...bind}
        className={`flex items-end gap-1.5 max-w-[78%] touch-pan-y ${mine ? "flex-row-reverse" : ""}`}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform .15s var(--spring)" }}
      >
        {!mine && showAvatar ? (
          <Avatar name={sender?.display_name ?? "?"} avatarUrl={sender?.avatar_url} color={sender?.nexus_color} size={26} />
        ) : (
          !mine && !showAvatar && <div style={{ width: 26 }} />
        )}

        <div className="flex flex-col">
          <div className="flex items-end gap-1.5">
            {puedoFijar && (
              <button
                onClick={onTogglePin}
                title={isPinned ? "Desfijar mensaje" : "Fijar mensaje"}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0 p-1 order-1"
                style={{ color: isPinned ? "var(--accent)" : "var(--text-3)" }}
              >
                <Icon name="pin" size={13} />
              </button>
            )}
            <div className="relative">
              <div
                className="rounded-[9px] shadow-sm overflow-hidden"
                style={mine
                  ? { background: "var(--wa-sent-bg)", color: "var(--wa-sent-fg)", borderTopRightRadius: prevSameSender ? 9 : 2 }
                  : { background: "var(--wa-received-bg)", color: "var(--text-1)", borderTopLeftRadius: prevSameSender ? 9 : 2 }}
              >
                <div className="px-2.5 pt-1.5 pb-1">
                  {!mine && showName && (
                    <p className="text-[12px] font-semibold mb-0.5" style={{ color: sender?.nexus_color ?? "var(--accent)" }}>
                      {sender?.display_name ?? "Alguien"}
                    </p>
                  )}

                  {repliedTo && (
                    <div className="rounded-[6px] px-2 py-1 mb-1 border-l-2" style={{ borderColor: "var(--accent)", background: "rgba(0,0,0,0.05)" }}>
                      <p className="text-[11.5px] truncate opacity-80">{repliedTo.content ?? "Archivo adjunto"}</p>
                    </div>
                  )}

                  {m.type === "image" && (
                    attachment && signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={signedUrl}
                          alt={attachment.file_name}
                          className="rounded-[7px] max-w-[260px] max-h-[320px] object-cover mb-1"
                        />
                      </a>
                    ) : (
                      <div className="w-[220px] h-[160px] rounded-[7px] mb-1 flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
                        <span className="text-[11px]" style={{ color: "var(--text-3)" }}>Cargando imagen…</span>
                      </div>
                    )
                  )}

                  {m.type === "file" && attachment && (
                    <a
                      href={signedUrl ?? undefined}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 mb-1"
                      style={{ background: mine ? "rgba(0,0,0,0.06)" : "var(--surface-2)" }}
                    >
                      <span className="text-[22px] leading-none shrink-0" aria-hidden>{fileEmoji(attachment.mime_type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-semibold truncate">{attachment.file_name}</p>
                        <p className="text-[10.5px] opacity-70">{fmtBytes(attachment.file_size)}</p>
                      </div>
                      <Icon name="download" size={15} className="shrink-0 opacity-70" />
                    </a>
                  )}

                  {m.type === "text" && (
                    <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-[10.5px] opacity-60 select-none">{timeOnly(m.created_at)}</span>
                    {mine && <MessageStatusIcon status={m.status} onRetry={onRetry} />}
                  </div>
                </div>
              </div>

              {/* Botón de reacción — visible siempre a baja opacidad (no
                  solo en hover) para que funcione igual en pantallas
                  táctiles sin necesidad de un long-press separado. */}
              <button
                onClick={onOpenReactionPicker}
                className="absolute -bottom-2 opacity-40 hover:!opacity-100 transition-opacity text-[13px] leading-none rounded-full w-5 h-5 grid place-items-center"
                style={{ [mine ? "left" : "right"]: -6, background: "var(--panel)", border: "1px solid var(--border)" } as React.CSSProperties}
                title="Reaccionar"
              >
                🙂
              </button>

              {reactionPickerOpen && (
                <div className={`absolute z-10 top-full mt-2 ${mine ? "right-0" : "left-0"}`}>
                  <ReactionPicker onPick={onPickReaction} />
                </div>
              )}
            </div>
          </div>
          <div className={mine ? "self-end" : "self-start"}>
            <ReactionStrip reactions={reactions} myId={myId} onToggle={onPickReaction} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPanel({
  conversation, participants, myId, muted, onToggleMuted, recentFiles, onClose,
}: {
  conversation: EnlaceConversation;
  participants: PersonLite[];
  myId: string;
  muted: boolean;
  onToggleMuted: () => void;
  recentFiles: EnlaceAttachment[];
  onClose: () => void;
}) {
  const [showAllFiles, setShowAllFiles] = useState(false);
  const shown = showAllFiles ? recentFiles : recentFiles.slice(0, 3);

  return (
    <div className="hidden md:flex w-[280px] shrink-0 h-full overflow-y-auto flex-col pl-4 ml-2 border-l border-border">
      <div className="flex items-center justify-between pb-3">
        <p className="text-[13px] font-bold" style={{ color: "var(--text-1)" }}>Información</p>
        <IconButton icon="close" label="Cerrar" size={15} onClick={onClose} />
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>
          {conversation.type === "group" ? `Miembros (${participants.length})` : "Conversación directa"}
        </p>
        <div className="space-y-1.5 mb-4">
          {participants.map((p) => {
            const presence = formatPresence(p.last_seen_at);
            return (
              <div key={p.id} className="flex items-center gap-2">
                <Avatar name={p.display_name} avatarUrl={p.avatar_url} color={p.nexus_color} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--text-1)" }}>
                    {p.id === myId ? "Tú" : p.display_name}
                  </p>
                  {presence && p.id !== myId && (
                    <p className="text-[10.5px] truncate" style={{ color: "var(--text-3)" }}>{presence}</p>
                  )}
                </div>
                {p.role === "admin" && (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>Admin</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>Notificaciones</p>
        <button
          onClick={onToggleMuted}
          className="w-full flex items-center justify-between rounded-[10px] px-3 py-2.5"
          style={{ background: "var(--surface-2)" }}
        >
          <span className="text-[12.5px] font-medium" style={{ color: "var(--text-1)" }}>
            {muted ? "Silenciado" : "Notificaciones activas"}
          </span>
          <span
            className="w-9 h-5 rounded-full relative transition-colors"
            style={{ background: muted ? "var(--border-2)" : "var(--accent)" }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: muted ? 2 : 18 }}
            />
          </span>
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Archivos recientes</p>
          {recentFiles.length > 3 && (
            <button onClick={() => setShowAllFiles((v) => !v)} className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
              {showAllFiles ? "Ver menos" : "Ver todos"}
            </button>
          )}
        </div>
        {recentFiles.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Sin archivos todavía.</p>
        ) : (
          <div className="space-y-1.5">
            {shown.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5" style={{ background: "var(--surface-2)" }}>
                <span className="text-[16px] leading-none shrink-0" aria-hidden>{fileEmoji(f.mime_type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-semibold truncate" style={{ color: "var(--text-1)" }}>{f.file_name}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-3)" }}>{fmtBytes(f.file_size)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
