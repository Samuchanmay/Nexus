"use client";
import { createClient } from "@/lib/supabase/client";

/**
 * Dispara la notificación push (FASE 2) para un mensaje recién insertado.
 * Llamada desde el outbox y la subida de adjuntos justo después del INSERT
 * exitoso — el emisor siempre tiene la app abierta al enviar, así que aquí
 * es el lugar confiable para avisar al servidor (la Edge Function
 * send-chat-push entrega el push a los receptores con la app cerrada).
 *
 * Es best-effort como notify-vacation: si la Edge Function falla (VAPID sin
 * configurar, red, etc.) el mensaje ya quedó guardado y el Realtime sigue
 * cubriendo a quien tiene la app abierta — nunca bloquea el envío.
 */
export async function triggerChatPush(messageId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;
  try {
    const { data: { session } } = await createClient().auth.getSession();
    if (!session) return false;
    const res = await fetch(`${supabaseUrl}/functions/v1/send-chat-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ message_id: messageId }),
    });
    const json = await res.json().catch(() => null);
    return !!json?.ok;
  } catch {
    return false;
  }
}
