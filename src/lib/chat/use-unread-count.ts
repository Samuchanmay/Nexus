"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EnlaceConversation } from "@/lib/types";

const SITE_TITLE = "EMET · Sistema operativo para organizaciones";

export function useChatUnread(userId: string | undefined) {
  const [count, setCount] = useState(0);
  const lastTitle = useRef(SITE_TITLE);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;

    const refresh = async () => {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, last_message_at, last_message_sender_id")
        .order("last_message_at", { ascending: false, nullsFirst: false });

      const ids = (convs ?? []).map((c) => c.id);
      if (ids.length === 0) { setCount(0); return; }

      const { data: mine } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId)
        .in("conversation_id", ids);

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
