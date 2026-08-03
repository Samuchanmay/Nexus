"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STOP_TYPING_MS = 2500; // deja de emitir "escribiendo" tras esta inactividad
const CLEAR_REMOTE_MS = 3000; // si no llega otro evento en este tiempo, se asume que paró

/**
 * Indicadores de actividad efímeros ("fulano está escribiendo…" y "fulano
 * está grabando un audio") — broadcast que no se persiste en la base (no
 * hay tabla nueva). Usa el mismo canal de Realtime que ya existe por
 * conversación, solo que con `broadcast` en vez de `postgres_changes`,
 * que es el mecanismo correcto de Supabase para señales efímeras.
 *
 * El "escribiendo" no tiene evento de fin explícito: se deja de reemitir y
 * el receptor lo limpia por CLEAR_REMOTE_MS. El "grabando" SÍ tiene fin
 * explícito (`on: false` al soltar/enviar la nota) para que el indicador
 * desaparezca apenas termina, además del mismo respaldo por timeout.
 */
export function useTyping(conversationId: string, myId: string, myName: string) {
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [recordingUsers, setRecordingUsers] = useState<Map<string, string>>(new Map());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const clearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const recordingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`chat-typing-${conversationId}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { userId, name } = payload as { userId: string; name: string };
        if (userId === myId) return;
        setTypingUsers((cur) => new Map(cur).set(userId, name));
        const existing = clearTimersRef.current.get(userId);
        if (existing) clearTimeout(existing);
        clearTimersRef.current.set(userId, setTimeout(() => {
          setTypingUsers((cur) => {
            const next = new Map(cur);
            next.delete(userId);
            return next;
          });
        }, CLEAR_REMOTE_MS));
      })
      .on("broadcast", { event: "recording" }, ({ payload }) => {
        const { userId, name, on } = payload as { userId: string; name: string; on: boolean };
        if (userId === myId) return;
        const existing = recordingTimersRef.current.get(userId);
        if (existing) clearTimeout(existing);
        if (on) {
          setRecordingUsers((cur) => new Map(cur).set(userId, name));
          recordingTimersRef.current.set(userId, setTimeout(() => {
            setRecordingUsers((cur) => {
              const next = new Map(cur);
              next.delete(userId);
              return next;
            });
          }, CLEAR_REMOTE_MS));
        } else {
          setRecordingUsers((cur) => {
            const next = new Map(cur);
            next.delete(userId);
            return next;
          });
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      for (const t of clearTimersRef.current.values()) clearTimeout(t);
      for (const t of recordingTimersRef.current.values()) clearTimeout(t);
      clearTimeout(stopTimerRef.current);
    };
  }, [conversationId, myId]);

  const notifyTyping = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: myId, name: myName } });
    clearTimeout(stopTimerRef.current);
    // No hay un evento explícito de "dejé de escribir": simplemente se deja
    // de reemitir, y el receptor lo limpia solo por CLEAR_REMOTE_MS.
    stopTimerRef.current = setTimeout(() => {}, STOP_TYPING_MS);
  }, [myId, myName]);

  const notifyRecording = useCallback((on: boolean) => {
    channelRef.current?.send({ type: "broadcast", event: "recording", payload: { userId: myId, name: myName, on } });
  }, [myId, myName]);

  const typingText = (() => {
    const names = Array.from(typingUsers.values());
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} está escribiendo`;
    return `${names.slice(0, 2).join(", ")} están escribiendo`;
  })();

  const recordingText = (() => {
    const names = Array.from(recordingUsers.values());
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} está grabando un audio`;
    return `${names.slice(0, 2).join(", ")} están grabando audios`;
  })();

  return { typingText, recordingText, notifyTyping, notifyRecording };
}
