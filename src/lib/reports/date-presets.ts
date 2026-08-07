// ══════════════════════════════════════════════════════════════════
//  EMET · Reportes — resolución de presets de fecha
//  ══════════════════════════════════════════════════════════════════
//  Funciones puras: dado un preset + "hoy" (Mérida), devuelven {from,to}
//  ISO inclusivo. Nunca usan Date.toISOString() directo para "hoy" (ver
//  lib/tz.ts) — todo el cálculo de calendario pasa por tz.ts/calendar-core.
// ══════════════════════════════════════════════════════════════════
import { addDays, todayMerida } from "@/lib/tz";
import { weekRangeFor } from "@/lib/calendar-core";
import type { DateRange, DateRangePreset } from "./types";

/** Último día del mes que contiene `iso` ("YYYY-MM-DD"). */
function monthEnd(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // día 0 del mes siguiente = último del actual
  return `${iso.slice(0, 8)}${String(last).padStart(2, "0")}`;
}

/** Primer día del mes de `iso`. */
function monthStartOf(iso: string): string {
  return `${iso.slice(0, 8)}01`;
}

/** {from,to} de la quincena (1–15 o 16–fin de mes) que contiene `iso`. */
function quincenaOf(iso: string): DateRange {
  const day = Number(iso.slice(8, 10));
  if (day <= 15) return { from: monthStartOf(iso), to: `${iso.slice(0, 8)}15` };
  return { from: `${iso.slice(0, 8)}16`, to: monthEnd(iso) };
}

/** Quincena anterior a la que contiene `iso` — cruza de mes si hace falta. */
function quincenaAnteriorDe(iso: string): DateRange {
  const day = Number(iso.slice(8, 10));
  if (day <= 15) {
    // La quincena pasada es la 16–fin del mes anterior.
    const prevMonthAnyDay = addDays(monthStartOf(iso), -1); // último día del mes anterior
    return { from: `${prevMonthAnyDay.slice(0, 8)}16`, to: prevMonthAnyDay };
  }
  return { from: monthStartOf(iso), to: `${iso.slice(0, 8)}15` };
}

/** Resuelve un preset (excepto "personalizado", que no tiene rango propio
 *  — el rango lo trae el usuario) a un {from,to} ISO concreto. */
export function resolvePresetRange(preset: DateRangePreset, todayIso: string = todayMerida()): DateRange {
  switch (preset) {
    case "hoy":
      return { from: todayIso, to: todayIso };
    case "ayer": {
      const y = addDays(todayIso, -1);
      return { from: y, to: y };
    }
    case "esta_semana": {
      const { start, end } = weekRangeFor(todayIso);
      return { from: start, to: end };
    }
    case "semana_pasada": {
      const { start } = weekRangeFor(todayIso);
      const prevStart = addDays(start, -7);
      return { from: prevStart, to: addDays(prevStart, 6) };
    }
    case "esta_quincena":
      return quincenaOf(todayIso);
    case "quincena_pasada":
      return quincenaAnteriorDe(todayIso);
    case "este_mes":
      return { from: monthStartOf(todayIso), to: monthEnd(todayIso) };
    case "mes_pasado": {
      const lastDayPrevMonth = addDays(monthStartOf(todayIso), -1);
      return { from: monthStartOf(lastDayPrevMonth), to: lastDayPrevMonth };
    }
    case "este_anio":
      return { from: `${todayIso.slice(0, 4)}-01-01`, to: `${todayIso.slice(0, 4)}-12-31` };
    case "personalizado":
      // Sin rango propio — el caller debe traer uno ya elegido por el usuario.
      return { from: todayIso, to: todayIso };
  }
}
