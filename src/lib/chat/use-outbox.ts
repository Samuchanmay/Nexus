"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EnlaceMessage } from "@/lib/types";
import { advance } from "./message-state";
import { triggerChatPush } from "./push";

const MAX_RETRIES = 3;
// Backoff exponencial con jitter: 1s, 2s, 4s base ±20% aleatorio para
// evitar que múltiples usuarios reintenten al mismo tiempo (thundering herd).
// Cap en 8s para no bloquear la UI demasiado tiempo.
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 8000;
const RETRY_JITTER = 0.2; // ±20%

function computeRetryDelay(attempt: number): number {
  const base = Math.min(RETRY_BASE_MS * Math.pow(2, attempt - 1), RETRY_MAX_MS);
  const jitter = base * RETRY_JITTER * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

type PendingEntry = {
  message: EnlaceMessage;
  attempts: number;
  timer?: ReturnType<typeof setTimeout>;
};

/**
 * Canal entre pestañas para el outbox (FASE "plataforma de mensajería
 * moderna"): cuando una pestaña encola un mensaje optimista o lo lleva a
 * `failed`, las demás pestañas de la misma conversación lo reflejan al
 * instante. El caso feliz (INSERT confirmado) ya lo cubre Realtime con su
 * dedupe por client_id; esto cubre el estado INTERMEDIO — que el mensaje
 * optimista exista y que el fallo se pinte sin esperar a que Realtime
 * reconcilie.
 */
const OUTBOX_CHANNEL = "emet-chat-outbox";

type OutboxMessage =
  | { kind: "enqueue"; conversationId: string; message: EnlaceMessage }
  | { kind: "fail"; conversationId: string; clientId: string };

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
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const pendingRef = useRef<Map<string, PendingEntry>>(new Map());
  // Mismo proveedor de estado en todas las pestañas: al broadcastear usamos
  // el objeto por defecto ("" name) y al recibir escribimos sobre el mismo
  // objeto, así un envío en una pestaña refresca las demás sin duplicar.
  const channelRef = useRef<BroadcastChannel | null>(null);
  const post = useCallback((msg: OutboxMessage) => {
    channelRef.current?.postMessage(msg);
  }, []);

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
        sticker_image_path: message.sticker_image_path ?? null,
      })
      .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng, read_at, sticker_image_path, reply_count")
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
        .select("id, conversation_id, sender_id, type, content, reply_to_id, edited, created_at, status, client_id, deleted_at, lat, lng, read_at, sticker_image_path, reply_count")
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
      // Propaga el fallo a las demás pestañas de la misma conversación.
      post({ kind: "fail", conversationId, clientId: message.client_id! });
      return;
    }
    const delay = computeRetryDelay(entry.attempts);
    entry.timer = setTimeout(() => attemptInsert(entry), delay);
  }, [patchMessage, post, conversationId]);

  /** Encola cualquier mensaje optimista (texto/sticker/ubicación) con su
      reintento — la única puerta al outbox. */
  const enqueue = useCallback((optimistic: EnlaceMessage) => {
    const clientId = optimistic.client_id!;
    setMessages((cur) => [...cur, optimistic]);
    const entry: PendingEntry = { message: optimistic, attempts: 0 };
    pendingRef.current.set(clientId, entry);
    attemptInsert(entry);
    // Anuncia el optimista a las demás pestañas (Realtime aún no lo ve —
    // no existe fila todavía).
    post({ kind: "enqueue", conversationId, message: optimistic });
    return clientId;
  }, [attemptInsert, conversationId, post]);

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

  /** FASE W7 — sticker con imagen (Emu generado por IA). La imagen ya existe
      en Storage (generate-sticker la subió) antes de llamar esto — acá solo
      se manda el mensaje que la referencia, mismo mecanismo optimista que
      el resto. */
  const sendStickerImage = useCallback((imagePath: string, replyToId: string | null = null) => {
    const clientId = crypto.randomUUID();
    return enqueue({ ...base(clientId, null), type: "sticker", sticker_image_path: imagePath, reply_to_id: replyToId });
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
  //
  // Bug previo: este listener se registra una sola vez (deps solo
  // [attemptInsert], que no cambia) y el segundo bucle leía `messages`
  // directamente del closure — quedaba congelado en el valor del primer
  // render. Un mensaje que fallara por el "fail" de OTRA pestaña (vía
  // BroadcastChannel, sin PendingEntry local) nunca se reintentaba al
  // reconectar porque ese `messages` nunca veía el mensaje agregado
  // después. Se usa `messagesRef` (siempre actualizado) en su lugar; los
  // mensajes fallidos que sí tienen PendingEntry local (el caso normal) ya
  // se reintentaban bien por el primer bucle, que usa la ref de pendientes.
  useEffect(() => {
    const onOnline = () => {
      for (const [clientId, entry] of pendingRef.current) {
        entry.attempts = 0;
        attemptInsert(entry);
      }
      setMessages((cur) => cur.map((m) => (m.status === "failed" ? { ...m, status: "pending" as const } : m)));
      for (const m of messagesRef.current) {
        if (m.status === "failed" && m.client_id && !pendingRef.current.has(m.client_id)) {
          const entry: PendingEntry = { message: { ...m, status: "pending" }, attempts: 0 };
          pendingRef.current.set(m.client_id, entry);
          attemptInsert(entry);
        }
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [attemptInsert]);

  useEffect(() => {
    return () => {
      for (const entry of pendingRef.current.values()) clearTimeout(entry.timer);
    };
  }, []);

  // Escucha los mensajes del outbox de otras pestañas de la misma
  // conversación: encola el optimista que ellas anunciaron (si este tab no
  // lo tiene) y pinta los fallos. El dedupe por client_id evita duplicados
  // tanto con el realtime como con un enqueue simultáneo de dos pestañas.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(OUTBOX_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (e: MessageEvent<OutboxMessage>) => {
      const data = e.data;
      if (!data || data.conversationId !== conversationId) return;
      if (data.kind === "enqueue") {
        const { client_id } = data.message;
        if (!client_id) return;
        setMessages((cur) => (cur.some((m) => m.client_id === client_id) ? cur : [...cur, data.message]));
      } else if (data.kind === "fail") {
        setMessages((cur) => cur.map((m) => (m.client_id === data.clientId ? { ...m, status: "failed" as const } : m)));
      }
    };
    return () => {
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [conversationId]);

  return { messages, setMessages, send, sendSticker, sendStickerImage, sendLocation, retry };
}
