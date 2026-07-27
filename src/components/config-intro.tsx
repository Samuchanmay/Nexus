"use client";
import { Icon } from "@/components/os/icons";

/**
 * SectionIntro — encabezado ligero para cada sub-pantalla de Configuración
 * (Plano Maestro FASE E, punto §315). Se muestra tanto en el hub tipo
 * Ajustes ( /admin/config ) como en las rutas independientes de cada
 * sección, arriba del contenido y debajo del PageHeader compacto.
 *
 * Tres partes, siempre con datos reales (no se inventa un log de
 * auditoría que no existe en el esquema):
 *   1. `stats`   — resumen numérico calculado en vivo a partir de los
 *                  props que ya recibe cada Client Component (conteos,
 *                  no una tabla nueva).
 *   2. `recent`  — el dato más reciente que YA vive en las columnas de
 *                  la propia sección (ej. último dispositivo visto,
 *                  último horario temporal creado) — no un audit log.
 *   3. `tip`     — consejo contextual fijo de Emu para esa pantalla.
 */
export function SectionIntro({ stats, recent, tip }: {
  stats: { label: string; value: React.ReactNode; tone?: "default" | "ok" | "warn" | "danger" | "accent" }[];
  recent?: string;
  tip: string;
}) {
  const toneColor = (t?: string) =>
    t === "ok" ? "var(--ok)" : t === "warn" ? "var(--warn)" : t === "danger" ? "var(--danger)"
    : t === "accent" ? "var(--accent)" : "var(--text-1)";

  return (
    <div className="card p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex flex-wrap gap-x-6 gap-y-3 flex-1 min-w-0">
        {stats.map((s, i) => (
          <div key={i} className="min-w-[64px]">
            <p className="text-[19px] font-bold tabular-nums leading-none" style={{ color: toneColor(s.tone) }}>{s.value}</p>
            <p className="text-[10.5px] font-semibold mt-1" style={{ color: "var(--text-3)" }}>{s.label}</p>
          </div>
        ))}
        {recent && (
          <div className="min-w-0 flex-1 basis-[180px]">
            <p className="text-[12px] font-semibold truncate leading-none mt-0.5" style={{ color: "var(--text-2)" }}>{recent}</p>
            <p className="text-[10.5px] font-semibold mt-1.5" style={{ color: "var(--text-3)" }}>Lo más reciente</p>
          </div>
        )}
      </div>
      <div className="flex items-start gap-2 sm:max-w-[300px] shrink-0">
        <span className="hidden sm:block w-px self-stretch shrink-0" style={{ background: "var(--border-2)" }} />
        <span className="w-6 h-6 rounded-full grid place-items-center shrink-0" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
          <Icon name="sparkle" size={13} />
        </span>
        <p className="text-[12px] leading-snug" style={{ color: "var(--text-2)" }}>
          <strong style={{ color: "var(--text-1)" }}>Emu: </strong>{tip}
        </p>
      </div>
    </div>
  );
}
