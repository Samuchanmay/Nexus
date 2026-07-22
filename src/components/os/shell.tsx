"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { Avatar, IconButton, Kbd, cx } from "./ui";
import { NotificationBell } from "./notifications";
import { ProfileModal } from "./profile-modal";
import { useTheme } from "@/lib/theme";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { navFor, SECTIONS, type NavItem, type Role } from "@/lib/nav";
import { createClient } from "@/lib/supabase/client";

export type ShellUser = { id: string; name: string; area: string; color: string; roleLabel: string; avatarUrl?: string | null; birthDate?: string | null };

export function Shell({
  role, user, active, onNavigate, title, actions, children, ficharAction = false,
}: {
  role: Role;
  user: ShellUser;
  active: string;
  onNavigate: (key: string) => void;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Muestra el botón central elevado de Registro de Jornada en el tab bar móvil. */
  ficharAction?: boolean;
}) {
  const items = useMemo(() => navFor(role), [role]);
  const [drawer, setDrawer] = useState(false);
  const [spot, setSpot] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarMenu, setAvatarMenu] = useState(false);
  const hasConfig = items.some((i) => i.key === "config");
  const router = useRouter();
  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };
  const { theme, toggle } = useTheme();
  // Badge del atajo de búsqueda: ⌘ solo en Mac, "Ctrl" en Windows/Linux —
  // antes se mostraba ⌘K fijo sin importar el sistema operativo del usuario.
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent));
  }, []);

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
        onProfileOpen={() => setProfileOpen(true)}
        className="hidden md:flex" theme={theme} />

      {/* Drawer móvil */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-40 nx-fade" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-y-0 left-0 nx-slide" onClick={(e) => e.stopPropagation()} style={{ animation: "nx-slide .2s ease both" }}>
            <Sidebar items={items} active={active} onGo={go} user={user}
              onProfileOpen={() => setProfileOpen(true)}
              className="flex h-full" theme={theme} />
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
            <span className="flex items-center justify-center shrink-0 w-[15px] h-[15px]">
              <Icon name="search" size={15} />
            </span>
            <span className="text-[13px] leading-none shrink-0">Buscar…</span>
            <span className="flex items-center gap-0.5 ml-2 shrink-0">{isMac ? <Kbd>⌘</Kbd> : <Kbd>Ctrl</Kbd>}<Kbd>K</Kbd></span>
          </button>
          {actions}
          <IconButton icon={theme === "dark" ? "sun" : "moon"} label="Cambiar tema" onClick={toggle} />
          <NotificationBell userId={user.id} />
          <button
            className="ml-1 hidden md:inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            title={user.name}
            onClick={() => setProfileOpen(true)}
          >
            <Avatar name={user.name} color={user.color} size={32} avatarUrl={user.avatarUrl} birthday={isBirthdayToday(user.birthDate, todayISO())} />
          </button>
          <button
            className="ml-1 md:hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            title={user.name}
            onClick={() => setAvatarMenu(true)}
          >
            <Avatar name={user.name} color={user.color} size={32} avatarUrl={user.avatarUrl} birthday={isBirthdayToday(user.birthDate, todayISO())} />
          </button>
        </header>

        {avatarMenu && (
          <MobileAvatarMenu
            hasConfig={hasConfig}
            onProfile={() => { setAvatarMenu(false); setProfileOpen(true); }}
            onConfig={() => { setAvatarMenu(false); go("config"); }}
            onSignOut={() => { setAvatarMenu(false); signOut(); }}
            onClose={() => setAvatarMenu(false)}
          />
        )}

        <main className="flex-1 nx-scroll overflow-y-auto overflow-x-hidden p-4 pb-24 md:p-6 flex flex-col">
          <div className="max-w-[1140px] mx-auto w-full flex-1">{children}</div>
          <footer className="max-w-[1140px] mx-auto w-full mt-10 pt-4 text-center text-[11px]"
            style={{ color: "var(--text-3)", borderTop: "1px solid var(--border)" }}>
            Hecho con ❤️ por Samu Chan
          </footer>
        </main>
      </div>

      <MobileBottomNav items={items} active={active} onGo={go} ficharAction={ficharAction} />

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

/* ───────────────────────── Bottom Navigation (móvil) ─────────────────────────
   Tab bar estilo Mercado Pago: hasta 4 destinos primarios (el mismo orden que
   la sidebar) repartidos a los lados de un botón central elevado — Registro
   de Jornada, el CTA principal de la app — cuando el rol lo tiene habilitado.
   Sin "Más": el resto de la navegación vive en el drawer (ícono de menú del
   header) y en el nuevo menú del avatar (Perfil/Configuración/Cerrar sesión). */
function MobileBottomNav({ items, active, onGo, ficharAction }: {
  items: NavItem[]; active: string; onGo: (k: string) => void; ficharAction: boolean;
}) {
  const primary = items.slice(0, ficharAction ? 4 : 5);
  const left = ficharAction ? primary.slice(0, 2) : primary;
  const right = ficharAction ? primary.slice(2, 4) : [];

  const Tab = (i: NavItem) => {
    const on = active === i.key;
    return (
      <button
        key={i.key}
        onClick={() => onGo(i.key)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
        style={{ color: on ? "var(--accent)" : "var(--text-3)" }}
      >
        <Icon name={i.icon} size={20} />
        <span className="text-[10px] font-semibold leading-none">{i.label}</span>
      </button>
    );
  };

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 flex items-stretch"
      style={{
        background: "var(--surface)",
        borderTop: "0.5px solid var(--border-2)",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
      }}
    >
      {left.map(Tab)}
      {ficharAction && (
        <div className="flex-1 flex items-start justify-center relative" style={{ marginTop: "-22px" }}>
          <Link
            href="/fichar"
            aria-label="Registrar entrada o salida"
            className="grid place-items-center h-14 w-14 rounded-full text-white shadow-nx active:scale-95 transition-transform"
            style={{
              background: "var(--accent)",
              boxShadow: "0 6px 18px color-mix(in srgb, var(--accent) 45%, transparent)",
              border: "3px solid var(--surface)",
            }}
          >
            <Icon name="clock" size={24} />
          </Link>
        </div>
      )}
      {right.map(Tab)}
    </nav>
  );
}

/* ───────────────────────── Menú del avatar (móvil) ─────────────────────────
   Reemplaza a la pestaña "Más": perfil, configuración (si el rol la tiene)
   y cerrar sesión, anclado bajo el avatar del header. */
function MobileAvatarMenu({ hasConfig, onProfile, onConfig, onSignOut, onClose }: {
  hasConfig: boolean; onProfile: () => void; onConfig: () => void; onSignOut: () => void; onClose: () => void;
}) {
  return (
    <div className="md:hidden fixed inset-0 z-50 nx-fade" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="absolute top-[60px] right-3 w-[220px] rounded-lg bg-panel border border-border shadow-nx overflow-hidden nx-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onProfile} className="w-full flex items-center gap-2.5 px-3.5 h-11 text-[13.5px] font-semibold text-text-1 hover:bg-hover transition-colors">
          <Icon name="person" size={16} className="text-text-3" /> Perfil
        </button>
        {hasConfig && (
          <button onClick={onConfig} className="w-full flex items-center gap-2.5 px-3.5 h-11 text-[13.5px] font-semibold text-text-1 hover:bg-hover transition-colors">
            <Icon name="settings" size={16} className="text-text-3" /> Configuración
          </button>
        )}
        <div className="border-t border-border" />
        <button onClick={onSignOut} className="w-full flex items-center gap-2.5 px-3.5 h-11 text-[13.5px] font-semibold hover:bg-hover transition-colors" style={{ color: "var(--danger)" }}>
          <Icon name="logout" size={16} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Sidebar ───────────────────────── */
function Sidebar({ items, active, onGo, user, onProfileOpen, className, theme }: {
  items: NavItem[]; active: string; onGo: (k: string) => void; user: ShellUser; onProfileOpen: () => void; className?: string; theme: "light" | "dark";
}) {
  const router = useRouter();
  const signOut = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await createClient().auth.signOut();
    router.push("/login");
  };
  return (
    <aside className={cx("w-[248px] shrink-0 flex-col bg-sidebar border-r border-border", className)}>
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={theme === "dark" ? "/logo-cert-dark.png" : "/logo-cert-light.png"} alt="CERT" className="h-7 w-7 object-contain shrink-0" />
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
        <button
          onClick={onProfileOpen}
          className="w-full flex items-center gap-2.5 p-2 rounded-sm hover:bg-hover transition-colors cursor-pointer text-left"
        >
          <Avatar name={user.name} color={user.color} size={34} avatarUrl={user.avatarUrl} birthday={isBirthdayToday(user.birthDate, todayISO())} />
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] font-semibold text-text-1 truncate">{user.name}</p>
            <p className="text-[11px] text-text-3 truncate">{user.roleLabel}</p>
          </div>
          <span
            className="ml-auto text-text-3 hover:text-danger transition-colors"
            onClick={signOut}
            title="Cerrar sesión"
            role="button"
          >
            <Icon name="logout" size={16} />
          </span>
        </button>
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
          <span className="flex items-center justify-center shrink-0 w-[18px] h-[18px]">
            <Icon name="search" size={18} className="text-text-3" />
          </span>
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Ir a… o escribe una acción"
            className="flex-1 bg-transparent text-[15px] leading-none text-text-1 placeholder:text-text-3 focus:outline-none"
          />
          <span className="shrink-0"><Kbd>esc</Kbd></span>
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
