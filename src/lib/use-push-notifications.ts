"use client";
import { useEffect, useRef } from "react";

const VAPID_PUBLIC_KEY = "BKcd5cuYmT5NnzqvXgPGhNRHRsfFTGg43jjDEqDNV-FaQ3CcfEql0i9htNBPBXPELzEqDQoFnFn_WlTBQ5sFnVU";

export function usePushNotifications(userId: string | undefined) {
  const registered = useRef(false);
  const subRef = useRef<PushSubscription | null>(null);

  useEffect(() => {
    if (!userId || registered.current || typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    registered.current = true;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          subRef.current = existing;
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // El cast a BufferSource es solo para el checker: los tipos globales de
          // Uint8Array/DOM lib de esta versión de TS son estrictos sobre el tipo
          // de buffer subyacente (ArrayBuffer vs ArrayBufferLike), pero en runtime
          // esto siempre es un ArrayBuffer real — Uint8Array.from() nunca produce
          // un SharedArrayBuffer.
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });

        subRef.current = sub;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, subscription: sub.toJSON() }),
        });
      } catch {
        /* push no disponible — no bloquea */
      }
    };

    register();
  }, [userId]);

  return subRef;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw.split("").map((c) => c.charCodeAt(0)));
}
