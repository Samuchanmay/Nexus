"use client";
import { useCalendarEngine } from "./engine";

/* ── Calendar Engine · filtros de capas (EMET-CALENDAR-ENGINE.md §15) ──
   Un chip por capa/fuente, con su color. Toggle individual + "Todos"/
   "Ninguno" para reset rápido. Al ocultar una capa, sus eventos desaparecen
   del calendario Y de la leyenda al mismo tiempo (ya lo resuelve el motor
   vía `visibleEvents`; este componente solo pinta el estado). */

export function CalendarFilterBar() {
  const { layers, toggleLayer, setAllLayers } = useCalendarEngine();
  if (layers.length === 0) return null;

  const allActive = layers.every((l) => l.active);
  const noneActive = layers.every((l) => !l.active);

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4" role="group" aria-label="Filtrar capas del calendario">
      {layers.map((l) => (
        <button
          key={l.key}
          type="button"
          onClick={() => toggleLayer(l.key)}
          aria-pressed={l.active}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
          style={{
            background: l.active ? `color-mix(in srgb, ${l.color} 14%, transparent)` : "var(--surface-2)",
            color: l.active ? l.color : "var(--text-3)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: l.active ? l.color : "var(--text-3)" }} />
          {l.label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px" style={{ background: "var(--border)" }} aria-hidden />
      <button type="button" onClick={() => setAllLayers(true)} disabled={allActive}
        className="text-[12px] font-semibold px-2 py-1 rounded-full transition-colors hover:bg-hover disabled:opacity-40"
        style={{ color: "var(--text-2)" }}>
        Todos
      </button>
      <button type="button" onClick={() => setAllLayers(false)} disabled={noneActive}
        className="text-[12px] font-semibold px-2 py-1 rounded-full transition-colors hover:bg-hover disabled:opacity-40"
        style={{ color: "var(--text-2)" }}>
        Ninguno
      </button>
    </div>
  );
}
