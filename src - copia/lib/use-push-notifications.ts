"use client";
import { useEffect, useRef, useState } from "react";

const VAPID_PUBLIC_KEY = "BKcd5cuYmT5NnzqvXgPGhNRHRsfFTGg43jjDEqDNV-FaQ3CcfEql0i9htNBPBXPELzEqDQoFnFn_WlTBQ5sFnVU";

/**
 * Registro push (FASE 2): registra el service worker y deja la suscripción
 * Web Push guardada en `push_subscriptions` (vía /api/push/subscribe), para
 * que la Edge Function send-chat-push pueda notificar con la app cerrada.
 *
 * NUNCA pide el permiso — ese gesto es exclusivo del banner de /chat
 * (requestChatNotificationPermission, FASE 1), para no mostrar dos prompts
 * a la vez. Si el permiso aún está en "default", no hace nada: se registra
 * cuando el banner conceda el permiso y llame a nudgePushRegistration().
 */

const nudgeListeners = new Set<() => void>();

/** Notifica a los watchers activos (usePushNotifications) que el permiso ya
    se concedió y pueden registrar la suscripción. Lo llama el banner de /chat. */
export function nudgePushRegistration() {
  for (const l of nudgeListeners) l();
}

/** Registra el service worker + suscripción. No pide permiso. Idempotente:
    si ya hay suscripción, la reenvía (upsert) para mantener la fila al día. */
export async function registerPushSubscription(userId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if ("Notification" in window && Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // El cast a BufferSource es solo para el checker: los tipos globales de
      // Uint8Array/DOM lib de esta versión de TS son estrictos sobre el tipo
      // de buffer subyacente (ArrayBuffer vs ArrayBufferLike), pero en runtime
      // esto siempre es un ArrayBuffer real — Uint8Array.from() nunca produce
      // un SharedArrayBuffer.
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, subscription: sub.toJSON() }),
    });
    return true;
  } catch {
    /* push no disponible — no bloquea */
    return false;
  }
}

/** Watcher de registro push, montado en el AppShell para los roles con chat
    (admin/empleado). Registra si el permiso ya está concedido; el banner de
    /chat dispara nudgePushRegistration() al concederlo en el momento. */
export function usePushNotifications(userId: string | undefined, enabled = true) {
  const [subscribed, setSubscribed] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!userId || !enabled) return;

    const run = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      const ok = await registerPushSubscription(userId);
      busyRef.current = false;
      if (ok) setSubscribed(true);
    };

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      void run();
    }
    const onNudge = () => {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        void run();
      }
    };
    nudgeListeners.add(onNudge);
    return () => { nudgeListeners.delete(onNudge); };
  }, [userId, enabled]);

  return subscribed;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw.split("").map((c) => c.charCodeAt(0)));
}
