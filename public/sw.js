const CACHE = "emet-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("push", (e) => {
  if (!e.data) return;
  try {
    const data = e.data.json();
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
    e.waitUntil(self.registration.showNotification(data.title ?? "EMET", opts));
  } catch { /* malformed push */ }
});

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
