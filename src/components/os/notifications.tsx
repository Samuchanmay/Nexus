"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/** Centro de eventos del sistema — categorías por "kind" (vacation/request/incident/info…). */
const KIND_META: Record<string, { label: string; icon: string; color: string }> = {
  vacation: { label: "Vacaciones", icon: "plane", color: "var(--accent)" },
  request: { label: "Solicitudes", icon: "inbox", color: "var(--warn)" },
  incident: { label: "Incidencias", icon: "medical", color: "var(--danger)" },
  info: { label: "Sistema", icon: "bell", color: "var(--text-2)" },
};
const kindMeta = (k: string | null) => KIND_META[k ?? "info"] ?? KIND_META.info;

function groupedByDay(items: NotificationRow[]): { label: string; items: NotificationRow[] }[] {
  const groups: { label: string; items: NotificationRow[] }[] = [];
  for (const n of items) {
    const label = dayLabel(n.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}

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

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Hoy";
  if (sameDay(d, yesterday)) return "Ayer";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long" });
}

/** Campana de notificaciones — bottom sheet con filtros por categoría (RLS: solo lo propio). */
export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | string>("all");
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleOpen = () => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setAnchor({ top: rect.bottom + 10, right: Math.max(12, window.innerWidth - rect.right) });
    }
    setOpen(true);
  };

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase
      .from("notifications")
      .select("id, title, body, kind, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (active) { setItems((data ?? []) as NotificationRow[]); setLoading(false); }
      });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const kindsPresent = useMemo(
    () => Array.from(new Set(items.map((n) => n.kind ?? "info"))),
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((n) => !n.read);
    return items.filter((n) => (n.kind ?? "info") === filter);
  }, [items, filter]);

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
        <IconButton icon="bell" label="Notificaciones" onClick={handleOpen} />
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full text-[9px] font-bold text-white flex items-center justify-center pointer-events-none"
            style={{ background: "var(--danger)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>

      {/* Móvil: bottom sheet de pantalla completa. Escritorio: dropdown convencional anclado bajo la campana.
          Portal a document.body: escapa del backdrop-blur del header (que crea containing block y atrapaba el fixed). */}
      {mounted && createPortal(
        <div
          className={isDesktop ? "fixed inset-0 z-[500]" : "fixed inset-0 z-[500] flex items-end justify-center"}
          style={
            isDesktop
              ? { background: "transparent", pointerEvents: open ? "all" : "none" }
              : {
                  background: open ? "rgba(0,0,0,.38)" : "rgba(0,0,0,0)",
                  backdropFilter: open ? "blur(14px)" : "blur(0px)",
                  pointerEvents: open ? "all" : "none",
                  transition: "background .35s var(--ease), backdrop-filter .35s var(--ease)",
                }
          }
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className={isDesktop ? "flex flex-col" : "w-full max-w-[440px] max-h-[78vh] flex flex-col"}
          style={
            isDesktop
              ? {
                  position: "fixed",
                  top: anchor?.top ?? 64,
                  right: anchor?.right ?? 16,
                  width: "400px",
                  maxHeight: "76vh",
                  background: "var(--surface)",
                  borderRadius: "18px",
                  border: "0.5px solid var(--border-2)",
                  boxShadow: "0 16px 50px rgba(0,0,0,0.22)",
                  transformOrigin: "top right",
                  transform: open ? "scale(1) translateY(0)" : "scale(0.96) translateY(-6px)",
                  opacity: open ? 1 : 0,
                  pointerEvents: open ? "all" : "none",
                  transition: "transform .28s var(--spring), opacity .2s var(--ease)",
                }
              : {
                  background: "var(--surface)",
                  borderRadius: "26px 26px 0 0",
                  borderTop: "0.5px solid var(--border-2)",
                  boxShadow: "0 -8px 60px rgba(0,0,0,0.18)",
                  transform: open ? "translateY(0)" : "translateY(100%)",
                  transition: "transform .46s var(--spring)",
                }
          }>
          {!isDesktop && (
            <div className="w-[34px] h-[5px] rounded-[3px] mx-auto mt-3 shrink-0" style={{ background: "var(--surface-3)" }} />
          )}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
            <h2 className="text-[21px] font-bold tracking-tight">Notificaciones</h2>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
                  Marcar todo leído
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Cerrar"
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                <Icon name="close" size={13} />
              </button>
            </div>
          </div>

          {/* Filtros por categoría */}
          <div className="flex items-center gap-1.5 px-5 pb-3.5 overflow-x-auto shrink-0">
            <button onClick={() => setFilter("all")}
              className="shrink-0 px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap"
              style={filter === "all"
                ? { background: "var(--accent)", color: "#fff" }
                : { background: "var(--surface-2)", color: "var(--text-2)" }}>
              Todas
            </button>
            <button onClick={() => setFilter("unread")}
              className="shrink-0 px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap"
              style={filter === "unread"
                ? { background: "var(--accent)", color: "#fff" }
                : { background: "var(--surface-2)", color: "var(--text-2)" }}>
              Sin leer{unread > 0 ? ` (${unread})` : ""}
            </button>
            {kindsPresent.map((k) => {
              const meta = kindMeta(k);
              return (
                <button key={k} onClick={() => setFilter(k)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap flex items-center gap-1"
                  style={filter === k
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: "var(--surface-2)", color: "var(--text-2)" }}>
                  <Icon name={meta.icon} size={11} /> {meta.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 nx-scroll overflow-y-auto border-t border-border">
            {loading ? (
              <p className="text-center text-[13.5px] text-text-3 py-10">Cargando…</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-2">
                <Icon name="bell" size={22} className="text-text-3" />
                <p className="text-[13.5px] text-text-3">
                  {filter === "all" ? "Sin notificaciones por ahora" : "Nada aquí por ahora"}
                </p>
              </div>
            ) : (
              groupedByDay(filtered).map((group) => (
                <div key={group.label}>
                  <p className="px-5 pt-3 pb-1.5 text-[12px] font-bold uppercase tracking-wide text-text-3 sticky top-0"
                    style={{ background: "var(--surface)" }}>
                    {group.label}
                  </p>
                  {group.items.map((n) => {
                    const meta = kindMeta(n.kind);
                    return (
                      <button
                        key={n.id}
                        onClick={() => !n.read && markRead(n.id)}
                        className={cx(
                          "w-full flex items-start gap-3 px-5 py-3.5 text-left border-b border-border last:border-b-0 transition-colors hover:bg-hover",
                          n.read && "opacity-55"
                        )}
                        style={!n.read ? { background: "var(--accent-tint)" } : undefined}
                      >
                        <span className="w-8 h-8 rounded-full grid place-items-center shrink-0"
                          style={{
                            background: `color-mix(in srgb, ${meta.color} 22%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${meta.color} 35%, transparent)`,
                            color: meta.color,
                          }}>
                          <Icon name={meta.icon} size={16} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[14px] font-semibold text-text-1 truncate">{n.title}</span>
                          {n.body && <span className="block text-[13px] text-text-3 mt-0.5 line-clamp-2">{n.body}</span>}
                          <span className="block text-[11.5px] text-text-3 mt-1">{timeAgo(n.created_at)}</span>
                        </span>
                        {!n.read && <span className="mt-1.5 h-[7px] w-[7px] rounded-full shrink-0" style={{ background: "var(--accent)" }} />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>,
        document.body
      )}
    </div>
  );
}
