"use client";

/* ── Calendar Engine · leyenda ──
   (EMET-CALENDAR-ENGINE.md §9 CalendarLegend) — muestra las capas activas
   con su color semántico. Sin capas activas no dibuja nada (nada que
   explicar). */

export function CalendarLegend({ items }: { items: { color: string; label: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-semibold"
      style={{ color: "var(--text-2)" }}>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
