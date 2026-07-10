"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconButton, cx } from "./ui";
import { Icon } from "./icons";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  kind: string | null;
  read: boolean;
  created_at: string;
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

/** Campana de notificaciones — lee/marca contra la tabla notifications (RLS: solo lo propio). */
export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase
      .from("notifications")
      .select("id, title, body, kind, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (active) { setItems((data ?? []) as NotificationRow[]); setLoading(false); }
      });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    setItems((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await createClient().from("notifications").update({ read: true }).eq("id", id);
  };

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
    await createClient().from("notifications").update({ read: true }).in("id", ids);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <IconButton icon="bell" label="Notificaciones" onClick={() => setOpen((o) => !o)} />
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full text-[9px] font-bold text-white flex items-center justify-center pointer-events-none"
            style={{ background: "var(--danger)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] max-h-[420px] rounded-lg bg-panel border border-border shadow-nx overflow-hidden nx-pop flex flex-col">
          <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
            <p className="text-[13.5px] font-bold text-text-1">Notificaciones</p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11.5px] font-semibold"
                style={{ color: "var(--accent)" }}
              >
                Marcar todo leído
              </button>
            )}
          </div>
          <div className="flex-1 nx-scroll overflow-y-auto">
            {loading ? (
              <p className="text-center text-[12.5px] text-text-3 py-10">Cargando…</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Icon name="bell" size={22} className="text-text-3" />
                <p className="text-[12.5px] text-text-3">Sin notificaciones por ahora</p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={cx(
                    "w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-border last:border-b-0 transition-colors hover:bg-hover",
                    n.read && "opacity-55"
                  )}
                  style={!n.read ? { background: "var(--accent-tint)" } : undefined}
                >
                  <span
                    className="mt-1.5 h-[7px] w-[7px] rounded-full shrink-0"
                    style={{ background: n.read ? "transparent" : "var(--accent)" }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-text-1 truncate">{n.title}</span>
                    {n.body && <span className="block text-[12px] text-text-3 mt-0.5 line-clamp-2">{n.body}</span>}
                    <span className="block text-[10.5px] text-text-3 mt-1">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
