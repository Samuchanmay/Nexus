"use client";
// ══════════════════════════════════════════════════════════════════
//  EMET · DateRangeFilter — único selector de fecha para TODO el sistema
//  ══════════════════════════════════════════════════════════════════
//  Regla del usuario (7 ago 2026): "Debe existir un único DateRangeFilter
//  reutilizable para todo el sistema" — Asistencia, Vacaciones,
//  Actividades, Eventos, Reportes, Personas, etc. NUNCA una
//  implementación de filtro de fecha por módulo.
//
//  9 presets rápidos + rango personalizado SIN límite artificial (mientras
//  haya datos en la base, se pueden consultar). El hook `useDateRangeFilter`
//  persiste la última selección en sessionStorage (por reporte/módulo, via
//  `storageKey`) — "conservar el último filtro utilizado durante la
//  sesión", no forzar reconfigurar cada vez que el usuario vuelve.
// ══════════════════════════════════════════════════════════════════
import { useState } from "react";
import { SegmentPill } from "@/components/os/ui";
import { DateRangeField } from "@/components/scheduling/date-picker";
import { buildPeriodLabel } from "@/lib/reports/xlsx-builder";
import { resolvePresetRange } from "@/lib/reports/date-presets";
import { DATE_PRESET_LABELS, DATE_PRESET_ORDER, type DateFilterValue, type DateRangePreset } from "@/lib/reports/types";

const STORAGE_PREFIX = "emet:report-filter:";

/** Maneja estado + persistencia de sesión — el componente de abajo es
 *  puro/controlado a propósito, para poder reusarlo sin sessionStorage si
 *  algún día hace falta (ej. dentro de un modal que no debe persistir). */
export function useDateRangeFilter(
  storageKey: string,
  defaultPreset: DateRangePreset = "este_mes",
): [DateFilterValue, (v: DateFilterValue) => void] {
  const fullKey = STORAGE_PREFIX + storageKey;

  const [value, setValue] = useState<DateFilterValue>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(fullKey);
        if (raw) return JSON.parse(raw) as DateFilterValue;
      } catch {
        // JSON corrupto o storage inaccesible — cae al default, no truena.
      }
    }
    return { preset: defaultPreset, range: resolvePresetRange(defaultPreset) };
  });

  const update = (v: DateFilterValue) => {
    setValue(v);
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(v));
    } catch {
      // Storage lleno o deshabilitado (modo privado) — el filtro sigue
      // funcionando en memoria, solo no persiste entre pantallas.
    }
  };

  return [value, update];
}

export function DateRangeFilter({
  value,
  onChange,
  minDate,
  className,
}: {
  value: DateFilterValue;
  onChange: (v: DateFilterValue) => void;
  /** Fecha mínima seleccionable en el rango personalizado — opcional. Por
      defecto NO hay límite: "mientras existan datos en la base, el usuario
      debe poder consultarlos" (requisito explícito del usuario). */
  minDate?: string;
  className?: string;
}) {
  const [customOpen, setCustomOpen] = useState(value.preset === "personalizado");

  const pickPreset = (preset: DateRangePreset) => {
    setCustomOpen(false);
    onChange({ preset, range: resolvePresetRange(preset) });
  };

  const pickCustomRange = (start: string | null, end: string | null) => {
    if (!start || !end) return;
    onChange({ preset: "personalizado", range: { from: start, to: end } });
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESET_ORDER.map((preset) => (
          <SegmentPill key={preset} active={value.preset === preset} onClick={() => pickPreset(preset)}>
            {DATE_PRESET_LABELS[preset]}
          </SegmentPill>
        ))}
        <SegmentPill active={value.preset === "personalizado"} onClick={() => setCustomOpen(true)}>
          {DATE_PRESET_LABELS.personalizado}
        </SegmentPill>
      </div>

      {customOpen && (
        <div className="mt-2 max-w-xs">
          <DateRangeField
            start={value.preset === "personalizado" ? value.range.from : null}
            end={value.preset === "personalizado" ? value.range.to : null}
            onSelect={pickCustomRange}
            minDate={minDate}
            placeholder="Desde — Hasta"
          />
        </div>
      )}

      <p className="mt-1.5 text-[12.5px] text-text-3">{buildPeriodLabel(value.range)}</p>
    </div>
  );
}
