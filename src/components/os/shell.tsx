"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Avatar, IconButton, Kbd, cx } from "./ui";
import { NotificationBell } from "./notifications";
import { ProfileModal } from "./profile-modal";
import { useTheme } from "@/lib/theme";
import { navFor, SECTIONS, type NavItem, type Role } from "@/lib/nav";

export type ShellUser = { id: string; name: string; area: string; color: string; roleLabel: string };

export function Shell({
  role, user, active, onNavigate, title, actions, children,
}: {
  role: Role;
  user: ShellUser;
  active: string;
  onNavigate: (key: string) => void;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const items = useMemo(() => navFor(role), [role]);
  const [drawer, setDrawer] = useState(false);
  const [spot, setSpot] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { theme, toggle } = useTheme();

  // ⌘K / Ctrl+K abre el Spotlight
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSpot((s) => !s);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const go = useCallback((key: string) => { onNavigate(key); setDrawer(false); setSpot(false); }, [onNavigate]);

  return (
    <div className="nx-os min-h-screen bg-bg flex mesh" data-mesh={role}>
      {/* Sidebar */}
      <Sidebar items={items} active={active} onGo={go} user={user}
        className="hidden md:flex" />

      {/* Drawer móvil */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-40 nx-fade" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-y-0 left-0 nx-slide" onClick={(e) => e.stopPropagation()} style={{ animation: "nx-slide .2s ease both" }}>
            <Sidebar items={items} active={active} onGo={go} user={user} className="flex h-full" />
          </div>
        </div>
      )}

      {/* Columna principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 flex items-center gap-2 px-4 md:px-6 bg-bg/80 backdrop-blur-xl border-b border-border">
          <IconButton icon="layers" label="Menú" className="md:hidden" onClick={() => setDrawer(true)} />
          <h1 className="text-[16px] font-bold text-text-1 truncate">{title}</h1>
          <div className="flex-1" />
          <button
            onClick={() => setSpot(true)}
            className="hidden sm:flex items-center gap-2 h-9 pl-3 pr-2 rounded-sm bg-surface-2 border border-border text-text-3 hover:bg-hover transition-colors"
          >
            <Icon name="search" size={15} />
            <span className="text-[13px]">Buscar…</span>
            <span className="flex items-center gap-0.5 ml-2"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
          </button>
          {actions}
          <IconButton icon={theme === "dark" ? "sun" : "moon"} label="Cambiar tema" onClick={toggle} />
          <NotificationBell userId={user.id} />
          <button
            className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            title={user.name}
            onClick={() => setProfileOpen(true)}
          >
            <Avatar name={user.name} color={user.color} size={32} />
          </button>
        </header>

        <main className="flex-1 nx-scroll overflow-y-auto p-4 md:p-6 flex flex-col">
          <div className="max-w-[1140px] mx-auto w-full flex-1">{children}</div>
          <footer className="max-w-[1140px] mx-auto w-full mt-10 pt-4 text-center text-[11px]"
            style={{ color: "var(--text-3)", borderTop: "1px solid var(--border)" }}>
            Nexus · CERT Comunicación
          </footer>
        </main>
      </div>

      {spot && <Spotlight items={items} onGo={go} onClose={() => setSpot(false)} />}
      {profileOpen && (
        <ProfileModal
          userId={user.id}
          name={user.name}
          roleLabel={user.roleLabel}
          color={user.color}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Sidebar ───────────────────────── */
function Sidebar({ items, active, onGo, user, className }: {
  items: NavItem[]; active: string; onGo: (k: string) => void; user: ShellUser; className?: string;
}) {
  return (
    <aside className={cx("w-[248px] shrink-0 flex-col bg-sidebar border-r border-border", className)}>
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-cert.png" alt="CERT" className="h-7 w-7 object-contain shrink-0" />
        <div className="leading-tight">
          <p className="text-[15px] font-bold text-text-1">Nexus</p>
          <p className="text-[11px] text-text-3 -mt-0.5">CERT · Comunicación</p>
        </div>
      </div>

      <nav className="flex-1 nx-scroll overflow-y-auto px-3 py-4 space-y-5">
        {SECTIONS.map((sec) => {
          const list = items.filter((i) => i.section === sec.id);
          if (!list.length) return null;
          return (
            <div key={sec.id}>
              <p className="px-2.5 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-text-3">{sec.label}</p>
              <div className="space-y-0.5">
                {list.map((i) => {
                  const on = active === i.key;
                  return (
                    <button
                      key={i.key} onClick={() => onGo(i.key)}
                      className={cx(
                        "w-full flex items-center gap-2.5 h-9 px-2.5 rounded-sm text-[14px] font-medium transition-colors duration-150",
                        on ? "bg-accent text-white shadow-sm" : "text-text-2 hover:bg-hover hover:text-text-1"
                      )}
                    >
                      <Icon name={i.icon} size={18} />
                      <span>{i.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 p-2 rounded-sm hover:bg-hover transition-colors cursor-pointer">
          <Avatar name={user.name} color={user.color} size={34} />
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] font-semibold text-text-1 truncate">{user.name}</p>
            <p className="text-[11px] text-text-3 truncate">{user.roleLabel}</p>
          </div>
          <span className="ml-auto text-text-3"><Icon name="logout" size={16} /></span>
        </div>
      </div>
    </aside>
  );
}

/* ───────────────────────── Spotlight (⌘K) ───────────────────────── */
function Spotlight({ items, onGo, onClose }: {
  items: NavItem[]; onGo: (k: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => i.label.toLowerCase().includes(t));
  }, [q, items]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSel(0); }, [q]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      else if (e.key === "Enter" && results[sel]) { e.preventDefault(); onGo(results[sel].key); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [results, sel, onGo, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4 nx-fade" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[560px] rounded-lg bg-panel border border-border shadow-nx overflow-hidden nx-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
          <Icon name="search" size={18} className="text-text-3" />
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Ir a… o escribe una acción"
            className="flex-1 bg-transparent text-[15px] text-text-1 placeholder:text-text-3 focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[340px] nx-scroll overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="text-center text-[13px] text-text-3 py-8">Sin resultados para “{q}”.</p>
          )}
          {results.map((i, idx) => {
            const on = idx === sel;
            return (
              <button
                key={i.key} onClick={() => onGo(i.key)} onMouseEnter={() => setSel(idx)}
                className={cx(
                  "w-full flex items-center gap-3 h-11 px-3 rounded-sm text-left transition-colors",
                  on ? "bg-accent text-white" : "text-text-1 hover:bg-hover"
                )}
              >
                <Icon name={i.icon} size={18} className={on ? "text-white" : "text-text-3"} />
                <span className="text-[14px] font-medium flex-1">{i.label}</span>
                {on && <span className="text-[11px] opacity-80">↵</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
