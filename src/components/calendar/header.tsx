"use client";
import Link from "next/link";

/* ── Calendar Engine · header compacto rediseñado ──
   (EMET-CALENDAR-ENGINE.md §14 + mejoras UX Ago 2026)
   
   Rediseño inspirado en Apple Calendar y Cron:
   - Barra superior: título del período + navegación (← Hoy →)
   - Barra inferior: tabs de vista + granularidad + acción principal
   - Padding reducido para dar más espacio al calendario
   - Jerarquía visual más clara con separación de controles
*/

export function CalendarHeader({
  title, subtitle, prevHref, nextHref, onPrev, onNext, onToday, todayHref, children,
}: {
  title: string;
  subtitle?: string;
  prevHref?: string;
  nextHref?: string;
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  todayHref?: string;
  children?: React.ReactNode;
}) {
  const navBtn = "w-9 h-9 grid place-items-center rounded-lg font-semibold text-[14px] transition-all duration-200";
  const navCls = `${navBtn} hover:bg-hover active:scale-95`;

  const prev = onPrev ? (
    <button type="button" onClick={onPrev} className={navCls} aria-label="Anterior">
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  ) : prevHref ? (
    <Link href={prevHref} className={navCls} aria-label="Anterior">
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  ) : null;

  const next = onNext ? (
    <button type="button" onClick={onNext} className={navCls} aria-label="Siguiente">
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  ) : nextHref ? (
    <Link href={nextHref} className={navCls} aria-label="Siguiente">
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  ) : null;

  const today = onToday ? (
    <button type="button" onClick={onToday}
      className="h-9 px-4 rounded-lg text-[13.5px] font-semibold transition-all duration-200 hover:bg-hover active:scale-95"
      style={{ color: "var(--text-2)", background: "var(--surface-2)" }}>
      Hoy
    </button>
  ) : todayHref ? (
    <Link href={todayHref}
      className="h-9 px-4 rounded-lg text-[13.5px] font-semibold transition-all duration-200 hover:bg-hover"
      style={{ color: "var(--text-2)", background: "var(--surface-2)" }}>
      Hoy
    </Link>
  ) : null;

  return (
    <header className="pt-6 pb-4">
      {/* Barra superior: Título + Navegación */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-bold tracking-tight capitalize text-text-1 leading-none" aria-live="polite">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[14px] mt-2" style={{ color: "var(--text-2)" }}>{subtitle}</p>
          )}
        </div>
        
        {/* Controles de navegación */}
        <div className="flex items-center gap-2">
          {prev}
          {today}
          {next}
        </div>
      </div>

      {/* Barra inferior: Tabs + Granularidad + Acción principal */}
      {children && (
        <div className="flex items-center justify-between gap-4 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            {children}
          </div>
        </div>
      )}
    </header>
  );
}
