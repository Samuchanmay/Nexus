"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, useToast, Menu, MenuItem } from "@/components/ui";
import { IconButton, SkelRow, Skel } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { useOutbox } from "@/lib/chat/use-outbox";
import { useAttachmentUpload } from "@/lib/chat/use-attachment-upload";
import { useAudioRecorder } from "@/lib/chat/use-audio-recorder";
import { useTyping } from "@/lib/chat/use-typing";
import { useSwipeGesture } from "@/lib/chat/use-swipe-gesture";
import { getPresenceInfo } from "@/lib/chat/format-presence";
import { playMessageReceived } from "@/lib/chat/sound";
import { showIncomingChatNotification, messageNotificationBody } from "@/lib/chat/notify";
import { MessageStatusIcon } from "@/components/chat/message-status";
import { STATUS_LABEL, type MessageStatus } from "@/lib/chat/message-state";
import { ReactionStrip, ReactionPicker } from "@/components/chat/reactions";
import { AttachmentSheet } from "@/components/chat/attachment-sheet";
import { ConversationSearch } from "@/components/chat/conversation-search";
import { ForwardSheet } from "@/components/chat/forward-sheet";
import { StickerPicker } from "@/components/chat/sticker-picker";
import { ThreadPanel } from "@/components/chat/thread-panel";
import { CameraCapture } from "@/components/chat/camera-capture";
import { SmartImage } from "@/components/chat/smart-image";
import { TypingDots } from "@/components/chat/typing-indicator";
import type { EnlaceAttachment, EnlaceConversation, EnlaceMessage, EnlaceReaction, ChatPollFull } from "@/lib/types";
import { PollMessage } from "@/components/chat/poll-message";
import { CreatePollSheet } from "@/components/chat/create-poll-sheet";
import { getErrorMessage } from "@/lib/errors";
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

function fmtRec(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fileIcon(mime: string): string {
  if (mime.startsWith("video/")) return "fileVideo";
  if (mime.startsWith("audio/")) return "fileAudio";
  if (mime === "application/pdf") return "fileText";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return "file";
  if (mime.includes("word") || mime.includes("document")) return "fileText";
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("7z")) return "fileArchive";
  return "file";
}

/** Texto resumido de un mensaje para previews (fijado, responder, replies).
    Mismo criterio por tipo que nx_enlace_preview_for en 0022. */
function messagePreview(m?: EnlaceMessage | null): string {
  if (!m) return "";
  if (m.deleted_at) return "Mensaje eliminado";
  if (m.type === "sticker") return m.content ?? "Sticker";
  if (m.type === "location") return "Ubicación";
  if (m.type === "image") return "Foto";
  if (m.type === "file") return m.content ?? "Archivo adjunto";
  if (m.type === "poll") return "📊 Encuesta";
  return m.content ?? "";
}

type PersonLite = ParticipantLite & { role?: "admin" | "member"; muted?: boolean; last_seen_at?: string | null };

/** Recibo de lectura por miembro (tabla message_reads, migración 0037) —
    alimenta el "Leído por …" de las burbujas propias en grupos. */
type MessageRead = { message_id: string; user_id: string; read_at: string };

export default function EnlaceConversationClient({
  myId, myRole, initialMuted, initialMutedUntil, conversation, participants, initialMessages, hasMoreOlder,
  attachmentsByMessage: initialAttachments, reactionsByMessage: initialReactions,
  initialPinnedMessage, recentFiles, creatorName, otherProfile, initialJumpTarget,
  initialPollsByMessage,
}: {
  myId: string;
  myRole: "admin" | "member";
  initialMuted: boolean;
  initialMutedUntil: string | null;
  conversation: EnlaceConversation;
  participants: PersonLite[];
  initialMessages: EnlaceMessage[];
  hasMoreOlder: boolean;
  attachmentsByMessage: Record<string, EnlaceAttachment>;
  reactionsByMessage: Record<string, EnlaceReaction[]>;
  initialPinnedMessage: EnlaceMessage | null;
  recentFiles: EnlaceAttachment[];
  creatorName: string | null;
  otherProfile: { area: string | null; phone: string | null; title: string | null } | null;
  /** Deep-link de la búsqueda cross-conversación (?msg=...): al montar,
      salta y resalta este mensaje aunque esté fuera de la página cargada. */
  initialJumpTarget: string | null;
  /** FASE W7 — encuestas de los mensajes ya cargados, keyed por message_id
      (mismo criterio que attachmentsByMessage/reactionsByMessage). */
  initialPollsByMessage: Record<string, ChatPollFull>;
}) {
  const router = useRouter();
  const { messages, setMessages, send, sendSticker, sendStickerImage, sendLocation, retry } = useOutbox(conversation.id, myId, initialMessages);
  const [attachmentsByMessage, setAttachmentsByMessage] = useState(initialAttachments);
  const [reactionsByMessage, setReactionsByMessage] = useState(initialReactions);
  const [pollsByMessage, setPollsByMessage] = useState<Record<string, ChatPollFull>>(initialPollsByMessage);
  const [pollOpen, setPollOpen] = useState(false);
  // Quién leyó cada mensaje visible — para "Leído por …" en grupos.
  const [readersByMessage, setReadersByMessage] = useState<Record<string, MessageRead[]>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [pinnedMessage, setPinnedMessage] = useState(initialPinnedMessage);
  // Silencio: un booleano (siempre) + una fecha de vencimiento (por duración).
  // Efectivo = muted OR (mutedUntil en el futuro) — mismo criterio que el
  // push y el watcher de no-leídos.
  const [mute, setMute] = useState<{ muted: boolean; mutedUntil: string | null }>({
    muted: initialMuted, mutedUntil: initialMutedUntil,
  });
  const muted = mute.muted || (!!mute.mutedUntil && new Date(mute.mutedUntil).getTime() > Date.now());
  const [infoOpen, setInfoOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<EnlaceMessage | null>(null);
  /** FASE W7 — mensaje raíz del hilo abierto en el panel lateral; null = cerrado. */
  const [threadRoot, setThreadRoot] = useState<EnlaceMessage | null>(null);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(hasMoreOlder);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // ¿El usuario está pegado al último mensaje? Guía el scroll automático y la
  // pill "N mensajes nuevos": si llega algo ajeno y NO está al fondo, se
  // acumula el contador en vez de robarle el scroll (patrón Signal).
  const nearBottomRef = useRef(true);
  const peopleById = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);
  const toast = useToast();

  const [searchOpen, setSearchOpen] = useState(false);
  const [jumpTarget, setJumpTarget] = useState<string | null>(initialJumpTarget);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [forwardMsg, setForwardMsg] = useState<EnlaceMessage | null>(null);
  const [forwardAtt, setForwardAtt] = useState<EnlaceAttachment | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const msgEls = useRef(new Map<string, HTMLDivElement>());
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpAttempts = useRef(0);

  // Reflejos "vivos" para el efecto de realtime: el handler del canal usa
  // estos refs para leer el estado actual sin re-suscribir el canal.
  const messagesRef = useRef(messages); messagesRef.current = messages;
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const peopleRef = useRef(peopleById); peopleRef.current = peopleById;
  // Mensaje que acaba de llegar por realtime — anima su burbuja al entrar.
  const [arrivalKey, setArrivalKey] = useState<string | null>(null);
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Contador de mensajes ajenos que llegaron sin estar al fondo del scroll.
  const [newMsgCount, setNewMsgCount] = useState(0);

  const upload = useAttachmentUpload(conversation.id, myId);
  // handleUpload se define más abajo (const) pero el hook se llama aquí
  // (reglas de hooks) — se enruta por un ref para evitar TDZ y no tener que
  // re-suscribir el MediaRecorder cada render.
  const handleUploadRef = useRef<(file: File) => void>(() => {});
  const { recording, seconds, error: recorderError, start: startRecording, stop: stopRecording, cancel: cancelRecording } =
    useAudioRecorder((file) => handleUploadRef.current(file));
  useEffect(() => {
    if (recorderError) toast(recorderError, "danger");
  }, [recorderError, toast]);
  const { typingText, recordingText, notifyTyping, notifyRecording } = useTyping(conversation.id, myId, peopleById.get(myId)?.display_name ?? "Alguien");
  // El indicador "grabando un audio" es efímero (broadcast) y tiene fin
  // explícito: al iniciar la nota se anuncia `on: true` y al soltar/cancelar
  // `on: false`, para que los demás lo vean aparecer y desaparecer en vivo.
  useEffect(() => {
    notifyRecording(recording);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  const other = conversation.type === "direct" ? participants.find((p) => p.id !== myId) : null;
  const title = conversation.type === "announcement" ? (conversation.name ?? "Anuncios")
    : conversation.type === "group" ? (conversation.name ?? "Grupo")
    : (other?.display_name ?? "Conversación");
  const otherPresence = other ? getPresenceInfo(other.last_seen_at, other.manual_status) : null;
  const presence = otherPresence?.label ?? null;
  const subtitle = conversation.type === "announcement"
    ? (myRole === "admin" ? "Solo tú y otros admins pueden publicar" : "Solo administradores pueden publicar")
    : recordingText
    ?? typingText
    ?? (conversation.type === "group"
      ? `${participants.length} ${participants.length === 1 ? "integrante" : "integrantes"}`
      : presence ?? undefined);
  const puedoFijar = conversation.type === "direct" || myRole === "admin";
  // Anuncios es de solo-lectura para quien no sea admin — mismo `role` de
  // conversation_participants que ya gobierna quién puede fijar mensajes,
  // ahora también gobierna quién puede escribir (espejo de la política RLS
  // messages_insert, FASE W6 cierre).
  const puedoEscribir = conversation.type !== "announcement" || myRole === "admin";

  // Estado "Conectado" — muestra un toast breve al volver online después de
  // estar desconectado (mismo patrón que Signal/WhatsApp).
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const onlineToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onOnline = () => {
      setShowOnlineToast(true);
      if (onlineToastTimer.current) clearTimeout(onlineToastTimer.current);
      onlineToastTimer.current = setTimeout(() => setShowOnlineToast(false), 2000);
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (onlineToastTimer.current) clearTimeout(onlineToastTimer.current);
    };
  }, []);

  useEffect(() => {
    // Deep-link (?msg=): el salto al mensaje ya está en vuelo (jumpTarget),
    // no bajar al fondo — el scroll suave al mensaje sería cancelado por el
    // salto instantáneo al último mensaje.
    if (initialJumpTarget) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Solo sigue al último mensaje si el usuario ya estaba al fondo; si está
    // leyendo más arriba, no le robamos el scroll (la pill recoge el conteo).
    if (nearBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Marca como leída la conversación al entrar — coherente con el "swipe
  // para marcar leído" de la lista, y evita que quede el punto de no
  // leído después de haber abierto y visto los mensajes.
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("nx_enlace_mark_conversation_read", { p_conversation_id: conversation.id });
  }, [conversation.id]);

  // Marca "leído" los mensajes ajenos que ya están en pantalla al abrir —
  // lote vía RPC (reemplaza el bucle por mensaje de antes; la migración
  // 0037 además registra el recibo individual en message_reads, que es lo
  // que permite el "Leído por …" en grupos). En el mismo efecto se cargan
  // los recibos del lote visible para las burbujas propias.
  useEffect(() => {
    const supabase = createClient();
    const unread = messages.filter((m) => m.sender_id !== myId && m.status !== "read" && !m.id.startsWith("local-"));
    const batch = unread.slice(-30).map((m) => m.id);
    if (batch.length > 0) {
      supabase.rpc("nx_enlace_mark_messages_read", { p_message_ids: batch });
    }
    const visible = messages.filter((m) => !m.id.startsWith("local-")).slice(-50).map((m) => m.id);
    if (visible.length > 0) {
      supabase.rpc("nx_enlace_message_reads", { p_message_ids: visible })
        .then(({ data }) => {
          if (!data) return;
          const grouped: Record<string, MessageRead[]> = {};
          for (const r of data as MessageRead[]) (grouped[r.message_id] ??= []).push(r);
          setReadersByMessage(grouped);
        });
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
      .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng, read_at")
      .eq("conversation_id", conversation.id)
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
      supabase.from("message_attachments").select("id, message_id, file_name, file_path, file_size, mime_type, created_at, thumb_path, thumb_size, thumb_mime, medium_path, medium_size, medium_mime").in("message_id", ids),
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
    // Recibos de lectura de la página anterior (para "Leído por …").
    supabase.rpc("nx_enlace_message_reads", { p_message_ids: ids.filter((id) => !id.startsWith("local-")) }).then(({ data }) => {
      if (!data) return;
      setReadersByMessage((cur) => {
        const next = { ...cur };
        for (const r of data as MessageRead[]) (next[r.message_id] ??= []).push(r);
        return next;
      });
    });

    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setMessages((cur) => {
      // No dejar crecer la lista sin límite en una sesión muy larga —
      // recorta las más viejas del lado contrario a donde se está
      // navegando. A la escala real de Emet esto casi nunca se alcanza.
      const combined = [...older, ...cur];
      return combined.length > MAX_MESSAGES_BEFORE_TRIM ? combined.slice(combined.length - MAX_MESSAGES_BEFORE_TRIM) : combined;
    });
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }, [loadingMore, hasMore, messages, conversation.id, setMessages]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = nearBottom;
    if (nearBottom) setNewMsgCount(0);
    if (el.scrollTop < 80) loadMore();
  }, [loadMore]);

  // Firma URLs de descarga bajo demanda — el bucket es privado, así que no
  // hay una URL pública fija; se piden cuando aparece un adjunto nuevo
  // (carga inicial o realtime) y se guardan en memoria por 30 min.
  // Claves: `${attachment.id}:original|thumb|medium` — para imágenes el
  // render usa thumb (preview) y medium (vista); original solo al hacer clic.
  useEffect(() => {
    const needed: { key: string; path: string }[] = [];
    for (const a of Object.values(attachmentsByMessage)) {
      if (!signedUrls[`${a.id}:original`] && a.file_path) needed.push({ key: `${a.id}:original`, path: a.file_path });
      if (!signedUrls[`${a.id}:thumb`] && a.thumb_path) needed.push({ key: `${a.id}:thumb`, path: a.thumb_path });
      if (!signedUrls[`${a.id}:medium`] && a.medium_path) needed.push({ key: `${a.id}:medium`, path: a.medium_path });
    }
    // FASE W7 — stickers Emu con imagen: mismo mecanismo de firma bajo
    // demanda, clave `${message.id}:sticker`.
    for (const m of messages) {
      if (m.type === "sticker" && m.sticker_image_path && !signedUrls[`${m.id}:sticker`]) {
        needed.push({ key: `${m.id}:sticker`, path: m.sticker_image_path });
      }
    }
    if (needed.length === 0) return;
    let active = true;
    const supabase = createClient();
    (async () => {
      const entries = await Promise.all(
        needed.map(async ({ key, path }) => {
          const { data } = await supabase.storage.from("chat-files").createSignedUrl(path, 1800);
          return [key, data?.signedUrl ?? null] as const;
        })
      );
      if (!active) return;
      setSignedUrls((cur) => {
        const next = { ...cur };
        for (const [key, url] of entries) if (url) next[key] = url;
        return next;
      });
    })();
    return () => { active = false; };
  }, [attachmentsByMessage, signedUrls, messages]);

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
          const isNew = !messagesRef.current.some(matches);
          setMessages((cur) => (cur.some(matches) ? cur.map((m) => (matches(m) ? row : m)) : [...cur, row]));
          if (row.sender_id !== myId) {
            supabase.rpc("nx_enlace_mark_delivered", { p_message_id: row.id });
            // Pill "N mensajes nuevos": si llega algo ajeno y no estamos al
            // fondo, se acumula el contador en lugar de robarnos el scroll.
            if (isNew) {
              if (nearBottomRef.current) setNewMsgCount(0);
              else setNewMsgCount((c) => c + 1);
            }
            // Notificaciones en vivo — solo mensajes de otros y solo si la
            // conversación no está silenciada (FASE 1 del design review):
            // pestaña en primer plano → sonido sutil + animación de la
            // burbuja; en segundo plano → notificación del navegador.
            if (isNew && !mutedRef.current) {
              setArrivalKey(row.id);
              if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
              arrivalTimer.current = setTimeout(() => setArrivalKey((k) => (k === row.id ? null : k)), 450);
              // Vibración sutil (20ms) al recibir mensaje — misma duración
              // que el háptico del swipe (spec chat §3: feedback táctil
              // consistente). navigator.vibrate es no-op en iOS Safari y
              // desktop, así que no necesita feature detection.
              if ("vibrate" in navigator) navigator.vibrate(20);
              if (document.visibilityState === "visible") {
                playMessageReceived();
              } else {
                const sender = peopleRef.current.get(row.sender_id);
                showIncomingChatNotification({
                  conversationId: conversation.id,
                  title: conversation.type === "direct"
                    ? (sender?.display_name ?? "Nuevo mensaje")
                    : (conversation.name ?? "Chat"),
                  body: messageNotificationBody(row),
                  icon: sender?.avatar_url ?? null,
                });
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as EnlaceMessage;
          setMessages((cur) => cur.map((m) =>
            m.id === row.id
              ? { ...m, status: row.status, content: row.content, edited: row.edited, deleted_at: row.deleted_at, read_at: row.read_at, reply_count: row.reply_count }
              : m
          ));
          // Si el fijado se editó/eliminó, reflejarlo en el banner superior.
          setPinnedMessage((cur) => (cur?.id === row.id ? { ...cur, content: row.content, deleted_at: row.deleted_at } : cur));
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
        { event: "INSERT", schema: "public", table: "message_reads" },
        (payload) => {
          // Sin columna de conversación en la tabla (igual que reactions):
          // se descarta localmente si el mensaje no es de esta pantalla.
          const row = payload.new as MessageRead;
          if (!messagesRef.current.some((m) => m.id === row.message_id)) return;
          setReadersByMessage((cur) => ({
            ...cur,
            [row.message_id]: [...(cur[row.message_id] ?? []).filter((r) => r.user_id !== row.user_id), row],
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reads" },
        (payload) => {
          const row = payload.old as MessageRead;
          setReadersByMessage((cur) => {
            const list = cur[row.message_id];
            if (!list) return cur;
            const next = list.filter((r) => r.user_id !== row.user_id);
            return next.length === list.length ? cur : { ...cur, [row.message_id]: next };
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
              supabase2.from("messages").select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng")
                .eq("id", row.pinned_message_id).maybeSingle()
                .then(({ data }) => setPinnedMessage(data as EnlaceMessage | null));
            }
            return cur;
          });
        }
      )
      .on(
        // FASE W7 — encuesta creada por OTRO participante: chat_polls sí
        // tiene conversation_id (a diferencia de reactions/reads), así que
        // se puede filtrar en el servidor. Al llegar, se trae la fila con
        // sus opciones en una sola consulta y se agrega al mapa — el
        // creador ya la agregó localmente al crearla (ver createPoll), así
        // que este evento es solo para el resto.
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_polls", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const poll = payload.new as ChatPollFull["poll"];
          setPollsByMessage((cur) => (cur[poll.message_id] ? cur : { ...cur, [poll.message_id]: { poll, options: [], votes: [] } }));
          supabase.from("chat_poll_options").select("id, poll_id, label, position").eq("poll_id", poll.id).order("position")
            .then(({ data }) => {
              setPollsByMessage((cur) => {
                const existing = cur[poll.message_id];
                if (!existing) return cur;
                return { ...cur, [poll.message_id]: { ...existing, options: (data ?? []) as ChatPollFull["options"] } };
              });
            });
        }
      )
      .on(
        // Votos — igual que reactions/reads, la tabla no tiene
        // conversation_id (solo poll_id), así que se filtra en cliente
        // buscando a qué encuesta ya cargada pertenece el voto.
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_poll_votes" },
        (payload) => {
          const row = payload.new as ChatPollFull["votes"][number];
          setPollsByMessage((cur) => {
            const entry = Object.entries(cur).find(([, v]) => v.poll.id === row.poll_id);
            if (!entry) return cur;
            const [msgId, full] = entry;
            if (full.votes.some((v) => v.id === row.id)) return cur;
            return { ...cur, [msgId]: { ...full, votes: [...full.votes, row] } };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_poll_votes" },
        (payload) => {
          const row = payload.old as ChatPollFull["votes"][number];
          setPollsByMessage((cur) => {
            const entry = Object.entries(cur).find(([, v]) => v.poll.id === row.poll_id);
            if (!entry) return cur;
            const [msgId, full] = entry;
            const next = full.votes.filter((v) => v.id !== row.id);
            if (next.length === full.votes.length) return cur;
            return { ...cur, [msgId]: { ...full, votes: next } };
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, myId]);

  // FASE W7 — carga perezosa de encuestas que no llegaron en la carga
  // inicial (mensajes traídos por loadMore, o un mensaje type="poll" que
  // llegó por Realtime antes de que el listener de arriba alcanzara a
  // resolver su fila de chat_polls). Se dispara solo para los ids nuevos
  // que hagan falta, nunca repite trabajo ya hecho.
  useEffect(() => {
    const missing = messages.filter((m) => m.type === "poll" && !pollsByMessage[m.id]).map((m) => m.id);
    if (missing.length === 0) return;
    const supabase = createClient();
    (async () => {
      const { data: polls } = await supabase.from("chat_polls").select("*").in("message_id", missing);
      const rows = (polls ?? []) as ChatPollFull["poll"][];
      if (rows.length === 0) return;
      const pollIds = rows.map((p) => p.id);
      const [{ data: options }, { data: votes }] = await Promise.all([
        supabase.from("chat_poll_options").select("*").in("poll_id", pollIds).order("position"),
        supabase.from("chat_poll_votes").select("*").in("poll_id", pollIds),
      ]);
      const optionsByPoll = new Map<string, ChatPollFull["options"]>();
      for (const o of (options ?? []) as ChatPollFull["options"]) {
        const list = optionsByPoll.get(o.poll_id) ?? [];
        list.push(o);
        optionsByPoll.set(o.poll_id, list);
      }
      const votesByPoll = new Map<string, ChatPollFull["votes"]>();
      for (const v of (votes ?? []) as ChatPollFull["votes"]) {
        const list = votesByPoll.get(v.poll_id) ?? [];
        list.push(v);
        votesByPoll.set(v.poll_id, list);
      }
      setPollsByMessage((cur) => {
        const next = { ...cur };
        for (const poll of rows) {
          next[poll.message_id] = {
            poll,
            options: optionsByPoll.get(poll.id) ?? [],
            votes: votesByPoll.get(poll.id) ?? [],
          };
        }
        return next;
      });
    })();
  }, [messages, pollsByMessage]);

  /** FASE W7 — crea el mensaje type="poll" + su fila chat_polls + sus
      opciones. No pasa por useOutbox: el outbox está diseñado para el
      insert de una sola fila `messages` con reintento optimista, y una
      encuesta necesita 3 inserts encadenados (mensaje → poll → opciones)
      que solo tienen sentido como unidad — si el mensaje se creó pero la
      encuesta falló, mejor mostrar el error y no dejar un mensaje "poll"
      huérfano sin pregunta. Riesgo aceptado (documentado): sin reintento
      automático si se corta la conexión a medio camino; a la escala real
      de Emet (~20 usuarios) es preferible a la complejidad de meter este
      flujo de 3 pasos dentro del contrato de outbox de una sola tabla. */
  const createPoll = useCallback(async (question: string, options: string[], multipleChoice: boolean) => {
    const supabase = createClient();
    const { data: msgRow, error: msgErr } = await supabase
      .from("messages")
      .insert({ conversation_id: conversation.id, sender_id: myId, type: "poll", content: null, client_id: crypto.randomUUID() })
      .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng, read_at, sticker_image_path, reply_count")
      .single();
    if (msgErr || !msgRow) throw new Error(msgErr?.message ?? "No se pudo crear el mensaje de la encuesta");

    const { data: pollRow, error: pollErr } = await supabase
      .from("chat_polls")
      .insert({ message_id: msgRow.id, conversation_id: conversation.id, creator_id: myId, question, multiple_choice: multipleChoice })
      .select("*")
      .single();
    if (pollErr || !pollRow) throw new Error(pollErr?.message ?? "No se pudo crear la encuesta");

    const { data: optionRows, error: optErr } = await supabase
      .from("chat_poll_options")
      .insert(options.map((label, i) => ({ poll_id: pollRow.id, label, position: i })))
      .select("*");
    if (optErr) throw new Error(optErr.message);

    setMessages((cur) => [...cur, msgRow as EnlaceMessage]);
    setPollsByMessage((cur) => ({
      ...cur,
      [msgRow.id]: { poll: pollRow as ChatPollFull["poll"], options: (optionRows ?? []) as ChatPollFull["options"], votes: [] },
    }));
  }, [conversation.id, myId, setMessages]);

  /** FASE W7 — votar/desmarcar una opción. Opción única: votar en una
      opción retira automáticamente cualquier voto previo mío en esa misma
      encuesta (nunca dos opciones marcadas a la vez). Opción múltiple: solo
      alterna la opción tocada. Actualiza el estado local de inmediato
      (optimista) — si Realtime también trae el mismo cambio, el dedupe por
      id en los handlers de arriba lo ignora. */
  const votePoll = useCallback(async (messageId: string, optionId: string) => {
    const full = pollsByMessage[messageId];
    if (!full) return;
    const supabase = createClient();
    const myExisting = full.votes.filter((v) => v.user_id === myId);
    const alreadyOnThis = myExisting.some((v) => v.option_id === optionId);

    if (alreadyOnThis) {
      // Desmarcar esta opción.
      setPollsByMessage((cur) => {
        const f = cur[messageId];
        if (!f) return cur;
        return { ...cur, [messageId]: { ...f, votes: f.votes.filter((v) => !(v.user_id === myId && v.option_id === optionId)) } };
      });
      await supabase.from("chat_poll_votes").delete().eq("poll_id", full.poll.id).eq("option_id", optionId).eq("user_id", myId);
      return;
    }

    // Opción única: primero se retiran mis otros votos en esta encuesta.
    if (!full.poll.multiple_choice && myExisting.length > 0) {
      setPollsByMessage((cur) => {
        const f = cur[messageId];
        if (!f) return cur;
        return { ...cur, [messageId]: { ...f, votes: f.votes.filter((v) => v.user_id !== myId) } };
      });
      await supabase.from("chat_poll_votes").delete().eq("poll_id", full.poll.id).eq("user_id", myId);
    }

    const optimisticId = `local-${crypto.randomUUID()}`;
    setPollsByMessage((cur) => {
      const f = cur[messageId];
      if (!f) return cur;
      return { ...cur, [messageId]: { ...f, votes: [...f.votes, { id: optimisticId, poll_id: full.poll.id, option_id: optionId, user_id: myId, created_at: new Date().toISOString() }] } };
    });
    const { data, error } = await supabase
      .from("chat_poll_votes")
      .insert({ poll_id: full.poll.id, option_id: optionId, user_id: myId })
      .select("*")
      .single();
    if (error) {
      // Reversa del optimista si el insert falló (p. ej. constraint de unicidad ya cubierto arriba, pero cualquier otro error de red).
      setPollsByMessage((cur) => {
        const f = cur[messageId];
        if (!f) return cur;
        return { ...cur, [messageId]: { ...f, votes: f.votes.filter((v) => v.id !== optimisticId) } };
      });
      toast(getErrorMessage(error, "No se pudo registrar el voto"), "danger");
      return;
    }
    setPollsByMessage((cur) => {
      const f = cur[messageId];
      if (!f) return cur;
      return { ...cur, [messageId]: { ...f, votes: f.votes.map((v) => (v.id === optimisticId ? (data as ChatPollFull["votes"][number]) : v)) } };
    });
  }, [pollsByMessage, myId, toast]);

  useEffect(() => () => {
    if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

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
  handleUploadRef.current = handleUpload;

  const sendStickerMsg = useCallback((emoji: string) => {
    sendSticker(emoji, replyTo?.id ?? null);
    setReplyTo(null);
  }, [sendSticker, replyTo]);

  // FASE W7 — sticker Emu (imagen generada por IA o ya reusada de la biblioteca).
  const sendStickerImageMsg = useCallback((imagePath: string) => {
    sendStickerImage(imagePath, replyTo?.id ?? null);
    setReplyTo(null);
  }, [sendStickerImage, replyTo]);

  // Compartir ubicación: Geolocation del dispositivo → mensaje type=location.
  // Se avisa con un toast mientras se busca; la burbuja (mapa) aparece al
  // resolver. Los errores se traducen a mensajes accionables, nunca silencio.
  const shareLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast("Tu dispositivo no tiene GPS.", "danger");
      return;
    }
    setLocating(true);
    toast("Buscando tu ubicación…", "warn");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        sendLocation(pos.coords.latitude, pos.coords.longitude, replyTo?.id ?? null);
        setReplyTo(null);
      },
      (err) => {
        setLocating(false);
        toast(
          err.code === 1
            ? "Permiso de ubicación denegado. Activa el acceso a la ubicación e inténtalo de nuevo."
            : err.code === 2
              ? "No se pudo obtener tu ubicación. Intenta de nuevo."
              : "Tiempo agotado al buscar tu ubicación. Intenta de nuevo.",
          "danger",
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 },
    );
  }, [sendLocation, replyTo, toast]);

  const togglePin = useCallback(async (messageId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("nx_enlace_toggle_pin", { p_conversation_id: conversation.id, p_message_id: messageId });
    if (error) return;
    setPinnedMessage((cur) => (cur?.id === messageId ? null : messages.find((m) => m.id === messageId) ?? cur));
  }, [conversation.id, messages]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const supabase = createClient();
    let prevList: EnlaceReaction[] = [];
    setReactionsByMessage((cur) => {
      prevList = cur[messageId] ?? [];
      const mine = prevList.find((r) => r.user_id === myId && r.emoji === emoji);
      const next = mine
        ? prevList.filter((r) => r !== mine)
        : [...prevList, { id: `local-${crypto.randomUUID()}`, message_id: messageId, user_id: myId, emoji, created_at: new Date().toISOString() }];
      return { ...cur, [messageId]: next };
    });
    setReactionPickerFor(null);
    // Bug previo: no se revisaba el error del RPC — si fallaba, la reacción
    // optimista se quedaba mostrada como si se hubiera guardado. Ahora se
    // revierte al valor previo (capturado antes del update optimista).
    const { error } = await supabase.rpc("nx_enlace_toggle_reaction", { p_message_id: messageId, p_emoji: emoji });
    if (error) {
      setReactionsByMessage((cur) => ({ ...cur, [messageId]: prevList }));
      toast("No se pudo guardar la reacción.", "danger");
    }
  }, [myId, toast]);

  const toggleMuted = async () => {
    const supabase = createClient();
    // "Activar notificaciones" sobre un silencio por duración debe limpiar
    // ambos campos — el toggle histórico solo voltea `muted` y dejaría el
    // vencimiento colgando. Por eso: silenciado → unmute (limpia todo);
    // no silenciado → silencio indefinido (set_mute con vencimiento null).
    const { error } = muted
      ? await supabase.rpc("nx_enlace_unmute", { p_conversation_id: conversation.id })
      : await supabase.rpc("nx_enlace_set_mute", { p_conversation_id: conversation.id, p_until: null });
    if (!error) setMute({ muted: !muted, mutedUntil: null });
  };

  // Silencio por duración (FASE "plataforma de mensajería moderna"): 8h /
  // 1 semana / siempre. Un solo RPC (nx_enlace_set_mute) que recibe el
  // vencimiento; null = para siempre (mismo efecto que el toggle histórico).
  const setMutedFor = async (until: string | null) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("nx_enlace_set_mute", { p_conversation_id: conversation.id, p_until: until });
    if (error) return;
    setMute({ muted: until === null, mutedUntil: until });
  };

  const flashMessage = useCallback((id: string) => {
    setHighlightId(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 2400);
  }, []);

  // Salto desde la búsqueda: si el mensaje ya está cargado, directo al
  // DOM; si no (solo se cargan los últimos 50), se piden más páginas
  // viejas hasta encontrarlo (efecto de abajo) con un tope de intentos.
  const jumpToMessage = useCallback((id: string) => {
    setSearchOpen(false);
    const el = msgEls.current.get(id);
    if (el) {
      // Va por rAF para correr después del ajuste de scrollTop que hace
      // loadMore (que también usa rAF) — así no se cancela el scroll suave.
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        flashMessage(id);
      });
      return;
    }
    jumpAttempts.current = 0;
    setJumpTarget(id);
  }, [flashMessage]);

  useEffect(() => {
    if (!jumpTarget) return;
    if (msgEls.current.has(jumpTarget)) {
      const el = msgEls.current.get(jumpTarget);
      requestAnimationFrame(() => {
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        flashMessage(jumpTarget);
      });
      setJumpTarget(null);
      jumpAttempts.current = 0;
      return;
    }
    // Una carga ya está en vuelo — no avanzar ni desistir todavía; el
    // efecto volverá a correr cuando termine (cambia messages/loadingMore).
    if (loadingMore) return;
    if (hasMore) {
      if (jumpAttempts.current > 14) {
        setJumpTarget(null);
        toast("El mensaje está muy atrás y no se pudo cargar. Prueba en la búsqueda general.", "warn");
        return;
      }
      jumpAttempts.current += 1;
      void loadMore();
      return;
    }
    setJumpTarget(null);
    toast("El mensaje ya no está disponible.", "danger");
  }, [jumpTarget, hasMore, loadingMore, loadMore, flashMessage, toast]);

  const beginEdit = (m: EnlaceMessage) => {
    setEditingId(m.id);
    setEditingDraft(m.content ?? "");
    setMenuFor(null);
    setConfirmDelete(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const content = editingDraft.trim();
    if (!content) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("nx_enlace_edit_message", { p_message_id: editingId, p_content: content });
    const res = (data ?? null) as { ok: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast(res?.error === "no-autor" ? "Solo puedes editar tus propios mensajes." : "No se pudo editar el mensaje.", "danger");
      return;
    }
    setMessages((cur) => cur.map((m) => (m.id === editingId ? { ...m, content, edited: true } : m)));
    setEditingId(null);
    setEditingDraft("");
  };

  const cancelEdit = () => { setEditingId(null); setEditingDraft(""); };

  const onEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveEdit(); }
    if (e.key === "Escape") cancelEdit();
  };

  const deleteMessage = async (id: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("nx_enlace_delete_message", { p_message_id: id });
    const res = (data ?? null) as { ok: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast(res?.error === "no-autor" ? "Solo puedes eliminar tus propios mensajes." : "No se pudo eliminar el mensaje.", "danger");
      setMenuFor(null);
      setConfirmDelete(null);
      return;
    }
    setMessages((cur) => cur.map((m) =>
      m.id === id ? { ...m, deleted_at: new Date().toISOString(), content: null } : m
    ));
    setPinnedMessage((cur) => (cur?.id === id ? null : cur));
    setMenuFor(null);
    setConfirmDelete(null);
  };

  // "Eliminar para mí" (migración 0037): oculta el mensaje SOLO para el
  // usuario actual vía RPC; la política RLS messages_select lo excluye de
  // todos los SELECTs futuros. Quien lo ocultó deja de verlo; los demás lo
  // siguen viendo con normalidad.
  const hideMessage = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("nx_enlace_hide_message", { p_message_id: id });
    if (error) {
      toast("No se pudo ocultar el mensaje.", "danger");
      setMenuFor(null);
      return;
    }
    setMessages((cur) => cur.filter((m) => m.id !== id));
    setReadersByMessage((cur) => {
      if (!cur[id]) return cur;
      const next = { ...cur };
      delete next[id];
      return next;
    });
    setMenuFor(null);
    setConfirmDelete(null);
  };

  const copyMessage = async (m: EnlaceMessage) => {
    const text = m.content ?? (m.type === "sticker" ? "Sticker" : "");
    try {
      await navigator.clipboard.writeText(text);
      toast("Mensaje copiado.", "ok");
    } catch {
      toast("No se pudo copiar el mensaje.", "danger");
    }
    setMenuFor(null);
  };

  const openForward = (m: EnlaceMessage) => {
    setForwardMsg(m);
    setForwardAtt(attachmentsByMessage[m.id] ?? null);
    setMenuFor(null);
    setConfirmDelete(null);
  };

  let lastDay = "";

  return (
    <div className="w-full h-full flex">
      <AttachmentSheet
        open={attachSheetOpen}
        onClose={() => setAttachSheetOpen(false)}
        onPickGallery={handleUpload}
        onPickDocument={handleUpload}
        onPickAudio={() => { setAttachSheetOpen(false); void startRecording(); }}
        onPickCamera={() => { setAttachSheetOpen(false); setCameraOpen(true); }}
        onPickLocation={() => { setAttachSheetOpen(false); shareLocation(); }}
        onPickSticker={() => { setAttachSheetOpen(false); setStickerOpen(true); }}
        onPickPoll={() => { setAttachSheetOpen(false); setPollOpen(true); }}
      />

      <CreatePollSheet
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        onCreate={createPoll}
      />

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => { setCameraOpen(false); void handleUpload(file); }}
      />

      <StickerPicker
        open={stickerOpen}
        onClose={() => setStickerOpen(false)}
        onPick={(emoji) => { setStickerOpen(false); sendStickerMsg(emoji); }}
        onPickImage={(path) => { setStickerOpen(false); sendStickerImageMsg(path); }}
      />

      {/* FASE W7 — panel de hilo; su propio composer reutiliza el mismo
          send() del outbox principal, así la respuesta entra por el camino
          optimista normal y también aparece en la línea de tiempo general. */}
      <ThreadPanel
        open={!!threadRoot}
        onClose={() => setThreadRoot(null)}
        root={threadRoot}
        myId={myId}
        peopleById={peopleById}
        onSend={(content, replyToId) => send(content, replyToId)}
      />

      {/* Columna de conversación — permiso explícito del usuario para romper
          aquí, solo aquí, el molde de página normal de Emet. Vive dentro
          del panel derecho de ChatShell, que reserva la altura fija bajo el
          header del Shell; aquí solo se llena ese panel (h-full) y solo la
          franja de mensajes tiene scroll propio, con encabezado y
          compositor fijos, como en WhatsApp/Signal. */}
      <div className="flex-1 min-w-0 h-full flex flex-col relative" style={{ animation: "nx-panel-in .2s var(--ease)" }}>
        <ConversationSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          conversationId={conversation.id}
          onJumpTo={jumpToMessage}
        />

        <div
          onClick={() => setInfoOpen((v) => !v)}
          className="flex items-center gap-2.5 px-4 h-[52px] shrink-0 cursor-pointer"
          style={{ background: "var(--chat-header-bg)", borderBottom: "0.5px solid var(--border)" }}
        >
          <IconButton icon="chevron" label="Volver" onClick={(e) => { e?.stopPropagation(); router.push("/chat"); }} style={{ transform: "scaleX(-1)" }} className="md:hidden" />
          <div className="relative shrink-0">
            <Avatar name={title} avatarUrl={other?.avatar_url ?? conversation.avatar_url} color={other?.nexus_color ?? "#5856D6"} size={36} />
            {conversation.type === "direct" && otherPresence?.dot && (
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                style={{
                  background: otherPresence.dot === "online" ? "var(--ok)" : otherPresence.dot === "away" ? "var(--warn)" : "var(--danger)",
                  borderColor: "var(--chat-header-bg)",
                }}
                aria-label={presence ?? "En línea"}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold tracking-tight truncate">{title}</p>
            {subtitle && (
              <p className="text-[12.5px] truncate inline-flex items-center" style={{ color: (typingText || recordingText) ? "var(--accent)" : "var(--text-2)" }}>
                {subtitle}
                {recordingText ? (
                  <span className="inline-flex items-center ml-1.5" aria-hidden>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--danger)", animation: "nx-breathe-soft 1s ease-in-out infinite" }} />
                  </span>
                ) : typingText ? (
                  <TypingDots />
                ) : null}
              </p>
            )}
          </div>
          <IconButton
            icon="phone"
            label="Llamar"
            onClick={(e) => { e?.stopPropagation(); toast("Las llamadas llegan pronto"); }}
          />
          <IconButton
            icon="video"
            label="Videollamada"
            onClick={(e) => { e?.stopPropagation(); toast("Las videollamadas llegan pronto"); }}
          />
          <IconButton
            icon="search"
            label="Buscar en la conversación"
            onClick={(e) => { e?.stopPropagation(); setSearchOpen(true); }}
          />
          <IconButton
            icon="info"
            label="Información de la conversación"
            onClick={(e) => { e?.stopPropagation(); setInfoOpen((v) => !v); }}
            className="hidden md:flex"
            style={infoOpen ? { background: "var(--accent-tint)", color: "var(--accent)" } : undefined}
          />
          <Menu
            trigger={({ onClick, open }) => (
              <IconButton
                icon="more"
                label="Más opciones"
                onClick={(e) => { e?.stopPropagation(); onClick(); }}
                style={open ? { background: "var(--accent-tint)", color: "var(--accent)" } : undefined}
              />
            )}
          >
            <MenuItem icon={<Icon name="info" size={15} />} onClick={() => { setInfoOpen(true); }}>
              Información de la conversación
            </MenuItem>
            {muted ? (
              <MenuItem icon={<Icon name="bell" size={15} />} onClick={toggleMuted}>
                Activar notificaciones
              </MenuItem>
            ) : (
              <>
                <MenuItem icon={<Icon name="bellOff" size={15} />} onClick={() => setMutedFor(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString())}>
                  Silenciar por 8 horas
                </MenuItem>
                <MenuItem icon={<Icon name="bellOff" size={15} />} onClick={() => setMutedFor(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())}>
                  Silenciar por 1 semana
                </MenuItem>
                <MenuItem icon={<Icon name="bellOff" size={15} />} onClick={() => setMutedFor(null)}>
                  Silenciar siempre
                </MenuItem>
              </>
            )}
            <MenuItem icon={<Icon name="archive" size={15} />} onClick={() => { router.push("/chat"); }}>
              Cerrar conversación
            </MenuItem>
          </Menu>
        </div>

        {pinnedMessage && (
          <div
            onClick={() => setInfoOpen(true)}
            role="button"
            tabIndex={0}
            className="mb-2 shrink-0 flex items-center gap-2.5 rounded-[12px] px-3.5 py-2.5 text-left cursor-pointer"
            style={{ background: "var(--purple-tint)" }}
          >
            <Icon name="pin" size={14} style={{ color: "var(--purple)", flexShrink: 0 }} />
            <span className="text-[12.5px] font-medium truncate flex-1" style={{ color: "var(--text-1)" }}>
              {messagePreview(pinnedMessage)}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); togglePin(pinnedMessage.id); }}
              className="shrink-0 p-1 rounded-full hover:opacity-70"
              aria-label="Desanclar mensaje"
            >
              <Icon name="close" size={12} style={{ color: "var(--text-3)" }} />
            </button>
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="nx-msg-panel flex-1 min-h-0 overflow-y-auto relative flex flex-col gap-1 px-4 py-4"
        >
          {loadingMore && (
            <div className="space-y-1.5 py-1" aria-label="Cargando mensajes anteriores">
              <SkelRow avatar />
              <SkelRow avatar />
            </div>
          )}
          {messages.length === 0 && (
            <p className="text-center text-[13.5px] py-10" style={{ color: "var(--text-2)" }}>
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
            // "Leído por Ana, Luis +3" — solo en burbujas propias de grupos.
            const readers = mine && conversation.type === "group" ? (readersByMessage[m.id] ?? []) : [];
            const readersLabel = readers.length > 0
              ? readers.slice(0, 2).map((r) => peopleById.get(r.user_id)?.display_name ?? "Alguien").join(", ")
                + (readers.length > 2 ? ` +${readers.length - 2}` : "")
              : null;

            if (m.type === "system") {
              return (
                <div key={m.id} className="flex justify-center py-1.5">
                  <span className="text-[12px] px-2.5 py-1" style={{ color: "var(--text-3)" }}>
                    {m.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                ref={(el) => { if (el) msgEls.current.set(m.id, el); else msgEls.current.delete(m.id); }}
                className="relative"
                onContextMenu={(e) => { if (!m.deleted_at) { e.preventDefault(); setConfirmDelete(null); setMenuFor((v) => (v === m.id ? null : m.id)); } }}
                style={{
                  borderRadius: 10,
                  transition: "box-shadow .35s var(--ease)",
                  boxShadow: highlightId === m.id ? "0 0 0 3px color-mix(in srgb, var(--accent) 50%, transparent)" : undefined,
                  animation: arrivalKey === m.id ? "nx-chat-in .3s var(--ease)" : undefined,
                }}
              >
                {showDaySeparator && (
                  <div className="flex items-center justify-center gap-3 py-3" aria-hidden={false}>
                    <span className="h-px w-10 shrink-0" style={{ background: "var(--border)" }} />
                    <span
                      className="text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: "var(--text-3)" }}
                    >
                      {dayLabel(m.created_at)}
                    </span>
                    <span className="h-px w-10 shrink-0" style={{ background: "var(--border)" }} />
                  </div>
                )}
                {editingId === m.id ? (
                  <EditMessageInline
                    draft={editingDraft}
                    setDraft={setEditingDraft}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onKeyDown={onEditKeyDown}
                    mine={mine}
                    showName={!mine && conversation.type !== "direct" && !prevSameSender}
                    senderName={sender?.display_name}
                    senderColor={sender?.nexus_color}
                  />
                ) : (
                  <MessageBubble
                    message={m}
                    mine={mine}
                    myId={myId}
                    sender={sender}
                    showAvatar={!mine && conversation.type !== "direct" && !prevSameSender}
                    showName={!mine && conversation.type !== "direct" && !prevSameSender}
                    prevSameSender={prevSameSender}
                    attachment={attachment}
                    urls={signedUrls}
                    isPinned={isPinned}
                    puedoFijar={puedoFijar}
                    reactions={reactions}
                    repliedTo={repliedTo}
                    reactionPickerOpen={reactionPickerFor === m.id}
                    menuOpen={menuFor === m.id}
                    isGroup={conversation.type === "group"}
                    readersLabel={readersLabel}
                    onOpenMenu={() => { setConfirmDelete(null); setMenuFor((v) => (v === m.id ? null : m.id)); }}
                    onTogglePin={() => togglePin(m.id)}
                    onReply={() => setReplyTo(m)}
                    onOpenReactionPicker={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)}
                    onPickReaction={(emoji) => toggleReaction(m.id, emoji)}
                    onRetry={() => m.client_id && retry(m.client_id)}
                    pollFull={pollsByMessage[m.id]}
                    onVotePoll={(optionId) => votePoll(m.id, optionId)}
                  />
                )}
                {/* FASE W7 — afiliación siempre visible del hilo, independiente
                    del menú ⋯: si ya hay respuestas, un tap abre el panel. */}
                {!m.deleted_at && !!m.reply_count && m.reply_count > 0 && (
                  <button
                    onClick={() => setThreadRoot(m)}
                    className={`mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-semibold rounded-full px-2 py-0.5 transition-colors hover:brightness-95 ${mine ? "ml-auto mr-1" : "ml-9"}`}
                    style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
                  >
                    <Icon name="reply" size={11} />
                    {m.reply_count} {m.reply_count === 1 ? "respuesta" : "respuestas"}
                  </button>
                )}
                {menuFor === m.id && !m.deleted_at && (
                  <MessageMenu
                    mine={mine}
                    deletable
                    editable={mine && m.type === "text"}
                    isPinned={isPinned}
                    puedoFijar={puedoFijar}
                    confirming={confirmDelete === m.id}
                    sentLabel={timeOnly(m.created_at)}
                    statusLabel={STATUS_LABEL[m.status]}
                    edited={!!m.edited}
                    onReact={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)}
                    onReply={() => setReplyTo(m)}
                    onOpenThread={() => { setThreadRoot(m); setMenuFor(null); }}
                    onCopy={() => copyMessage(m)}
                    onEdit={() => beginEdit(m)}
                    onTogglePin={() => togglePin(m.id)}
                    onForward={() => openForward(m)}
                    onAskDelete={() => setConfirmDelete(m.id)}
                    onCancelDelete={() => setConfirmDelete(null)}
                    onDelete={() => deleteMessage(m.id)}
                    onHide={() => hideMessage(m.id)}
                    onClose={() => { setMenuFor(null); setConfirmDelete(null); }}
                  />
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {newMsgCount > 0 && (
          <button
            onClick={() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }}
            className="absolute left-1/2 -translate-x-1/2 z-[6] h-9 px-4 rounded-full text-[12.5px] font-bold text-white inline-flex items-center gap-1.5 transition-all duration-150 hover:brightness-110 active:scale-[.97]"
            style={{ bottom: 96, background: "var(--accent)", boxShadow: "0 8px 20px rgba(38,99,255,0.35)", animation: "nx-menu-in .2s var(--ease)" }}
          >
            <Icon name="chevronDown" size={13} />
            {newMsgCount} {newMsgCount === 1 ? "mensaje nuevo" : "mensajes nuevos"}
          </button>
        )}

        {showOnlineToast && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-[6] h-8 px-4 rounded-full text-[12px] font-semibold text-white inline-flex items-center gap-1.5 pointer-events-none"
            style={{ bottom: 140, background: "var(--ok)", boxShadow: "0 4px 12px rgba(48,209,88,0.35)", animation: "nx-menu-in .2s var(--ease)" }}
          >
            <Icon name="check" size={12} />
            Conectado
          </div>
        )}

        {upload.error && (
          <div className="mt-2 shrink-0 flex items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: "var(--danger-tint)" }}>
            <Icon name="close" size={13} style={{ color: "var(--danger)" }} />
            <span className="text-[12px] font-medium flex-1" style={{ color: "var(--danger)" }}>{upload.error}</span>
            <button onClick={upload.retry} className="text-[12px] font-semibold shrink-0" style={{ color: "var(--danger)" }}>Reintentar</button>
            <button onClick={upload.reset} aria-label="Descartar archivo"><Icon name="close" size={12} style={{ color: "var(--text-3)" }} /></button>
          </div>
        )}

        {replyTo && (
          <div className="mt-2 shrink-0 rounded-[12px] px-3 py-2" style={{ background: "var(--surface-2)", borderLeft: "3px solid var(--accent)" }}>
            <div className="flex items-start gap-2">
              <Avatar
                name={peopleById.get(replyTo.sender_id)?.display_name ?? "?"}
                avatarUrl={peopleById.get(replyTo.sender_id)?.avatar_url}
                color={peopleById.get(replyTo.sender_id)?.nexus_color}
                size={24}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate" style={{ color: "var(--accent)" }}>
                  {replyTo.sender_id === myId ? "Tú" : (peopleById.get(replyTo.sender_id)?.display_name ?? "Alguien")}
                </p>
                <p className="text-[12px] truncate" style={{ color: "var(--text-2)" }}>
                  {messagePreview(replyTo)}
                </p>
              </div>
              <button onClick={() => setReplyTo(null)} className="shrink-0 p-1 -m-1 rounded-full hover:bg-hover" aria-label="Cancelar respuesta">
                <Icon name="close" size={12} style={{ color: "var(--text-3)" }} />
              </button>
            </div>
          </div>
        )}

        {/* Compositor minimalista — solo "+", campo de texto, enviar. Todo
            lo demás (cámara/galería/documento/ubicación/audio) vive detrás
            del "+" en la hoja inferior, no como botones sueltos. En Anuncios,
            quien no sea admin no tiene compositor — es de solo lectura,
            espejo de la política RLS messages_insert (FASE W6 cierre). */}
        <div className="pt-2 pb-1 shrink-0" style={{ background: "var(--bg)" }}>
          {puedoEscribir ? (
            recording ? (
              <div className="flex items-center gap-1.5 rounded-[20px] border border-border px-1.5 py-1 min-h-[46px] transition-all duration-150 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)]" style={{ background: "var(--chat-composer-bg)", boxShadow: "var(--shadow-1)" }}>
                <IconButton
                  icon="close"
                  label="Cancelar nota de audio"
                  onClick={cancelRecording}
                  className="shrink-0"
                />
                <div className="flex-1 flex items-center gap-2 px-1 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: "var(--danger)", animation: "nx-breathe-soft 1s ease-in-out infinite" }}
                  />
                  <span className="text-[13.5px] font-bold truncate" style={{ color: "var(--text-1)" }}>Nota de audio</span>
                  <span className="text-[12px] font-semibold shrink-0" style={{ color: "var(--text-2)" }}>{fmtRec(seconds)}</span>
                </div>
                <IconButton
                  icon="send"
                  label="Enviar nota de audio"
                  onClick={stopRecording}
                  className="shrink-0 !h-12 !w-12"
                  style={{ background: "var(--accent)", color: "#FFFFFF", boxShadow: "0 8px 20px rgba(38,99,255,0.30)" }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-0.5 rounded-[22px] border border-border px-2 py-1 min-h-[46px] transition-all duration-150 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)]" style={{ background: "var(--chat-composer-bg)", boxShadow: "var(--shadow-1)" }}>
                <IconButton
                  icon="plus"
                  label="Adjuntar"
                  onClick={() => setAttachSheetOpen(true)}
                  disabled={upload.status === "uploading" || locating}
                  className="shrink-0 !h-[34px] !w-[34px]"
                  data-ripple
                  style={{ borderRadius: 999, color: "var(--text-2)" }}
                />
                <textarea
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={upload.status === "uploading" ? `Subiendo archivo… ${upload.progress}%` : "Escribe un mensaje..."}
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-1 py-1.5 text-[14px] focus:outline-none max-h-[120px] placeholder:text-[var(--text-3)]"
                />
                <IconButton
                  icon="smile"
                  label="Emojis y stickers"
                  onClick={() => setStickerOpen((v) => !v)}
                  className="shrink-0 !h-[34px] !w-[34px]"
                  style={{ borderRadius: 999, color: "var(--text-2)", ...(stickerOpen ? { background: "var(--accent-tint)", color: "var(--accent)" } : {}) }}
                />
                <IconButton
                  icon="paperclip"
                  label="Adjuntar archivo"
                  onClick={() => setAttachSheetOpen(true)}
                  disabled={upload.status === "uploading" || locating}
                  className="shrink-0 !h-[34px] !w-[34px]"
                  style={{ borderRadius: 999, color: "var(--text-2)" }}
                />
                {draft.trim() ? (
                  <IconButton
                    icon="send"
                    label="Enviar"
                    onClick={sendMessage}
                    className="shrink-0 !h-[34px] !w-[34px]"
                    data-ripple
                    style={{ borderRadius: 999, background: "var(--accent)", color: "#FFFFFF" }}
                  />
                ) : (
                  <IconButton
                    icon="mic"
                    label="Grabar nota de audio"
                    onClick={() => void startRecording()}
                    disabled={upload.status === "uploading"}
                    className="shrink-0 !h-[34px] !w-[34px]"
                    data-ripple
                    style={{ borderRadius: 999, color: "var(--text-2)" }}
                  />
                )}
              </div>
            )
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-[20px] py-3 text-[12.5px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
              <Icon name="lock" size={13} /> Solo administradores pueden publicar aquí
            </div>
          )}
        </div>
      </div>

      <ForwardSheet
        open={forwardMsg !== null}
        onClose={() => setForwardMsg(null)}
        message={forwardMsg}
        attachment={forwardAtt}
        myId={myId}
        myRole={myRole}
        currentConversationId={conversation.id}
        onToast={toast}
      />

      {infoOpen && (
        <aside className="hidden md:block w-[340px] shrink-0 border-l border-border min-h-0">
          <InfoPanel
            conversation={conversation}
            participants={participants}
            myId={myId}
            muted={muted}
            mutedUntil={mute.mutedUntil}
            onToggleMuted={toggleMuted}
            onSetMutedFor={setMutedFor}
            recentFiles={recentFiles}
            creatorName={creatorName}
            otherProfile={otherProfile}
            onClose={() => setInfoOpen(false)}
          />
        </aside>
      )}
    </div>
  );
}

function MessageBubble({
  message: m, mine, myId, sender, showAvatar, showName, prevSameSender, attachment, urls,
  isPinned, puedoFijar, reactions, repliedTo, reactionPickerOpen, menuOpen, isGroup, readersLabel,
  onOpenMenu, onTogglePin, onReply, onOpenReactionPicker, onPickReaction, onRetry,
  pollFull, onVotePoll,
}: {
  message: EnlaceMessage; mine: boolean; myId: string; sender?: PersonLite; showAvatar: boolean; showName: boolean;
  prevSameSender: boolean; attachment?: EnlaceAttachment; urls: Record<string, string>; isPinned: boolean; puedoFijar: boolean;
  reactions: EnlaceReaction[]; repliedTo?: EnlaceMessage | null; reactionPickerOpen: boolean; menuOpen: boolean;
  isGroup: boolean; readersLabel: string | null;
  onOpenMenu: () => void; onTogglePin: () => void; onReply: () => void; onOpenReactionPicker: () => void;
  onPickReaction: (emoji: string) => void; onRetry: () => void;
  /** FASE W7 — encuesta de este mensaje (solo si m.type === "poll") y el
      callback de voto; ambos vienen del padre, que es quien tiene
      pollsByMessage y hace los inserts/deletes reales. */
  pollFull?: ChatPollFull;
  onVotePoll: (optionId: string) => void;
}) {
  // URLs firmadas por tamaño (ver efecto de firma): `${id}:original|thumb|medium`.
  const originalUrl = attachment ? urls[`${attachment.id}:original`] : undefined;
  const thumbUrl = attachment ? urls[`${attachment.id}:thumb`] : undefined;
  const mediumUrl = attachment ? urls[`${attachment.id}:medium`] : undefined;
  // Deslizar el mensaje hacia la derecha para responder — como Signal, sin
  // depender del menú contextual. El ícono de responder aparece detrás
  // mientras se arrastra y la acción se dispara al soltar pasado el umbral
  // (no se queda "abierto": es una acción, no un panel). Los mensajes
  // eliminados no se deslizan: no tienen nada que responder.
  const { dx, dragging, bind } = useSwipeGesture({
    maxOffset: 56, threshold: 40, stayOpenOnComplete: false, onSwipeRightComplete: onReply,
  });
  const deleted = !!m.deleted_at;

  if (deleted) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"} ${prevSameSender ? "mt-0.5" : "mt-2"}`}>
        <div className="max-w-[72%] rounded-[18px] px-3 py-2" style={{ background: "var(--surface-2)", boxShadow: "var(--shadow-1)" }}>
          <p className="text-[12.5px] italic flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
            <Icon name="slash" size={13} aria-hidden /> Mensaje eliminado
          </p>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[10.5px] opacity-60 select-none">{timeOnly(m.created_at)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"} ${prevSameSender ? "mt-0.5" : "mt-2"} relative`}>
      {dx > 4 && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2"
          style={{ opacity: Math.min(dx / 40, 1), color: "var(--accent)" }}
          aria-hidden
        >
          <Icon name="reply" size={16} />
        </span>
      )}
      <div
        {...bind}
        className={`flex items-end gap-2 max-w-[72%] touch-pan-y ${mine ? "flex-row-reverse" : ""}`}
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
            <button
              onClick={onOpenMenu}
              title="Más opciones"
              className={`shrink-0 p-1 order-2 transition-opacity ${menuOpen ? "!opacity-100" : "opacity-0 group-hover:opacity-50"} hover:!opacity-100`}
              style={{ color: "var(--text-3)" }}
            >
              <Icon name="more" size={15} />
            </button>
            <div className="relative">
              {/* Cola sutil al cambiar de remitente (Signal): triángulo
                  recortado con clip-path del mismo color de la burbuja,
                  pegado a la esquina inferior exterior. Solo en la primera
                  burbuja del grupo, nunca en stickers ni eliminadas. */}
              {!prevSameSender && m.type !== "sticker" && (
                <span
                  aria-hidden
                  className="absolute -bottom-[2px] w-3.5 h-3.5"
                  style={{
                    [mine ? "right" : "left"]: -5,
                    background: mine ? "var(--chat-bubble-sent-bg)" : "var(--chat-bubble-received-bg)",
                    clipPath: mine ? "polygon(0 0, 100% 100%, 0 100%)" : "polygon(100% 0, 100% 100%, 0 100%)",
                  }}
                />
              )}
              <div
                className={m.type === "sticker" ? "rounded-[16px]" : "rounded-[18px] overflow-hidden"}
                style={m.type === "sticker"
                  ? { color: "var(--text-3)" }
                  : mine
                    ? { background: "var(--chat-bubble-sent-bg)", color: "var(--chat-bubble-sent-fg)", boxShadow: "0 1px 2px rgba(0,0,0,0.12), inset 0 0 0 0.5px rgba(255,255,255,0.10)" }
                    : { background: "var(--chat-bubble-received-bg)", color: "var(--text-1)", boxShadow: "0 1px 2px rgba(0,0,0,0.06), inset 0 0 0 0.5px rgba(127,127,127,0.14)" }}
              >
                <div className="px-3.5 pt-2 pb-1.5">
                  {!mine && showName && (
                    <p className="text-[12px] font-semibold mb-0.5" style={{ color: sender?.nexus_color ?? "var(--accent)" }}>
                      {sender?.display_name ?? "Alguien"}
                    </p>
                  )}

                  {repliedTo && (
                    <div className="rounded-[6px] px-2 py-1 mb-1 border-l-2" style={{ borderColor: mine ? "rgba(255,255,255,0.7)" : "var(--accent)", background: mine ? "rgba(255,255,255,0.12)" : "var(--chat-card-inner)" }}>
                      <p className="text-[12px] truncate opacity-80">
                        {messagePreview(repliedTo)}
                      </p>
                    </div>
                  )}

                  {m.type === "image" && (
                    attachment && originalUrl ? (
                      <SmartImage
                        thumb={thumbUrl}
                        medium={mediumUrl}
                        original={originalUrl}
                        alt={attachment.file_name}
                        className="block rounded-[14px] max-w-[280px] mb-1 relative overflow-hidden"
                      />
                    ) : (
                      <div className="w-[240px] h-[170px] rounded-[12px] mb-1 overflow-hidden" style={{ background: "var(--chat-card-inner)" }}>
                        <div className="relative h-full w-full">
                          <Skel className="absolute inset-0 !rounded-none" />
                          <span className="absolute bottom-2.5 left-3 text-[12px]" style={{ color: "var(--text-3)" }}>Cargando imagen…</span>
                        </div>
                      </div>
                    )
                  )}

                  {m.type === "file" && attachment && originalUrl && attachment.mime_type.startsWith("audio/") && (
                    <div className="rounded-[12px] px-3 py-2.5 mb-1 min-w-[240px]" style={{ background: mine ? "rgba(255,255,255,0.12)" : "var(--chat-card-inner)" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="shrink-0" style={{ color: "var(--accent)" }} aria-hidden>
                          <Icon name={fileIcon(attachment.mime_type)} size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold truncate">{attachment.file_name}</p>
                          <p className="text-[10.5px] opacity-70">{fmtBytes(attachment.file_size)}</p>
                        </div>
                      </div>
                      <audio controls preload="metadata" src={originalUrl} className="w-full h-9" />
                    </div>
                  )}

                  {m.type === "file" && attachment && !(attachment.mime_type.startsWith("audio/") && originalUrl) && (
                    <a
                      href={originalUrl ?? undefined}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 mb-1 transition-all duration-150 hover:brightness-[1.08]"
                      style={{ background: mine ? "rgba(255,255,255,0.12)" : "var(--chat-card-inner)" }}
                    >
                      <span className="shrink-0" style={{ color: "var(--accent)" }} aria-hidden>
                        <Icon name={fileIcon(attachment.mime_type)} size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-semibold truncate">{attachment.file_name}</p>
                        <p className="text-[10.5px] opacity-70">{fmtBytes(attachment.file_size)}</p>
                      </div>
                      <Icon name="download" size={15} className="shrink-0 opacity-70" />
                    </a>
                  )}

                  {m.type === "location" && m.lat != null && m.lng != null && (
                    <div className="mb-1 min-w-[230px]">
                      <div className="rounded-[12px] overflow-hidden border border-border mb-1.5" style={{ background: "var(--surface-2)" }}>
                        <iframe
                          title="Mapa de la ubicación compartida"
                          loading="lazy"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${m.lng - 0.004}%2C${m.lat - 0.004}%2C${m.lng + 0.004}%2C${m.lat + 0.004}&layer=mapnik&marker=${m.lat}%2C${m.lng}`}
                          className="w-full h-[150px]"
                        />
                      </div>
                      <p className="text-[12px] font-semibold mb-0.5 flex items-center gap-1" style={{ color: mine ? "#FFFFFF" : "var(--text-1)" }}>
                        <Icon name="pin" size={13} aria-hidden /> Ubicación
                      </p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-[12px] font-semibold"
                        style={{ color: mine ? "rgba(255,255,255,0.9)" : "var(--accent)" }}
                      >
                        Ver en Google Maps
                      </a>
                    </div>
                  )}

                  {m.type === "sticker" && (
                    m.sticker_image_path ? (
                      // FASE W7 — sticker Emu con imagen real (generada por IA).
                      <div className="w-[112px] h-[112px] grid place-items-center px-1 py-0.5">
                        {urls[`${m.id}:sticker`] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={urls[`${m.id}:sticker`]}
                            alt="Sticker de Emu"
                            className="w-full h-full object-contain"
                            style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.18))" }}
                          />
                        ) : (
                          <div className="w-full h-full rounded-[12px] animate-pulse" style={{ background: "var(--surface-2)" }} />
                        )}
                      </div>
                    ) : (
                      <div className="min-w-[84px] min-h-[84px] grid place-items-center px-1 py-0.5">
                        <span
                          className="text-[80px] leading-none select-none"
                          style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.18))" }}
                          aria-label="Sticker"
                          role="img"
                        >
                          {m.content ?? "😀"}
                        </span>
                      </div>
                    )
                  )}

                  {m.type === "text" && (
                    <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">{m.content}</p>
                  )}

                  {m.type === "poll" && (
                    pollFull ? (
                      <PollMessage full={pollFull} myId={myId} mine={mine} onVote={onVotePoll} />
                    ) : (
                      <div className="min-w-[200px] min-h-[70px] rounded-[10px] animate-pulse" style={{ background: mine ? "rgba(255,255,255,0.14)" : "var(--surface-2)" }} />
                    )
                  )}
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {m.edited && (
                      <span className="text-[10px] opacity-60 select-none" title="Mensaje editado">editado</span>
                    )}
                    <span className="text-[10.5px] opacity-60 select-none">{timeOnly(m.created_at)}</span>
                    {mine && isGroup && readersLabel ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10.5px] leading-none select-none"
                        style={{ color: "rgba(255,255,255,0.92)", opacity: 0.8 }}
                        title="Leído por"
                      >
                        <Icon name="check" size={11} aria-hidden />
                        <span className="truncate max-w-[160px]">Leído por {readersLabel}</span>
                      </span>
                    ) : (
                      mine && <MessageStatusIcon status={m.status} readAt={m.read_at} onRetry={onRetry} tone={m.type === "sticker" ? undefined : "accent"} />
                    )}
                  </div>
                </div>
              </div>

              {/* Botón de reacción — Signal no permite reaccionar a tus
                  propios mensajes, así que solo existe en mensajes de otros.
                  Visible siempre a baja opacidad (no solo en hover) para que
                  funcione igual en pantallas táctiles sin long-press. */}
              {!mine && (
                <button
                  onClick={onOpenReactionPicker}
                  className="absolute -bottom-2.5 opacity-50 hover:!opacity-100 transition-all duration-150 rounded-full w-6 h-6 grid place-items-center hover:scale-110 active:scale-95"
                  style={{ [mine ? "left" : "right"]: -6, background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-1)" } as React.CSSProperties}
                  title="Reaccionar"
                >
                  <Icon name="smile" size={14} aria-hidden />
                </button>
              )}

              {reactionPickerOpen && (
                <div className={`absolute z-10 top-full mt-2 ${mine ? "right-0" : "left-0"}`}>
                  <ReactionPicker onPick={onPickReaction} />
                </div>
              )}
            </div>
          </div>
          <div className={mine ? "self-end" : "self-start"}>
            <ReactionStrip reactions={reactions} myId={myId} onToggle={mine ? undefined : onPickReaction} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPanel({
  conversation, participants, myId, muted, mutedUntil, onToggleMuted, onSetMutedFor, recentFiles, creatorName, otherProfile, onClose,
}: {
  conversation: EnlaceConversation;
  participants: PersonLite[];
  myId: string;
  muted: boolean;
  mutedUntil: string | null;
  onToggleMuted: () => void;
  onSetMutedFor: (until: string | null) => void;
  recentFiles: EnlaceAttachment[];
  creatorName: string | null;
  otherProfile: { area: string | null; phone: string | null; title: string | null } | null;
  onClose: () => void;
}) {
  const [showAllFiles, setShowAllFiles] = useState(false);
  const shown = showAllFiles ? recentFiles : recentFiles.slice(0, 3);
  const other = participants.find((p) => p.id !== myId);
  const title = conversation.type === "announcement" ? (conversation.name ?? "Anuncios")
    : conversation.type === "group" ? (conversation.name ?? "Grupo")
    : (other?.display_name ?? "Conversación");
  const avatarUrl = conversation.type === "direct" ? (other?.avatar_url ?? null) : conversation.avatar_url;
  const avatarColor = conversation.type === "announcement" ? "#F59E0B"
    : conversation.type === "group" ? "#5856D6"
    : (other?.nexus_color ?? "#5856D6");

  return (
    <div className="w-full h-full overflow-y-auto flex flex-col pl-5 pr-1 py-4" style={{ background: "var(--chat-list-bg)", animation: "nx-menu-in .18s var(--ease)" }}>
      {/* Cabecera tranquila — avatar, título y conteo sobre el fondo del panel,
          sin gradiente: la identidad la pone el contenido, no un bloque de color. */}
      <div className="relative flex flex-col items-center shrink-0 pt-2 pb-6">
        <IconButton icon="close" label="Cerrar" size={15} onClick={onClose} className="absolute top-0 right-0" />
        <Avatar name={title} avatarUrl={avatarUrl} color={avatarColor} size={64} />
        <p className="mt-3 text-[19px] font-bold tracking-tight truncate max-w-full px-2">{title}</p>
        <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-3)" }}>
          {conversation.type === "announcement" ? `Suscritos (${participants.length})`
            : conversation.type === "group" ? `${participants.length} ${participants.length === 1 ? "integrante" : "integrantes"}`
            : "Conversación directa"}
        </p>
      </div>

      <div>
        <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>
          {conversation.type === "announcement" ? `Suscritos (${participants.length})`
            : conversation.type === "group" ? `Miembros (${participants.length})` : "Conversación directa"}
        </p>
        {/* Lista plana — sin tarjeta contenedora (spec chat §2: secciones
            separadas, nunca tarjetas). */}
        <div className="mb-5 px-1 space-y-3">
          {participants.map((p) => {
            const presenceInfo = getPresenceInfo(p.last_seen_at, p.manual_status);
            return (
              <div key={p.id} className="flex items-center gap-2">
                <div className="relative shrink-0">
                  <Avatar name={p.display_name} avatarUrl={p.avatar_url} color={p.nexus_color} size={30} />
                  {presenceInfo.dot && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                      style={{
                        background: presenceInfo.dot === "online" ? "var(--ok)" : presenceInfo.dot === "away" ? "var(--warn)" : "var(--danger)",
                        borderColor: "var(--chat-list-bg)",
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--text-1)" }}>
                    {p.id === myId ? "Tú" : p.display_name}
                  </p>
                  {presenceInfo.label && p.id !== myId && (
                    <p className="text-[10.5px] truncate" style={{ color: "var(--text-3)" }}>{presenceInfo.label}</p>
                  )}
                </div>
                {p.role === "admin" && (
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>Admin</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-5 px-1">
        <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>Perfil</p>
        <div className="space-y-2.5">
          {conversation.type === "direct" && otherProfile ? (
            <>
              {otherProfile.area && <MetaRow icon="building" label="Área" value={otherProfile.area} />}
              {otherProfile.title && <MetaRow icon="idcard" label="Puesto" value={otherProfile.title} />}
              {otherProfile.phone && <MetaRow icon="device" label="Teléfono" value={otherProfile.phone} />}
              {!otherProfile.area && !otherProfile.title && !otherProfile.phone && (
                <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Sin datos adicionales.</p>
              )}
            </>
          ) : (
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
              {conversation.type === "announcement" ? "Canal oficial de la empresa." : "Conversación de grupo entre colaboradores."}
            </p>
          )}
        </div>
      </div>

      <div className="mb-5 px-1">
        <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>Detalles</p>
        <div className="space-y-2">
          <p className="text-[12.5px]" style={{ color: "var(--text-1)" }}>
            <span className="font-semibold">Tipo: </span>
            {conversation.type === "announcement" ? "Anuncios de la empresa"
              : conversation.type === "group" ? "Grupo" : "Conversación directa"}
          </p>
          {conversation.created_at && (
            <p className="text-[12.5px]" style={{ color: "var(--text-1)" }}>
              <span className="font-semibold">Creada: </span>
              {new Date(conversation.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
          {creatorName && (
            <p className="text-[12.5px]" style={{ color: "var(--text-1)" }}>
              <span className="font-semibold">Creada por: </span>{creatorName}
            </p>
          )}
        </div>
      </div>

      <div className="mb-5 px-1">
        <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>Notificaciones</p>
        <button
          onClick={onToggleMuted}
          className="w-full flex items-center justify-between py-1.5 rounded-[10px] px-1 hover:bg-hover transition-colors"
        >
          <span className="text-[12.5px] font-medium" style={{ color: "var(--text-1)" }}>
            {muted ? (mutedUntil ? `Silenciado hasta ${new Date(mutedUntil).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : "Silenciado para siempre") : "Notificaciones activas"}
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
        {!muted && (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {([
              ["8 horas", new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()],
              ["1 semana", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()],
              ["Siempre", null],
            ] as const).map(([label, until]) => (
              <button
                key={label}
                onClick={() => onSetMutedFor(until)}
                className="h-8 px-3 rounded-full text-[12px] font-semibold transition-all duration-150 hover:bg-hover active:scale-[.97]"
                style={{ background: "var(--surface-2)", color: "var(--text-1)" }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {muted && (
          <button
            onClick={onToggleMuted}
            className="mt-1.5 text-[12px] font-semibold"
            style={{ color: "var(--accent)" }}
          >
            Activar notificaciones
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Archivos recientes</p>
          {recentFiles.length > 3 && (
            <button onClick={() => setShowAllFiles((v) => !v)} className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
              {showAllFiles ? "Ver menos" : "Ver todos"}
            </button>
          )}
        </div>
        {recentFiles.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Sin archivos todavía.</p>
        ) : (
          <div className="space-y-0.5">
            {shown.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 rounded-[10px] px-2 py-2 hover:bg-hover transition-colors">
                <span className="shrink-0" style={{ color: "var(--accent)" }} aria-hidden>
                  <Icon name={fileIcon(f.mime_type)} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-1)" }}>{f.file_name}</p>
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

function MetaRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
      <span className="text-[12px] shrink-0" style={{ color: "var(--text-3)" }}>{label}:</span>
      <span className="text-[12.5px] font-semibold truncate" style={{ color: "var(--text-1)" }}>{value}</span>
    </div>
  );
}

/** Edición inline: reemplaza la burbuja mientras se edita, con su propio
    textarea y guardado vía RPC (solo autor, solo texto). */
function EditMessageInline({
  draft, setDraft, onSave, onCancel, onKeyDown, mine, showName, senderName, senderColor,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  mine: boolean;
  showName: boolean;
  senderName?: string;
  senderColor?: string | null;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${showName ? "mt-2" : "mt-1"}`}>
      <div className="w-full max-w-[78%] rounded-[12px] p-2.5" style={{ background: "var(--surface)", border: "1px solid var(--accent)", boxShadow: "var(--shadow-1)" }}>
        {showName && (
          <p className="text-[12px] font-semibold mb-1" style={{ color: senderColor ?? "var(--accent)" }}>
            {senderName ?? "Alguien"}
          </p>
        )}
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={Math.min(5, Math.max(2, draft.split("\n").length))}
          className="w-full resize-none bg-transparent text-[14px] leading-snug focus:outline-none"
          style={{ color: "var(--text-1)" }}
        />
        <div className="flex items-center justify-end gap-2 pt-1.5">
          <span className="text-[10.5px] mr-auto hidden sm:block" style={{ color: "var(--text-3)" }}>
            Enter para guardar · Esc para cancelar
          </span>
          <button
            onClick={onCancel}
            className="px-3 h-8 rounded-[8px] text-[12px] font-bold"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={!draft.trim()}
            className="px-3 h-8 rounded-[8px] text-[12px] font-bold text-white"
            style={{ background: "var(--accent)", opacity: draft.trim() ? 1 : 0.45 }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Menú flotante del mensaje (⋯ o clic derecho) — estilo WhatsApp/Signal:
    Reaccionar, Responder, Reenviar, Copiar, Fijar/Desfijar, Editar (solo
    propios), ─, "Eliminar para mí" (todos, migración 0037) y "Eliminar
    para todos" (solo propios), y al final una ficha informativa de
    envío/lectura. El panel de confirmación de borrado se muestra en su
    lugar (mismo popover), así el clic que abre "Eliminar" está pegado a
    su confirmación. */
function MessageMenu({
  mine, editable, deletable, isPinned, puedoFijar, confirming, sentLabel, statusLabel, edited,
  onReact, onReply, onOpenThread, onCopy, onEdit, onTogglePin, onForward, onAskDelete, onCancelDelete, onDelete, onHide, onClose,
}: {
  mine: boolean;
  editable: boolean;
  deletable: boolean;
  isPinned: boolean;
  puedoFijar: boolean;
  confirming: boolean;
  sentLabel: string;
  statusLabel: string;
  edited: boolean;
  onReact: () => void;
  onReply: () => void;
  /** FASE W7 — abre el panel de hilo para este mensaje como raíz. */
  onOpenThread: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onTogglePin: () => void;
  onForward: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  onHide: () => void;
  onClose: () => void;
}) {
  const Item = ({ icon, label, danger, onClick }: { icon: string; label: string; danger?: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-[8px] text-[12.5px] font-semibold text-left hover:bg-hover transition-colors"
      style={{ color: danger ? "var(--danger)" : "var(--text-1)" }}
    >
      <Icon name={icon} size={14} style={{ color: danger ? "var(--danger)" : "var(--text-3)", flexShrink: 0 }} /> {label}
    </button>
  );
  return (
    <>
      <div className="fixed inset-0 z-[8]" onClick={onClose} />
      <div
        className={`absolute z-10 top-full mt-1 min-w-[186px] rounded-[14px] p-1 ${mine ? "right-0" : "left-0"}`}
        style={{ background: "var(--panel)", border: "0.5px solid var(--border)", boxShadow: "var(--shadow-2)", animation: "nx-menu-in .16s var(--ease)" }}
      >
        {confirming ? (
          <div className="px-2 py-1.5 space-y-1">
            <p className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>¿Eliminar este mensaje?</p>
            <p className="text-[10.5px]" style={{ color: "var(--text-3)" }}>Se borra para todos, sin posibilidad de deshacer.</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={onDelete}
                className="flex-1 h-8 rounded-[8px] text-[12px] font-bold text-white"
                style={{ background: "var(--danger)" }}
              >
                Eliminar
              </button>
              <button
                onClick={onCancelDelete}
                className="flex-1 h-8 rounded-[8px] text-[12px] font-bold"
                style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            {!mine && (
              <Item icon="smile" label="Reaccionar" onClick={() => { onReact(); onClose(); }} />
            )}
            <Item icon="reply" label="Responder" onClick={() => { onReply(); onClose(); }} />
            <Item icon="message" label="Responder en hilo" onClick={() => { onOpenThread(); onClose(); }} />
            {deletable && <Item icon="send" label="Reenviar" onClick={() => { onForward(); onClose(); }} />}
            <Item icon="copy" label="Copiar" onClick={() => { onCopy(); }} />
            {puedoFijar && (
              <Item icon={isPinned ? "pinOff" : "pin"} label={isPinned ? "Desfijar mensaje" : "Fijar mensaje"} onClick={() => { onTogglePin(); onClose(); }} />
            )}
            {editable && <Item icon="pencil" label="Editar" onClick={() => { onEdit(); onClose(); }} />}
            <div className="h-px my-1 mx-1" style={{ background: "var(--border)" }} />
            <Item icon="slash" label="Eliminar para mí" onClick={() => { onHide(); onClose(); }} />
            {mine && deletable && (
              <>
                <div className="h-px my-1 mx-1" style={{ background: "var(--border)" }} />
                <Item icon="trash" label="Eliminar para todos" danger onClick={onAskDelete} />
              </>
            )}
            <div className="h-px my-1 mx-1" style={{ background: "var(--border)" }} />
            <div className="px-2.5 py-1.5 space-y-0.5">
              <p className="text-[10.5px] font-bold" style={{ color: "var(--text-2)" }}>Enviado {sentLabel}</p>
              <p className="text-[10.5px]" style={{ color: "var(--text-3)" }}>{statusLabel}{edited ? " · editado" : ""}</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
