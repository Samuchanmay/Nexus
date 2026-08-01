const CACHE = "emet-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("push", (e) => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    e.waitUntil(showOrSuppress(data));
  } catch { /* malformed push */ }
});

// FASE 2: si el usuario YA tiene esa conversación abierta y enfocada en
// una pestaña visible, la UI en vivo ya la muestra (sonido + animación) —
// mostrar además la notificación del sistema sería duplicado molesto. Si
// está en otra pestaña/página o la app está cerrada, sí se muestra. El tag
// por conversación (mismo que usa el cliente en notify.ts) hace que varios
// mensajes del mismo chat reemplacen la notificación en vez de apilarla.
async function showOrSuppress(data) {
  const convId = data.conversationId ?? null;
  if (convId) {
    try {
      const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const viewing = windows.some((c) =>
        c.visibilityState === "visible" &&
        c.focused === true &&
        c.url.includes(`/chat/${convId}`)
      );
      if (viewing) return;
    } catch { /* falla el check — se muestra igual */ }
  }
  const opts = {
    body: data.body ?? "",
    icon: "/logo-emet-icon.png",
    badge: "/logo-emet-isotipo.svg",
    tag: data.tag ?? "chat",
    data: { url: data.url ?? "/chat" },
    vibrate: [100, 50, 100],
    requireInteraction: true,
    silent: false,
  };
  await self.registration.showNotification(data.title ?? "EMET", opts);
}

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? "/chat";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
