"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EnlaceMessage } from "@/lib/types";
import { advance } from "./message-state";
import { triggerChatPush } from "./push";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [800, 2500, 6000];

type PendingEntry = {
  message: EnlaceMessage;
  attempts: number;
  timer?: ReturnType<typeof setTimeout>;
};

/**
 * Reemplaza el `send()` optimista simple por una cola local con estados y
 * reintento — la pieza central del comportamiento "nunca se pierde, nunca
 * se duplica" que pedía la referencia de Signal.
 *
 * No persiste en IndexedDB: a la escala real de Emet (ver documento de
 * arquitectura, ~20 usuarios) el estado en memoria + reintento al
 * reconectar cubre el caso real de "se cortó el wifi un momento". Si el
 * usuario cierra la pestaña con mensajes en `pending`, esos se pierden —
 * igual que hoy — pero ya no se pierden silenciosamente: quedan visibles
 * como `failed` en el momento en que Supabase confirma o falla el insert,
 * en vez de simplemente desaparecer.
 */
export function useOutbox(conversationId: string, myId: string, initialMessages: EnlaceMessage[]) {
  const [messages, setMessages] = useState<EnlaceMessage[]>(initialMessages);
  const pendingRef = useRef<Map<string, PendingEntry>>(new Map());

  const patchMessage = useCallback((clientId: string, patch: Partial<EnlaceMessage>) => {
    setMessages((cur) => cur.map((m) => (m.client_id === clientId ? { ...m, ...patch } : m)));
  }, []);

  const attemptInsert = useCallback(async (entry: PendingEntry) => {
    const supabase = createClient();
    const { message } = entry;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        type: message.type,
        content: message.content,
        reply_to_id: message.reply_to_id,
        client_id: message.client_id,
        lat: message.lat ?? null,
        lng: message.lng ?? null,
      })
      .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng")
      .single();

    if (!error && data) {
      pendingRef.current.delete(message.client_id!);
      // Reemplaza la fila optimista por la real (mismo client_id, ya con id
      // de servidor) — si el realtime INSERT también llega, el filtro por
      // id en el listener de arriba lo ignora porque ya existe.
      setMessages((cur) => cur.map((m) => (m.client_id === message.client_id ? { ...(data as EnlaceMessage) } : m)));
      // Push a receptores con la app cerrada (FASE 2) — best-effort, nunca
      // bloquea el envío; el Realtime cubre a quien tiene la app abierta.
      void triggerChatPush(data.id);
      return;
    }

    // Código 23505 = unique_violation en el índice de client_id: significa
    // que un intento anterior SÍ había llegado a insertarse (p. ej. el
    // insert tuvo éxito en el servidor pero la respuesta nunca llegó al
    // cliente por la caída de red). No es un error real — solo hay que
    // traer la fila que ya existe y reconciliar, nunca reintentar de nuevo.
    if (error?.code === "23505") {
      const { data: existing } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng")
        .eq("client_id", message.client_id!)
        .maybeSingle();
      pendingRef.current.delete(message.client_id!);
      if (existing) {
        setMessages((cur) => cur.map((m) => (m.client_id === message.client_id ? { ...(existing as EnlaceMessage) } : m)));
      }
      return;
    }

    entry.attempts += 1;
    if (entry.attempts > MAX_RETRIES) {
      patchMessage(message.client_id!, { status: advance(message.status, "failed") });
      return;
    }
    const delay = RETRY_DELAYS_MS[Math.min(entry.attempts - 1, RETRY_DELAYS_MS.length - 1)];
    entry.timer = setTimeout(() => attemptInsert(entry), delay);
  }, [patchMessage]);

  /** Encola cualquier mensaje optimista (texto/sticker/ubicación) con su
      reintento — la única puerta al outbox. */
  const enqueue = useCallback((optimistic: EnlaceMessage) => {
    const clientId = optimistic.client_id!;
    setMessages((cur) => [...cur, optimistic]);
    const entry: PendingEntry = { message: optimistic, attempts: 0 };
    pendingRef.current.set(clientId, entry);
    attemptInsert(entry);
    return clientId;
  }, [attemptInsert]);

  const base = (clientId: string, content: string | null): Omit<EnlaceMessage, "type"> => ({
    id: `local-${clientId}`,
    conversation_id: conversationId,
    sender_id: myId,
    content,
    reply_to_id: null,
    edited: false,
    deleted_at: null,
    created_at: new Date().toISOString(),
    status: "pending",
    client_id: clientId,
  });

  const send = useCallback((content: string, replyToId: string | null = null) => {
    const clientId = crypto.randomUUID();
    return enqueue({ ...base(clientId, content), type: "text", reply_to_id: replyToId });
  }, [enqueue, base]);

  /** Stickers (FASE cierre): emoji grande como mensaje, sin archivo. */
  const sendSticker = useCallback((emoji: string, replyToId: string | null = null) => {
    const clientId = crypto.randomUUID();
    return enqueue({ ...base(clientId, emoji), type: "sticker", reply_to_id: replyToId });
  }, [enqueue, base]);

  /** Ubicación (FASE cierre): lat/lng en columnas, sin content. */
  const sendLocation = useCallback((lat: number, lng: number, replyToId: string | null = null) => {
    const clientId = crypto.randomUUID();
    return enqueue({ ...base(clientId, null), type: "location", lat, lng, reply_to_id: replyToId });
  }, [enqueue, base]);

  /** Reintento manual desde la UI (botón sobre un mensaje en `failed`). */
  const retry = useCallback((clientId: string) => {
    const entry = pendingRef.current.get(clientId);
    const msg = entry?.message ?? messages.find((m) => m.client_id === clientId);
    if (!msg) return;
    patchMessage(clientId, { status: "pending" });
    const fresh: PendingEntry = { message: { ...msg, status: "pending" }, attempts: 0 };
    pendingRef.current.set(clientId, fresh);
    attemptInsert(fresh);
  }, [messages, patchMessage, attemptInsert]);

  // Al recuperar conexión, reintenta todo lo que quedó en pending/failed.
  useEffect(() => {
    const onOnline = () => {
      for (const [clientId, entry] of pendingRef.current) {
        entry.attempts = 0;
        attemptInsert(entry);
      }
      setMessages((cur) => cur.map((m) => (m.status === "failed" ? { ...m, status: "pending" as const } : m)));
      for (const m of messages) {
        if (m.status === "failed" && m.client_id && !pendingRef.current.has(m.client_id)) {
          const entry: PendingEntry = { message: { ...m, status: "pending" }, attempts: 0 };
          pendingRef.current.set(m.client_id, entry);
          attemptInsert(entry);
        }
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptInsert]);

  useEffect(() => {
    return () => {
      for (const entry of pendingRef.current.values()) clearTimeout(entry.timer);
    };
  }, []);

  return { messages, setMessages, send, sendSticker, sendLocation, retry };
}
