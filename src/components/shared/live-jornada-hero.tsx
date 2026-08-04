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
  
  // Calcular tiempo restante y salida estimada
  const remainingMin = Math.max(0, targetMin - liveMin);
  const estimatedExit = firstIn && remainingMin > 0 
    ? (() => {
        const [h, m] = firstIn.split(":").map(Number);
        const totalMinutes = h * 60 + m + targetMin;
        const exitH = Math.floor(totalMinutes / 60) % 24;
        const exitM = totalMinutes % 60;
        return `${String(exitH).padStart(2, "0")}:${String(exitM).padStart(2, "0")}`;
      })()
    : null;

  return (
    <>
      {/* Status indicator */}
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
          <span className="relative flex h-2 w-2">
            {statusLabel === "Trabajando" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: dotColor }}></span>
            )}
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: dotColor }}></span>
          </span>
          {statusLabel}
        </span>
        {liveExtraMin > 0 && (
          <span className="text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-full" style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>
            +{fmtMin(liveExtraMin)} extra
          </span>
        )}
      </div>
      
      {/* Métrica protagonista */}
      <p className="text-[56px] font-bold tabular-nums leading-none text-text-1 mb-2">
        {firstIn ? fmtMin(liveMin) : "—"}
      </p>
      
      {/* Contexto adicional */}
      <div className="flex items-center gap-4 mb-4 text-[13px]">
        {firstIn && (
          <>
            <span style={{ color: "var(--text-3)" }}>
              {pct}% del objetivo
            </span>
            {showEntrada && (
              <>
                <span style={{ color: "var(--border)" }}>·</span>
                <span style={{ color: "var(--text-3)" }}>
                  Entrada {fmtTime(firstIn)}
                </span>
              </>
            )}
          </>
        )}
        {!firstIn && (
          <span style={{ color: "var(--text-3)" }}>
            Objetivo {fmtMin(targetMin)}
          </span>
        )}
      </div>
      
      {/* Barra de progreso con referencias */}
      <div className={`relative ${barClassName}`}>
        <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500" 
            style={{ width: `${pct}%`, background: barColor }} 
          />
        </div>
        {/* Marcas de referencia */}
        {firstIn && targetMin > 0 && (
          <div className="flex justify-between mt-1.5 text-[11px]" style={{ color: "var(--text-3)" }}>
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>Meta</span>
          </div>
        )}
      </div>
      
      {/* Información adicional en tarjetas compactas */}
      {firstIn && (
        <div className="grid grid-cols-2 gap-3 mt-5">
          {remainingMin > 0 ? (
            <>
              <div className="p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-3)" }}>
                  Tiempo restante
                </p>
                <p className="text-[18px] font-bold tabular-nums text-text-1">
                  {fmtMin(remainingMin)}
                </p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-3)" }}>
                  Salida estimada
                </p>
                <p className="text-[18px] font-bold tabular-nums text-text-1">
                  {estimatedExit ? fmtTime(estimatedExit) : "—"}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl" style={{ background: "var(--ok-tint)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ok)" }}>
                  Objetivo alcanzado
                </p>
                <p className="text-[18px] font-bold tabular-nums" style={{ color: "var(--ok)" }}>
                  {overMin > 0 ? `+${fmtMin(overMin)}` : "✓"}
                </p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-3)" }}>
                  Total trabajado
                </p>
                <p className="text-[18px] font-bold tabular-nums text-text-1">
                  {fmtMin(liveMin)}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
