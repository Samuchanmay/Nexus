"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { playMessageReceived } from "@/lib/chat/sound";
import { showIncomingChatNotification, messageNotificationBody } from "@/lib/chat/notify";
import type { EnlaceMessage } from "@/lib/types";

const SITE_TITLE = "EMET · Sistema operativo para organizaciones";

/**
 * Watcher global de la bandeja del chat — montado en el AppShell, visible en
 * toda la app:
 *  - cuenta los no-leídos globales (badge del sidebar + título de la pestaña)
 *  - reproduce el sonido cuando llega un mensaje en OTRA conversación y la
 *    pestaña está en primer plano
 *  - muestra notificación del navegador cuando está en segundo plano
 *
 * La conversación actualmente abierta (/chat/[id]) la maneja la propia página
 * de conversación (animación + sonido/notificación con más contexto); aquí se
 * salta por ruta para no duplicar.
 */
export function useChatUnread(userId: string | undefined, enabled = true) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  const convRef = useRef<Map<string, { type: string; name: string | null }>>(new Map());
  const mutedRef = useRef<Set<string>>(new Set());
  const openConvId = useMemo(() => {
    if (!pathname?.startsWith("/chat/")) return null;
    return pathname.split("/")[2] ?? null;
  }, [pathname]);
  const openConvIdRef = useRef(openConvId);
  openConvIdRef.current = openConvId;

  useEffect(() => {
    if (!userId || !enabled) return;
    const supabase = createClient();
    let cancelled = false;

    const refresh = async () => {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, type, name, last_message_at, last_message_sender_id")
        .order("last_message_at", { ascending: false, nullsFirst: false });

      convRef.current = new Map((convs ?? []).map((c) => [c.id, { type: c.type, name: c.name }]));

      const ids = (convs ?? []).map((c) => c.id);
      if (ids.length === 0) { setCount(0); return; }

      const { data: mine } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at, muted")
        .eq("user_id", userId)
        .in("conversation_id", ids);

      mutedRef.current = new Set((mine ?? []).filter((r) => r.muted).map((r) => r.conversation_id));

      const readMap = new Map((mine ?? []).map((r) => [r.conversation_id, r.last_read_at]));

      const unread = (convs ?? []).filter((c) => {
        if (!c.last_message_at || c.last_message_sender_id === userId) return false;
        const readAt = readMap.get(c.id);
        return !readAt || new Date(c.last_message_at) > new Date(readAt);
      }).length;

      if (!cancelled) setCount(unread);
    };

    refresh();

    const channel = supabase
      .channel(`unread-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${userId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const row = payload.new as Pick<EnlaceMessage, "conversation_id" | "sender_id" | "type" | "content">;
        if (row.sender_id === userId) return;
        if (row.conversation_id === openConvIdRef.current) return;
        if (mutedRef.current.has(row.conversation_id)) return;
        if (document.visibilityState === "visible") { playMessageReceived(); return; }
        try {
          const { data: sender } = await supabase
            .from("users_directory")
            .select("display_name, avatar_url")
            .eq("id", row.sender_id)
            .maybeSingle();
          const senderName = sender?.display_name ?? null;
          const conv = convRef.current.get(row.conversation_id);
          showIncomingChatNotification({
            conversationId: row.conversation_id,
            title: conv && conv.type !== "direct" && conv.name
              ? conv.name
              : (senderName ?? "Nuevo mensaje"),
            body: senderName ? `${senderName}: ${messageNotificationBody(row)}` : messageNotificationBody(row),
            icon: sender?.avatar_url ?? null,
          });
        } catch { /* notificación no disponible — no bloquea */ }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    if (count > 0) {
      document.title = `(${count}) ${SITE_TITLE}`;
    } else {
      document.title = SITE_TITLE;
    }
    return () => { document.title = SITE_TITLE; };
  }, [count]);

  return count;
}
