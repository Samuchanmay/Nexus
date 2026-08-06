"use client";

/**
 * Notificaciones de navegador para el chat — Notifications API, sin
 * service worker. Complementa el sonido y la animación in-app: cuando la
 * pestaña está en segundo plano, un mensaje entrante salta como
 * notificación del sistema (la OS reproduce su propio sonido).
 *
 * Las notificaciones se agrupan por conversación usando `tag`: si llegan
 * tres mensajes del mismo chat, la OS reemplaza la anterior en vez de
 * apilarlas (mismo comportamiento que Signal/WhatsApp Desktop).
 */

const NOTIF_TAG_PREFIX = "emet-chat-";
const NOTIFICATIONS = new Map<string, Notification>();

export function chatNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Pide (o confirma) el permiso. Devuelve el estado resultante. */
export async function requestChatNotificationPermission(): Promise<NotificationPermission> {
  if (!chatNotificationsSupported()) return "denied";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Muestra la notificación de un mensaje entrante. No hace nada si el
    permiso falta o la pestaña está en primer plano (ahí el sonido in-app
    y la animación ya cubren la notificación). */
export function showIncomingChatNotification(opts: {
  conversationId: string;
  title: string;
  body: string;
  icon?: string | null;
}): void {
  if (!chatNotificationsSupported()) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  try {
    const tag = `${NOTIF_TAG_PREFIX}${opts.conversationId}`;
    NOTIFICATIONS.get(tag)?.close();
    const n = new Notification(opts.title, {
      body: opts.body,
      tag,
      icon: opts.icon ?? "/logo-emet-isotipo.svg",
    });
    NOTIFICATIONS.set(tag, n);
    n.onclick = () => {
      n.close();
      NOTIFICATIONS.delete(tag);
      window.focus();
      window.location.assign(`/chat/${opts.conversationId}`);
    };
  } catch {
    /* notificaciones no disponibles — nunca bloquea el chat */
  }
}

/** Previsualización para el cuerpo de la notificación, truncada y con
    texto por tipo de adjunto (mismo criterio que fileEmoji en el chat). */
export function messageNotificationBody(m: {
  type: string;
  content: string | null;
}): string {
  if (m.content) return m.content.length > 90 ? `${m.content.slice(0, 90)}…` : m.content;
  if (m.type === "image") return "📷 Adjuntó una imagen";
  if (m.type === "file") return "📎 Adjuntó un archivo";
  if (m.type === "location") return "📍 Compartió una ubicación";
  if (m.type === "sticker") return "🎨 Envió un sticker";
  if (m.type === "poll") return "📊 Creó una encuesta";
  if (m.type === "system") return "Mensaje del sistema";
  return "Nuevo mensaje";
}
