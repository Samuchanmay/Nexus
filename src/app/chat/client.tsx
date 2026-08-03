"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PersonRow, EmptyState } from "@/components/shared";
import { useToast, Sheet, CheckBox } from "@/components/ui";
import { Button, Input } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { ConversationRowWithTyping } from "@/components/chat/conversation-row";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from "@/components/chat/context-menu";
import { chatNotificationsSupported, requestChatNotificationPermission } from "@/lib/chat/notify";
import { nudgePushRegistration } from "@/lib/use-push-notifications";
import type { EnlaceConversation } from "@/lib/types";

export type ParticipantLite = { id: string; display_name: string; avatar_url: string | null; nexus_color: string | null; last_seen_at?: string | null };
export type MyConvState = { muted: boolean; pinned: boolean; archived: boolean; last_read_at: string };

type MessageHit = { id: string; conversation_id: string; content: string | null; sender_name: string };

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function conversationDisplay(c: EnlaceConversation, myId: string, participants: ParticipantLite[]) {
  if (c.type === "announcement") {
    return { name: c.name ?? "Anuncios", avatarUrl: c.avatar_url, color: "#F59E0B" };
  }
  if (c.type === "group") {
    return { name: c.name ?? "Grupo", avatarUrl: c.avatar_url, color: "#5856D6" };
  }
  const other = participants.find((p) => p.id !== myId);
  return { name: other?.display_name ?? "Conversación", avatarUrl: other?.avatar_url ?? null, color: other?.nexus_color ?? "#0066FF" };
}

const DEFAULT_STATE: MyConvState = { muted: false, pinned: false, archived: false, last_read_at: new Date(0).toISOString() };

// Banner "activa notificaciones de escritorio" — se muestra una sola vez si
// el permiso sigue en "default" y el usuario no lo ha descartado.
const NOTIF_BANNER_KEY = "emet:chat-notif-banner-dismissed";

// ChatShell — panel de lista (izquierda) + conversación abierta (derecha),
// visibles al mismo tiempo en escritorio (como WhatsApp Web). En celular
// solo se ve un panel a la vez: la lista en /chat, la conversación en
// /chat/[id] — igual que hoy, sin romper esa navegación.
//
// Vive en el layout (no en page.tsx) para que NO se vuelva a montar ni
// recargar al abrir/cerrar una conversación: la lista, su suscripción de
// tiempo real y el estado de scroll quedan intactos.
export default function ChatShell({
  myId, initialConversations, participantsByConv, myStateByConv, children,
}: {
  myId: string;
  initialConversations: EnlaceConversation[];
  participantsByConv: Record<string, ParticipantLite[]>;
  myStateByConv: Record<string, MyConvState>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [conversations, setConversations] = useState(initialConversations);
  const [participants, setParticipants] = useState(participantsByConv);
  const [myState, setMyState] = useState(myStateByConv);
  const [newOpen, setNewOpen] = useState<"direct" | "group" | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [searching, setSearching] = useState(false);
  const [online, setOnline] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "pinned">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [messageHits, setMessageHits] = useState<MessageHit[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  // No-leídos por conversación: conteo exacto (no solo un punto), actualizado
  // por realtime al llegar mensajes o al marcarse leído en cualquier lugar.
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const stateRef = useRef(myState); stateRef.current = myState;
  const convRef = useRef(conversations); convRef.current = conversations;
  const refreshSeq = useRef(0);
  const unreadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const atRoot = pathname === "/chat";
  const selectedId = !atRoot ? pathname.split("/")[2] : undefined;

  const stateFor = useCallback((id: string) => myState[id] ?? DEFAULT_STATE, [myState]);

  // Realtime: RLS ya limita qué conversaciones puede ver este usuario, así
  // que no hace falta un filtro adicional aquí — cualquier INSERT/UPDATE
  // que le llegue es, por definición, suyo (mismo criterio que notifications.tsx).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`enlace-list-${myId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, (payload) => {
        const row = payload.new as EnlaceConversation;
        setConversations((cur) => {
          const exists = cur.some((c) => c.id === row.id);
          const next = exists ? cur.map((c) => (c.id === row.id ? row : c)) : [row, ...cur];
          return [...next];
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, (payload) => {
        const row = payload.new as EnlaceConversation;
        setConversations((cur) => (cur.some((c) => c.id === row.id) ? cur : [row, ...cur]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId]);

  // Conversaciones nuevas (llegadas por realtime) todavía no tienen sus
  // participantes en memoria — se resuelven bajo demanda.
  useEffect(() => {
    const missing = conversations.filter((c) => !participants[c.id]).map((c) => c.id);
    if (missing.length === 0) return;
    let active = true;
    const supabase = createClient();
    (async () => {
      const { data: rows } = await supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", missing);
      const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
      if (userIds.length === 0) return;
      const { data: people } = await supabase.from("users_directory").select("id, display_name, avatar_url, nexus_color").in("id", userIds);
      if (!active) return;
      const peopleById = new Map((people ?? []).map((p) => [p.id, p]));
      setParticipants((cur) => {
        const next = { ...cur };
        for (const r of rows ?? []) {
          const person = peopleById.get(r.user_id);
          if (!person) continue;
          next[r.conversation_id] = [...(next[r.conversation_id] ?? []), person];
        }
        return next;
      });
    })();
    return () => { active = false; };
  }, [conversations, participants]);

  // Conteo de no-leídos por conversación — consultas head-only (solo el
  // conteo, sin filas) sobre messages, comparando created_at contra mi
  // last_read_at. Se dispara al montar, al llegar un mensaje nuevo o al
  // cambiar mi last_read_at en cualquier parte de la app.
  const refreshUnread = useCallback(() => {
    const seq = ++refreshSeq.current;
    const supabase = createClient();
    const ids = convRef.current.map((c) => c.id);
    if (ids.length === 0) { setUnreadCounts({}); return; }
    Promise.all(ids.map(async (id) => {
      const readAt = stateRef.current[id]?.last_read_at;
      if (!readAt) return [id, 0] as const;
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", id)
        .neq("sender_id", myId)
        .gt("created_at", readAt);
      return [id, count ?? 0] as const;
    })).then((entries) => {
      if (seq === refreshSeq.current) setUnreadCounts(Object.fromEntries(entries));
    });
  }, [myId]);

  const scheduleUnread = useCallback(() => {
    if (unreadTimer.current) clearTimeout(unreadTimer.current);
    unreadTimer.current = setTimeout(refreshUnread, 300);
  }, [refreshUnread]);

  useEffect(() => { scheduleUnread(); }, [scheduleUnread]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`enlace-unread-${myId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => scheduleUnread())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `user_id=eq.${myId}` }, () => scheduleUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId, scheduleUnread]);

  // Banner de activación de notificaciones de escritorio — solo si el
  // permiso sigue sin decidir y el usuario no lo descartó antes.
  useEffect(() => {
    if (!chatNotificationsSupported()) return;
    if (Notification.permission !== "default") return;
    try { if (localStorage.getItem(NOTIF_BANNER_KEY)) return; } catch { return; }
    setShowNotifBanner(true);
  }, []);

  // ⌘K / Ctrl+K enfoca el buscador de conversaciones (el Shell cede el
  // atajo en /chat para no abrir el Spotlight — ver shell.tsx).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Estado de conexión — el indicador "reconectando" es un estado visible
  // de la lista (spec chat §2), aparte del envío de mensajes.
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Búsqueda unificada — personas/grupos por nombre (en memoria, ya
  // cargados) + mensajes (consulta a Supabase, con un pequeño debounce).
  // Todo desde la misma caja, como pedía la referencia de Signal.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setMessageHits([]); setSearching(false); return; }
    setSearching(true);
    let active = true;
    const t = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("messages")
          .select("id, conversation_id, content, sender_id")
          .ilike("content", `%${q}%`)
          .eq("type", "text")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(8);
        if (!active) return;
        const senderIds = Array.from(new Set((data ?? []).map((m) => m.sender_id)));
        const { data: senders } = senderIds.length
          ? await supabase.from("users_directory").select("id, display_name").in("id", senderIds)
          : { data: [] as { id: string; display_name: string }[] };
        if (!active) return;
        const nameById = new Map((senders ?? []).map((s) => [s.id, s.display_name]));
        setMessageHits((data ?? []).map((m) => ({
          id: m.id, conversation_id: m.conversation_id, content: m.content,
          sender_name: nameById.get(m.sender_id) ?? "Alguien",
        })));
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [search]);

  const filteredConversations = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = conversations.filter((c) => !stateFor(c.id).archived);
    const matched = !q ? base : base.filter((c) => {
      const { name } = conversationDisplay(c, myId, participants[c.id] ?? []);
      const namesMatch = name.toLowerCase().includes(q);
      const memberMatch = (participants[c.id] ?? []).some((p) => p.display_name.toLowerCase().includes(q));
      return namesMatch || memberMatch;
    });
    // Fijadas primero, luego por actividad reciente — el punto de fijar es
    // exactamente que no se pierdan en el orden cronológico normal.
    let list = matched;
    if (filter === "unread") {
      list = list.filter((c) =>
        !!c.last_message_at &&
        c.last_message_sender_id !== myId &&
        new Date(c.last_message_at) > new Date(stateFor(c.id).last_read_at)
      );
    } else if (filter === "pinned") {
      list = list.filter((c) => stateFor(c.id).pinned);
    }
    return [...list].sort((a, b) => {
      const pa = stateFor(a.id).pinned, pb = stateFor(b.id).pinned;
      if (pa !== pb) return pa ? -1 : 1;
      return (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "");
    });
  }, [conversations, participants, myId, search, stateFor, filter]);

  const archivedConversations = useMemo(
    () => conversations.filter((c) => stateFor(c.id).archived),
    [conversations, stateFor]
  );

  const patchState = (id: string, patch: Partial<MyConvState>) => {
    setMyState((cur) => ({ ...cur, [id]: { ...(cur[id] ?? DEFAULT_STATE), ...patch } }));
  };

  const toggleMute = async (id: string) => {
    const supabase = createClient();
    patchState(id, { muted: !stateFor(id).muted });
    const { error } = await supabase.rpc("nx_enlace_toggle_mute", { p_conversation_id: id });
    if (error) { patchState(id, { muted: stateFor(id).muted }); toast(error.message, "danger"); }
  };
  const togglePin = async (id: string) => {
    const supabase = createClient();
    patchState(id, { pinned: !stateFor(id).pinned });
    const { error } = await supabase.rpc("nx_enlace_toggle_conversation_pin", { p_conversation_id: id });
    if (error) { patchState(id, { pinned: stateFor(id).pinned }); toast(error.message, "danger"); }
  };
  const toggleArchive = async (id: string) => {
    const supabase = createClient();
    patchState(id, { archived: !stateFor(id).archived });
    const { error } = await supabase.rpc("nx_enlace_toggle_conversation_archived", { p_conversation_id: id });
    if (error) { patchState(id, { archived: stateFor(id).archived }); toast(error.message, "danger"); }
  };
  const markRead = async (id: string) => {
    const supabase = createClient();
    patchState(id, { last_read_at: new Date().toISOString() });
    setUnreadCounts((cur) => ({ ...cur, [id]: 0 }));
    await supabase.rpc("nx_enlace_mark_conversation_read", { p_conversation_id: id });
  };

  const enableNotifs = async () => {
    const perm = await requestChatNotificationPermission();
    if (perm === "granted") {
      toast("Notificaciones de chat activadas", "ok");
      // FASE 2: con el permiso concedido, registra la suscripción Web Push
      // (el watcher del AppShell la intenta al montar si ya había permiso;
      // aquí la despierta si el permiso se acaba de conceder en este clic).
      nudgePushRegistration();
    } else {
      toast("No se pudo activar — permite el permiso en la barra del navegador", "danger");
    }
    setShowNotifBanner(false);
    try { localStorage.setItem(NOTIF_BANNER_KEY, "1"); } catch { /* almacenamiento no disponible */ }
  };
  const dismissNotifBanner = () => {
    setShowNotifBanner(false);
    try { localStorage.setItem(NOTIF_BANNER_KEY, "1"); } catch { /* almacenamiento no disponible */ }
  };

  const isUnread = (c: EnlaceConversation) =>
    !!c.last_message_at &&
    c.last_message_sender_id !== myId &&
    new Date(c.last_message_at) > new Date(stateFor(c.id).last_read_at);

  const renderRow = (c: EnlaceConversation) => {
    const { name, avatarUrl, color } = conversationDisplay(c, myId, participants[c.id] ?? []);
    const mine = c.last_message_sender_id === myId;
    const preview = c.last_message_preview ? `${mine ? "Tú: " : ""}${c.last_message_preview}` : "Sin mensajes todavía";
    const st = stateFor(c.id);
    const other = (participants[c.id] ?? []).find((p) => p.id !== myId);
    const online = c.type === "direct" && !!other?.last_seen_at &&
      Date.now() - new Date(other.last_seen_at).getTime() < 2 * 60 * 1000;
    return (
      <div
        key={c.id}
        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, id: c.id }); }}
      >
        <ConversationRowWithTyping
          conversationId={c.id}
          myId={myId}
          name={name}
          avatarUrl={avatarUrl}
          color={color}
          preview={preview}
          time={timeAgo(c.last_message_at)}
          unread={isUnread(c)}
          unreadCount={unreadCounts[c.id] ?? 0}
          active={c.id === selectedId}
          muted={st.muted}
          pinned={st.pinned}
          online={online}
          onOpen={() => { if (isUnread(c)) markRead(c.id); router.push(`/chat/${c.id}`); }}
          onToggleMute={() => toggleMute(c.id)}
          onTogglePin={() => togglePin(c.id)}
          onMarkRead={() => markRead(c.id)}
          onToggleArchive={() => toggleArchive(c.id)}
        />
      </div>
    );
  };

  return (
    // Altura fija reservada bajo el header del Shell (y la tab bar inferior
    // en celular) — la única franja de la app donde el layout normal de
    // en celular) — la única franja de la app donde el layout normal de
    // Emet se rompe a propósito: aquí ambos paneles (o el único visible en
    // celular) ocupan toda esa altura, sin que la página entera se desplace.
    // .chat-ws aplica el scope del workspace premium (paleta, sombras,
    // radios) a todo lo que vive dentro, sin tocar el resto de la app.
    <div className="chat-ws h-[calc(100dvh-12rem)] md:h-[calc(100dvh-3.5rem)] min-h-[420px] -mx-4 md:mx-0">
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex flex-1 min-h-0">
          {/* Panel izquierdo — lista de conversaciones */}
          <div
            className={`w-full md:w-[380px] shrink-0 md:border-r md:border-border flex-col ${atRoot ? "flex" : "hidden md:flex"}`}
            style={{ background: "var(--chat-list-bg)" }}
          >
            <div className="px-4 md:px-5 pt-4 md:pt-6 pb-4 shrink-0 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[20px] font-bold tracking-tight">Chat</p>
                  <p className="text-[12px]" style={{ color: "var(--text-2)" }}>Mensajes con tu equipo</p>
                </div>
              </div>

              <button
                onClick={() => setNewOpen("direct")}
                data-ripple
                className="nx-new-btn w-full h-12 rounded-[14px] flex items-center justify-center gap-2 text-[14px] font-semibold text-white cursor-pointer"
              >
                <Icon name="plus" size={18} aria-hidden /> Nuevo mensaje
              </button>

              <div className="flex gap-1.5" role="tablist" aria-label="Filtrar conversaciones">
                {(([["all", "Todos"], ["unread", "No leídos"], ["pinned", "Fijados"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={filter === k}
                    onClick={() => setFilter(k)}
                    className="h-8 px-3.5 rounded-full text-[12.5px] font-semibold transition-all duration-150 bg-transparent hover:bg-hover active:scale-[.97]"
                    style={filter === k
                      ? { background: "var(--accent)", color: "#FFFFFF", boxShadow: "0 4px 14px rgba(38,99,255,0.35)" }
                      : { color: "var(--text-3)" }}
                  >
                    {label}
                  </button>
                )))}
              </div>

              {!online && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-full text-[12px] font-semibold"
                  style={{ background: "var(--warn-tint)", color: "var(--warn)" }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: "var(--warn)" }} />
                  Sin conexión — reconectando…
                </div>
              )}
            </div>

            {showNotifBanner && (
              <div className="mx-4 md:mx-5 mb-4 shrink-0 flex items-center gap-2.5 rounded-[14px] px-3.5 py-2.5"
                style={{ background: "var(--surface)", border: "0.5px solid var(--border)", boxShadow: "var(--shadow-1)" }}>
                <Icon name="bell" size={14} style={{ color: "var(--accent)" }} />
                <p className="text-[12px] flex-1 leading-snug" style={{ color: "var(--text-2)" }}>
                  Activa las notificaciones de escritorio para no perderte los mensajes en segundo plano.
                </p>
                <button
                  onClick={enableNotifs}
                  className="shrink-0 text-[12px] font-bold"
                  style={{ color: "var(--accent)" }}
                >
                  Activar
                </button>
                <button
                  onClick={dismissNotifBanner}
                  aria-label="Descartar"
                  className="shrink-0 grid place-items-center h-6 w-6 rounded-full hover:bg-hover"
                >
                  <Icon name="close" size={12} style={{ color: "var(--text-3)" }} />
                </button>
              </div>
            )}

            <div className="px-4 md:px-5 pb-4 shrink-0">
              {/* Buscador estilo Signal (spec chat §2): pastilla redondeada,
                  icono SVG, placeholder gris tenue, Ctrl+K lo enfoca, botón
                  de limpiar y pulso del icono mientras se buscan mensajes. */}
              <div className="relative">
                <span
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--text-3)", animation: searching ? "nx-search-pulse 1.1s ease-in-out infinite" : undefined }}
                >
                  <Icon name="search" size={14} aria-hidden />
                </span>
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar conversaciones y mensajes…"
                  aria-label="Buscar conversaciones"
                  className="w-full h-9 rounded-full pl-9 pr-10 text-[13.5px] border border-transparent placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)] transition-all duration-150"
                  style={{ background: "var(--surface-2)", color: "var(--text-1)" }}
                />
                {search ? (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-5 h-5 rounded-full hover:bg-hover transition-colors duration-150"
                    style={{ color: "var(--text-3)" }}
                  >
                    <Icon name="close" size={11} aria-hidden />
                  </button>
                ) : (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded-[5px] border pointer-events-none"
                    style={{ color: "var(--text-3)", borderColor: "var(--border-2)" }}
                    title="Ctrl + K"
                  >
                    ⌘K
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-4">
              {conversations.length === 0 ? (
                <div className="px-2">
                  <EmptyState
                    icon={<Icon name="message" size={22} />}
                    title="Sin conversaciones todavía"
                    hint="Escribe a un compañero o crea un grupo para empezar."
                    action={<Button variant="primary" onClick={() => setNewOpen("direct")} data-ripple>Escribir a alguien</Button>}
                  />
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredConversations.map(renderRow)}

                  {filteredConversations.length === 0 && messageHits.length === 0 && (
                    <p className="text-[13px] text-center py-8" style={{ color: "var(--text-3)" }}>
                      {search ? `Nadie coincide con "${search}"` : "No hay conversaciones aquí."}
                    </p>
                  )}

                  {messageHits.length > 0 && (
                    <div className="pt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide px-2 pb-1.5" style={{ color: "var(--text-3)" }}>Mensajes</p>
                      {messageHits.map((hit) => (
                        <button
                          key={hit.id}
                          onClick={() => router.push(`/chat/${hit.conversation_id}`)}
                          className="w-full text-left px-2 py-2 rounded-m hover:bg-hover"
                        >
                          <p className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>{hit.sender_name}</p>
                          <p className="text-[12.5px] truncate">{hit.content}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {!search && archivedConversations.length > 0 && (
                    <div className="pt-3">
                      <button
                        onClick={() => setShowArchived((v) => !v)}
                        className="w-full flex items-center justify-between px-2 py-2 text-[12.5px] font-semibold"
                        style={{ color: "var(--text-3)" }}
                      >
                        <span>Archivadas ({archivedConversations.length})</span>
                        <Icon name={showArchived ? "chevronUp" : "chevronDown"} size={14} />
                      </button>
                      {showArchived && <div className="space-y-0.5 mt-1">{archivedConversations.map(renderRow)}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho — conversación abierta (o estado vacío en /chat) */}
          <div
            key={atRoot ? "root" : selectedId}
            className={`flex-1 min-w-0 flex-col ${atRoot ? "hidden md:flex" : "flex"}`}
            style={{ animation: "nx-panel-in .2s var(--ease)" }}
          >
            {atRoot ? (
              <ChatEmptyState
                onNew={() => setNewOpen("direct")}
                onNewGroup={() => setNewOpen("group")}
                onFocusSearch={() => { searchRef.current?.focus(); searchRef.current?.select(); }}
              />
            ) : children}
          </div>
        </div>
      </div>

      <NewConversationSheet
        open={newOpen !== null}
        initialMode={newOpen ?? "direct"}
        onClose={() => setNewOpen(null)}
        onCreated={(id) => { setNewOpen(null); router.push(`/chat/${id}`); }}
        myId={myId}
        onToast={(msg) => toast(msg, "danger")}
      />

      {ctxMenu && (() => {
        const c = conversations.find((x) => x.id === ctxMenu.id);
        if (!c) return null;
        const st = stateFor(c.id);
        const close = () => setCtxMenu(null);
        return (
          <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={close}>
            <ContextMenuItem icon={st.pinned ? "pinOff" : "pin"} label={st.pinned ? "Desfijar" : "Fijar"} onClick={() => { togglePin(c.id); close(); }} />
            <ContextMenuItem icon={st.muted ? "bell" : "bellOff"} label={st.muted ? "Activar notificaciones" : "Silenciar"} onClick={() => { toggleMute(c.id); close(); }} />
            <ContextMenuItem icon="archive" label={st.archived ? "Desarchivar" : "Archivar"} onClick={() => { toggleArchive(c.id); close(); }} />
            {isUnread(c) && (
              <ContextMenuItem icon="check" label="Marcar como leído" onClick={() => { markRead(c.id); close(); }} />
            )}
            <ContextMenuSeparator />
            <ContextMenuItem icon="arrow" label="Abrir conversación" onClick={() => { close(); router.push(`/chat/${c.id}`); }} />
          </ContextMenu>
        );
      })()}
    </div>
  );
}

/* Estado vacío del panel derecho en escritorio (spec chat §2): ilustración
   SVG propia de Emet, título, subtítulo y accesos rápidos para empezar.
   En celular este panel nunca se ve — solo la lista. */
function ChatEmptyState({ onNew, onNewGroup, onFocusSearch }: {
  onNew: () => void; onNewGroup: () => void; onFocusSearch: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="flex flex-col items-center text-center max-w-[360px]">
        <svg width="176" height="136" viewBox="0 0 176 136" fill="none" aria-hidden>
          <defs>
            <linearGradient id="nx-empty-chat" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3B6EFF" />
              <stop offset="1" stopColor="#195BFF" />
            </linearGradient>
          </defs>
          <circle cx="150" cy="22" r="9" fill="var(--accent)" opacity="0.16" />
          <circle cx="22" cy="108" r="6" fill="var(--accent)" opacity="0.16" />
          <rect x="28" y="30" width="116" height="82" rx="24" fill="url(#nx-empty-chat)" opacity="0.16" />
          <rect x="44" y="50" width="54" height="8" rx="4" fill="var(--accent)" opacity="0.85" />
          <rect x="44" y="68" width="76" height="8" rx="4" fill="var(--accent)" opacity="0.45" />
          <rect x="44" y="86" width="42" height="8" rx="4" fill="var(--accent)" opacity="0.45" />
          <path d="M84 112 l9 10 9 -10 z" fill="url(#nx-empty-chat)" opacity="0.5" />
        </svg>
        <h2 className="mt-5 text-[19px] font-bold tracking-tight">No hay conversación seleccionada</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          Elige un chat de la lista o empieza una conversación con tu equipo.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={onNew}
            data-ripple
            className="nx-new-btn h-10 px-4 rounded-full flex items-center gap-2 text-[13px] font-semibold text-white cursor-pointer"
          >
            <Icon name="plus" size={15} aria-hidden /> Crear chat
          </button>
          <button
            onClick={onFocusSearch}
            className="h-10 px-4 rounded-full flex items-center gap-2 text-[13px] font-semibold cursor-pointer transition-all duration-150 hover:bg-hover active:scale-[.97]"
            style={{ background: "var(--surface-2)", color: "var(--text-1)" }}
          >
            <Icon name="search" size={14} aria-hidden /> Buscar compañero
          </button>
          <button
            onClick={onNewGroup}
            className="h-10 px-4 rounded-full flex items-center gap-2 text-[13px] font-semibold cursor-pointer transition-all duration-150 hover:bg-hover active:scale-[.97]"
            style={{ background: "var(--surface-2)", color: "var(--text-1)" }}
          >
            <Icon name="users" size={14} aria-hidden /> Crear grupo
          </button>
        </div>
      </div>
    </div>
  );
}

function NewConversationSheet({
  open, onClose, onCreated, myId, onToast, initialMode = "direct",
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  myId: string;
  onToast: (msg: string) => void;
  initialMode?: "direct" | "group";
}) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [people, setPeople] = useState<ParticipantLite[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode); setSearch(""); setSelected(new Set()); setGroupName("");
    const supabase = createClient();
    // Solo equipo interno (admin/empleado) — coordinador/departamento/rh no
    // deben aparecer como destino de chat. El filtro real (que no se puede
    // saltar) vive en las funciones nx_enlace_* (ver migración 0012);
    // este es el filtro de UI para no ni mostrarlos como opción.
    supabase
      .from("users_directory")
      .select("id, display_name, avatar_url, nexus_color, role")
      .eq("active", true)
      .in("role", ["admin", "empleado"])
      .neq("id", myId)
      .order("display_name")
      .then(({ data }) => setPeople((data ?? []) as ParticipantLite[]));
  }, [open, myId, initialMode]);

  const filtered = useMemo(
    () => people.filter((p) => p.display_name.toLowerCase().includes(search.toLowerCase())),
    [people, search]
  );

  const toggleSelect = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pickDirect = async (otherId: string) => {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("nx_enlace_get_or_create_direct", { p_other_user_id: otherId });
    setBusy(false);
    if (error) { onToast(error.message); return; }
    onCreated(data as string);
  };

  const createGroup = async () => {
    if (!groupName.trim()) { onToast("Ponle un nombre al grupo"); return; }
    if (selected.size === 0) { onToast("Selecciona al menos un integrante"); return; }
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("nx_enlace_create_group", {
      p_name: groupName.trim(),
      p_member_ids: Array.from(selected),
    });
    setBusy(false);
    if (error) { onToast(error.message); return; }
    onCreated(data as string);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Nuevo mensaje">
      <div className="flex gap-2 mb-4">
        <Button variant={mode === "direct" ? "primary" : "subtle"} size="sm" onClick={() => setMode("direct")}>Directo</Button>
        <Button variant={mode === "group" ? "primary" : "subtle"} size="sm" onClick={() => setMode("group")}>Grupo</Button>
      </div>

      {mode === "group" && (
        <Input
          placeholder="Nombre del grupo"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="mb-3"
        />
      )}

      <Input icon="search" placeholder="Buscar compañero..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />

      <div className="max-h-[42vh] overflow-y-auto -mx-1">
        {filtered.map((p) => (
          <PersonRow
            key={p.id}
            name={p.display_name}
            avatarUrl={p.avatar_url}
            color={p.nexus_color}
            onClick={() => (mode === "direct" ? pickDirect(p.id) : toggleSelect(p.id))}
            right={mode === "group" ? <CheckBox checked={selected.has(p.id)} /> : undefined}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-[13px] text-center py-8" style={{ color: "var(--text-3)" }}>
            Nadie coincide con &ldquo;{search}&rdquo;
          </p>
        )}
      </div>

      {mode === "group" && (
        <div className="pt-4">
          <Button variant="primary" onClick={createGroup} disabled={busy} className="w-full">
            Crear grupo{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
