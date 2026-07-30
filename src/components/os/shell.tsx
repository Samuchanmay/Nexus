"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { Avatar, IconButton, Kbd, cx } from "./ui";
import { NotificationBell } from "./notifications";
import { ProfileModal } from "./profile-modal";
import { useTheme } from "@/lib/theme";
import { useMountOnOpen } from "@/lib/use-mount-on-open";
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
      <Sidebar items={items} active={active} onGo={go}
        className="hidden md:flex" theme={theme} />

      {/* Drawer móvil */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-40 nx-fade" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-y-0 left-0 nx-slide" onClick={(e) => e.stopPropagation()} style={{ animation: "nx-slide .2s ease both" }}>
            <Sidebar items={items} active={active} onGo={go}
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
            aria-label="Buscar"
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-full text-text-3 hover:bg-hover transition-colors"
          >
            <Icon name="search" size={16} />
          </button>
          {/* Solo el ícono — el buscador con texto/campo real vive en cada
              pantalla (ej. Equipo); duplicar la función aquí solo confunde. */}
          <button
            onClick={() => setSpot(true)}
            aria-label="Buscar"
            title="Buscar (⌘K)"
            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full text-text-3 hover:bg-hover transition-colors"
          >
            <Icon name="search" size={15} />
          </button>
          {actions}
          <IconButton icon={theme === "dark" ? "sun" : "moon"} label="Cambiar tema" onClick={toggle} />
          <NotificationBell userId={user.id} />
          <button
            className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            title={user.name}
            onClick={() => setAvatarMenu(true)}
          >
            <Avatar name={user.name} color={user.color} size={32} avatarUrl={user.avatarUrl} birthday={isBirthdayToday(user.birthDate, todayISO())} />
          </button>
        </header>

        <UserMenu
          open={avatarMenu}
          hasJornada={items.some((i) => i.key === "jornada")}
          hasVacaciones={items.some((i) => i.key === "vacaciones")}
          hasConfig={hasConfig}
          theme={theme}
          onProfile={() => { setAvatarMenu(false); setProfileOpen(true); }}
          onJornada={() => { setAvatarMenu(false); go("jornada"); }}
          onVacaciones={() => { setAvatarMenu(false); go("vacaciones"); }}
          onConfig={() => { setAvatarMenu(false); go("config"); }}
          onToggleTheme={() => { setAvatarMenu(false); toggle(); }}
          onSignOut={() => { setAvatarMenu(false); signOut(); }}
          onClose={() => setAvatarMenu(false)}
        />

        <main className="flex-1 nx-scroll overflow-y-auto overflow-x-hidden p-4 pb-24 md:p-6 flex flex-col">
          <div className="max-w-[1140px] mx-auto w-full flex-1">{children}</div>
          {/* Solo en móvil — en escritorio no aporta y compite con el contenido real (punto 11 de la auditoría). */}
          <footer className="md:hidden max-w-[1140px] mx-auto w-full mt-10 pt-4 text-center text-[12px]"
            style={{ color: "var(--text-3)", borderTop: "1px solid var(--border)" }}>
            Hecho con ❤️ por Samu Chan
          </footer>
        </main>
      </div>

      <MobileBottomNav items={items} active={active} onGo={go} ficharAction={ficharAction} />

      <Spotlight open={spot} items={items} onGo={go} onClose={() => setSpot(false)} />
      {profileOpen && (
        <ProfileModal
          userId={user.id}
          name={user.name}
          roleLabel={user.roleLabel}
          role={role}
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
        <span className="text-[12px] font-semibold leading-none">{i.label}</span>
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
        <div className="flex-1 flex items-start justify-center relative" style={{ marginTop: "-16px" }}>
          <Link
            href="/fichar"
            aria-label="Registrar entrada o salida"
            className="grid place-items-center h-14 w-14 rounded-full text-white active:scale-95 transition-transform"
            style={{
              background: "var(--accent)",
              boxShadow: "0 3px 10px color-mix(in srgb, var(--accent) 40%, transparent), 0 0 0 5px var(--surface)",
            }}
          >
            <Icon name="clock" size={23} />
          </Link>
        </div>
      )}
      {right.map(Tab)}
    </nav>
  );
}

/* ───────────────────────── Centro de Usuario (avatar superior) ─────────────────────────
   Un solo menú anclado al avatar del header (escritorio y móvil): perfil,
   accesos directos personales, tema y cerrar sesión. Sustituye por completo
   al perfil inferior del Sidebar — ya no hay dos lugares para lo mismo. */
function UserMenu({
  open, hasJornada, hasVacaciones, hasConfig, theme,
  onProfile, onJornada, onVacaciones, onConfig, onToggleTheme, onSignOut, onClose,
}: {
  open: boolean;
  hasJornada: boolean; hasVacaciones: boolean; hasConfig: boolean; theme: "light" | "dark";
  onProfile: () => void; onJornada: () => void; onVacaciones: () => void;
  onConfig: () => void; onToggleTheme: () => void; onSignOut: () => void; onClose: () => void;
}) {
  // DIAGNOSTICO-OVERLAY-BUG §3c — antes se montaba/desmontaba de golpe con
  // `{avatarMenu && <UserMenu/>}`, sin useMountOnOpen ni pointerEvents guard,
  // a diferencia de todos los demás overlays del sistema.
  const { mounted, visible } = useMountOnOpen(open, 200);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 nx-fade"
      style={{ pointerEvents: visible ? "all" : "none", opacity: visible ? 1 : 0, transition: "opacity .2s ease" }}
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="absolute top-[60px] right-3 w-[230px] rounded-lg bg-panel border border-border shadow-nx overflow-hidden nx-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onProfile} className="w-full flex items-center gap-2.5 px-3.5 h-11 text-[13.5px] font-semibold text-text-1 hover:bg-hover transition-colors">
          <Icon name="person" size={16} className="text-text-3" /> Mi perfil
        </button>
        {hasJornada && (
          <button onClick={onJornada} className="w-full flex items-center gap-2.5 px-3.5 h-11 text-[13.5px] font-semibold text-text-1 hover:bg-hover transition-colors">
            <Icon name="clock" size={16} className="text-text-3" /> Mi jornada
          </button>
        )}
        {hasVacaciones && (
          <button onClick={onVacaciones} className="w-full flex items-center gap-2.5 px-3.5 h-11 text-[13.5px] font-semibold text-text-1 hover:bg-hover transition-colors">
            <Icon name="plane" size={16} className="text-text-3" /> Vacaciones
          </button>
        )}
        {hasConfig && (
          <button onClick={onConfig} className="w-full flex items-center gap-2.5 px-3.5 h-11 text-[13.5px] font-semibold text-text-1 hover:bg-hover transition-colors">
            <Icon name="settings" size={16} className="text-text-3" /> Configuración
          </button>
        )}
        <div className="border-t border-border" />
        <button onClick={onToggleTheme} className="w-full flex items-center gap-2.5 px-3.5 h-11 text-[13.5px] font-semibold text-text-1 hover:bg-hover transition-colors">
          <Icon name={theme === "dark" ? "sun" : "moon"} size={16} className="text-text-3" />
          Tema {theme === "dark" ? "claro" : "oscuro"}
        </button>
        <div className="border-t border-border" />
        <button onClick={onSignOut} className="w-full flex items-center gap-2.5 px-3.5 h-11 text-[13.5px] font-semibold hover:bg-hover transition-colors" style={{ color: "var(--danger)" }}>
          <Icon name="logout" size={16} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Sidebar ───────────────────────── */
function Sidebar({ items, active, onGo, className, theme }: {
  items: NavItem[]; active: string; onGo: (k: string) => void; className?: string; theme: "light" | "dark";
}) {
  return (
    <aside className={cx("w-[248px] shrink-0 flex-col bg-sidebar border-r border-border", className)}>
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={theme === "dark" ? "/logo-cert-dark.png" : "/logo-cert-light.png"} alt="CERT" className="h-7 w-7 object-contain shrink-0" />
        <div className="leading-tight">
          <p className="text-[15px] font-bold text-text-1">Emet</p>
          <p className="text-[12px] text-text-3 -mt-0.5">CERT · Comunicación</p>
        </div>
      </div>

      <nav className="flex-1 nx-scroll overflow-y-auto px-3 py-4 space-y-6">
        {SECTIONS.map((sec) => {
          const list = items.filter((i) => i.section === sec.id);
          if (!list.length) return null;
          return (
            <div key={sec.id}>
              <p className="px-2.5 mb-1.5 text-[12px] font-bold text-text-3">{sec.label}</p>
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
    </aside>
  );
}

/* ───────────────────────── Spotlight (⌘K) ───────────────────────── */
function Spotlight({ open, items, onGo, onClose }: {
  open: boolean; items: NavItem[]; onGo: (k: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Mismo guard que UserMenu (§3c del diagnóstico).
  const { mounted, visible } = useMountOnOpen(open, 200);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => i.label.toLowerCase().includes(t));
  }, [q, items]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { setSel(0); }, [q]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      else if (e.key === "Enter" && results[sel]) { e.preventDefault(); onGo(results[sel].key); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, results, sel, onGo, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4 nx-fade"
      style={{ pointerEvents: visible ? "all" : "none", opacity: visible ? 1 : 0, transition: "opacity .2s ease" }}
      onClick={onClose}>
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
                {on && <span className="text-[12px] opacity-80">↵</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
