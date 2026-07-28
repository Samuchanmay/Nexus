"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import { IconButton, Button } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import type { EnlaceAttachment, EnlaceConversation, EnlaceMessage } from "@/lib/types";
import type { ParticipantLite } from "../client";

const BUCKET = "chat-files";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

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

type PersonLite = ParticipantLite & { role?: "admin" | "member"; muted?: boolean };

export default function EnlaceConversationClient({
  myId, myRole, initialMuted, conversation, participants, initialMessages,
  attachmentsByMessage: initialAttachments, initialPinnedMessage, recentFiles,
}: {
  myId: string;
  myRole: "admin" | "member";
  initialMuted: boolean;
  conversation: EnlaceConversation;
  participants: ParticipantLite[];
  initialMessages: EnlaceMessage[];
  attachmentsByMessage: Record<string, EnlaceAttachment>;
  initialPinnedMessage: EnlaceMessage | null;
  recentFiles: EnlaceAttachment[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [attachmentsByMessage, setAttachmentsByMessage] = useState(initialAttachments);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [pinnedMessage, setPinnedMessage] = useState(initialPinnedMessage);
  const [muted, setMuted] = useState(initialMuted);
  const [infoOpen, setInfoOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const peopleById = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);

  const other = conversation.type === "direct" ? participants.find((p) => p.id !== myId) : null;
  const title = conversation.type === "group" ? (conversation.name ?? "Grupo") : (other?.display_name ?? "Conversación");
  const subtitle = conversation.type === "group"
    ? `${participants.length} ${participants.length === 1 ? "integrante" : "integrantes"}`
    : undefined;
  const puedoFijar = conversation.type === "direct" || myRole === "admin";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

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
          const { data } = await supabase.storage.from(BUCKET).createSignedUrl(a.file_path, 1800);
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
          setMessages((cur) => (cur.some((m) => m.id === row.id) ? cur : [...cur, row]));
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
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as EnlaceConversation;
          if (!row.pinned_message_id) { setPinnedMessage(null); return; }
          setMessages((cur) => {
            const found = cur.find((m) => m.id === row.pinned_message_id);
            if (found) setPinnedMessage(found);
            else {
              const supabase2 = createClient();
              supabase2.from("messages").select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at")
                .eq("id", row.pinned_message_id).maybeSingle()
                .then(({ data }) => setPinnedMessage(data as EnlaceMessage | null));
            }
            return cur;
          });
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

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`"${file.name}" pesa más de 25 MB — no se puede adjuntar.`);
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${conversation.id}/${crypto.randomUUID()}.${ext}`;
    const mime = file.type || "application/octet-stream";

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime });
    if (upErr) { setUploading(false); setUploadError("No se pudo subir el archivo. Intenta de nuevo."); return; }

    const { data: msgRow, error: msgErr } = await supabase
      .from("messages")
      .insert({ conversation_id: conversation.id, sender_id: myId, type: mime.startsWith("image/") ? "image" : "file", content: file.name })
      .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at")
      .single();
    if (msgErr || !msgRow) { setUploading(false); setUploadError("No se pudo enviar el archivo. Intenta de nuevo."); return; }

    const { data: attRow, error: attErr } = await supabase
      .from("message_attachments")
      .insert({ message_id: msgRow.id, file_name: file.name, file_path: path, file_size: file.size, mime_type: mime })
      .select("id, message_id, file_name, file_path, file_size, mime_type, created_at")
      .single();
    setUploading(false);
    if (attErr) { setUploadError("El archivo se envió pero no se pudo vincular. Intenta de nuevo."); return; }

    const row = msgRow as EnlaceMessage;
    setMessages((cur) => (cur.some((m) => m.id === row.id) ? cur : [...cur, row]));
    setAttachmentsByMessage((cur) => ({ ...cur, [row.id]: attRow as EnlaceAttachment }));
  };

  const togglePin = useCallback(async (messageId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("nx_enlace_toggle_pin", { p_conversation_id: conversation.id, p_message_id: messageId });
    if (error) return;
    setPinnedMessage((cur) => (cur?.id === messageId ? null : messages.find((m) => m.id === messageId) ?? cur));
  }, [conversation.id, messages]);

  const toggleMuted = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("nx_enlace_toggle_mute", { p_conversation_id: conversation.id });
    if (!error && typeof data === "boolean") setMuted(data);
  };

  let lastDay = "";

  return (
    <div className="w-full h-full flex">
      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />

      {/* Columna de conversación — permiso explícito del usuario para romper
          aquí, solo aquí, el molde de página normal de Nexus. Vive dentro
          del panel derecho de ChatShell, que reserva la altura fija bajo el
          header del Shell; aquí solo se llena ese panel (h-full) y solo la
          franja de mensajes tiene scroll propio, con encabezado y
          compositor fijos, como en WhatsApp. */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <div className="flex items-center gap-3 pb-3 shrink-0" style={{ background: "var(--bg)" }}>
          <IconButton icon="chevron" label="Volver" onClick={() => router.push("/chat")} style={{ transform: "scaleX(-1)" }} className="md:hidden" />
          <Avatar name={title} avatarUrl={other?.avatar_url ?? conversation.avatar_url} color={other?.nexus_color ?? "#5856D6"} size={38} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold truncate">{title}</p>
            {subtitle && <p className="text-[12px] truncate" style={{ color: "var(--text-2)" }}>{subtitle}</p>}
          </div>
          <IconButton
            icon="info"
            label="Información de la conversación"
            onClick={() => setInfoOpen((v) => !v)}
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
            const attachment = attachmentsByMessage[m.id];
            const isPinned = pinnedMessage?.id === m.id;
            return (
              <div key={m.id}>
                {showDaySeparator && (
                  <div className="flex justify-center py-3">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--wa-received-bg)", color: "var(--text-2)" }}>
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <div className={`group flex ${mine ? "justify-end" : "justify-start"} ${prevSameSender ? "mt-0.5" : "mt-2"}`}>
                  <div className={`flex items-end gap-1.5 max-w-[78%] ${mine ? "flex-row-reverse" : ""}`}>
                    {!mine && conversation.type === "group" && !prevSameSender ? (
                      <Avatar name={sender?.display_name ?? "?"} avatarUrl={sender?.avatar_url} color={sender?.nexus_color} size={26} />
                    ) : (
                      !mine && conversation.type === "group" && <div style={{ width: 26 }} />
                    )}
                    {puedoFijar && (
                      <button
                        onClick={() => togglePin(m.id)}
                        title={isPinned ? "Desfijar mensaje" : "Fijar mensaje"}
                        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0 p-1"
                        style={{ color: isPinned ? "var(--accent)" : "var(--text-3)" }}
                      >
                        <Icon name="pin" size={13} />
                      </button>
                    )}
                    <div
                      className="rounded-[9px] shadow-sm overflow-hidden"
                      style={mine
                        ? { background: "var(--wa-sent-bg)", color: "var(--wa-sent-fg)", borderTopRightRadius: prevSameSender ? 9 : 2 }
                        : { background: "var(--wa-received-bg)", color: "var(--text-1)", borderTopLeftRadius: prevSameSender ? 9 : 2 }}
                    >
                      <div className="px-2.5 pt-1.5 pb-1">
                        {!mine && conversation.type === "group" && !prevSameSender && (
                          <p className="text-[12px] font-semibold mb-0.5" style={{ color: sender?.nexus_color ?? "var(--accent)" }}>
                            {sender?.display_name ?? "Alguien"}
                          </p>
                        )}

                        {m.type === "image" && (
                          attachment && signedUrls[attachment.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a href={signedUrls[attachment.id]} target="_blank" rel="noopener noreferrer">
                              <img
                                src={signedUrls[attachment.id]}
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
                            href={signedUrls[attachment.id] ?? undefined}
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
                        <p className="text-[10.5px] text-right mt-0.5 opacity-60 select-none">{timeOnly(m.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {uploadError && (
          <div className="mt-2 shrink-0 flex items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: "var(--danger-tint)" }}>
            <Icon name="close" size={13} style={{ color: "var(--danger)" }} />
            <span className="text-[12px] font-medium flex-1" style={{ color: "var(--danger)" }}>{uploadError}</span>
            <button onClick={() => setUploadError(null)}><Icon name="close" size={12} style={{ color: "var(--text-3)" }} /></button>
          </div>
        )}

        <div className="pt-2 pb-1 shrink-0" style={{ background: "var(--bg)" }}>
          <div className="flex items-end gap-1.5 rounded-[20px] border border-border p-1.5" style={{ background: "var(--surface)" }}>
            <IconButton
              icon="paperclip"
              label="Adjuntar archivo"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="shrink-0"
            />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={uploading ? "Subiendo archivo…" : "Escribe un mensaje..."}
              rows={1}
              className="flex-1 resize-none bg-transparent px-1 py-2 text-[14px] focus:outline-none max-h-[120px]"
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

function InfoPanel({
  conversation, participants, myId, muted, onToggleMuted, recentFiles, onClose,
}: {
  conversation: EnlaceConversation;
  participants: ParticipantLite[];
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
          {participants.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <Avatar name={p.display_name} avatarUrl={p.avatar_url} color={p.nexus_color} size={26} />
              <p className="text-[12.5px] font-medium truncate flex-1" style={{ color: "var(--text-1)" }}>
                {p.id === myId ? "Tú" : p.display_name}
              </p>
              {(p as PersonLite).role === "admin" && (
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>Admin</span>
              )}
            </div>
          ))}
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
