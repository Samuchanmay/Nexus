"use client";
// ══════════════════════════════════════════════════════════
//  Mi jornada — métrica héroe con cronómetro en vivo.
//  El cronómetro NUNCA se detiene por haber pasado el objetivo: eso
//  solo cambia la barra/subtítulo como referencia visual (corrección
//  de lógica de jornada pedida por Samu). El total se recalcula en el
//  cliente cada pocos segundos a partir del total que YA calculó el
//  servidor al cargar la página + el tiempo real transcurrido desde
//  entonces — sin volver a pedir datos.
// ══════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { fmtMin, fmtTime } from "@/lib/hours";

export function LiveJornadaHero({
  firstIn, totalMin, targetMin, openSegmentStartsAt, statusLabel, dotColor,
  showEntrada = true, barClassName = "",
}: {
  firstIn: string | null;
  totalMin: number;
  targetMin: number;
  /** No-null ⇒ el tramo actual sigue contando en vivo (jornada abierta, hoy, estado que cuenta). */
  openSegmentStartsAt: string | null;
  statusLabel: string;
  dotColor: string;
  showEntrada?: boolean;
  /** Clases extra para el contenedor de la barra (p.ej. "mb-4" cuando hay botones debajo). */
  barClassName?: string;
}) {
  const [liveMin, setLiveMin] = useState(totalMin);

  useEffect(() => {
    setLiveMin(totalMin);
    if (!openSegmentStartsAt) return;
    const mountedAt = Date.now();
    const tick = () => setLiveMin(totalMin + Math.floor((Date.now() - mountedAt) / 60000));
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [totalMin, openSegmentStartsAt]);

  const pct = targetMin > 0 ? Math.min(100, Math.round((liveMin / targetMin) * 100)) : 0;
  const overMin = liveMin - targetMin;
  const barColor = pct < 100 ? "var(--accent)" : overMin <= 60 ? "var(--ok)" : overMin <= 180 ? "var(--warn)" : "var(--danger)";
  const liveExtraMin = Math.max(0, overMin);

  return (
    <>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} /> Mi jornada · {statusLabel}
        </span>
        {liveExtraMin > 0 && (
          <span className="text-[11.5px] font-bold tabular-nums" style={{ color: "var(--ok)" }}>+{fmtMin(liveExtraMin)} extra</span>
        )}
      </div>
      <p className="text-[42px] font-bold tabular-nums leading-none text-text-1 mb-1.5">
        {firstIn ? fmtMin(liveMin) : "—"}
      </p>
      <p className="text-[12.5px] mb-3" style={{ color: "var(--text-3)" }}>
        {firstIn
          ? overMin > 0
            ? `Objetivo alcanzado hace ${fmtMin(overMin)}${showEntrada ? ` · Entrada ${fmtTime(firstIn)}` : ""}`
            : `${pct}% de la jornada · Objetivo ${fmtMin(targetMin)}${showEntrada ? ` · Entrada ${fmtTime(firstIn)}` : ""}`
          : `Objetivo ${fmtMin(targetMin)}`}
      </p>
      <div className={`h-1.5 rounded-full bg-surface-3 overflow-hidden ${barClassName}`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </>
  );
}
