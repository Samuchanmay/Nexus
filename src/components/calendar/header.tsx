"use client";
import Link from "next/link";

/* ── Calendar Engine · header compacto ──
   (EMET-CALENDAR-ENGINE.md §14) — UNA sola barra para todas las vistas.
   Botones de 32px cuadrados, título del mes/día/semana, flechas prev/next
   y "Hoy". El selector de vista y la acción de crear van como children
   (cada página decide), para no forzar un layout sobre pantallas que no
   tienen vista (ej. el heatmap de Asistencia del admin). */

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
  const navBtn = "w-8 h-8 grid place-items-center rounded-sm font-semibold text-[14px] transition-colors";
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
      className="h-8 px-3 rounded-sm text-[12.5px] font-semibold transition-colors hover:bg-hover active:scale-95"
      style={{ color: "var(--text-2)" }}>
      Hoy
    </button>
  ) : todayHref ? (
    <Link href={todayHref}
      className="h-8 px-3 rounded-sm text-[12.5px] font-semibold transition-colors hover:bg-hover"
      style={{ color: "var(--text-2)" }}>
      Hoy
    </Link>
  ) : null;

  return (
    <header className="pt-7 pb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <h1 className="text-[26px] font-bold tracking-tight capitalize truncate" aria-live="polite">{title}</h1>
        {subtitle && (
          <p className="text-[13px] mt-1.5 hidden lg:block" style={{ color: "var(--text-2)" }}>{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          {prev}
          {today}
          {next}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
