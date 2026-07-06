// ══════════════════════════════════════════════════════════
//  NEXUS · Motor de horas — LA regla de negocio más crítica
//  · NO se miden retardos
//  · La comida CUENTA como tiempo laborado
//  · tiempo_total = salida − entrada (sin restar nada)
//  · Extra = excedente sobre el objetivo
//  · Tolerancia: 15 min
//  · Vacaciones/permisos/HO/inhábiles NUNCA generan falta
// ══════════════════════════════════════════════════════════
import type { AttendanceRow, Schedule } from "./types";
import { nowMeridaMinutes, isoWeekday } from "./tz";

export interface DaySummary {
  date: string;
  firstIn: string | null;      // primera Entrada
  lastOut: string | null;      // última Salida
  totalMin: number;            // salida − entrada (comida INCLUIDA)
  targetMin: number;
  extraMin: number;            // max(0, total − target)
  metTarget: boolean;          // con tolerancia
  isOpen: boolean;             // aún sin "Fin de jornada"
  movements: AttendanceRow[];
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const fmtMin = (min: number) => {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
};

export const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : "—");

/** Resume la jornada de un día. La comida cuenta: total = última salida − primera entrada. */
export function summarizeDay(
  date: string,
  rows: AttendanceRow[],
  schedule: Pick<Schedule, "target_min" | "tolerance_min">,
): DaySummary {
  const day = rows
    .filter((r) => r.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));

  const entradas = day.filter((r) => r.type === "Entrada");
  const salidas = day.filter((r) => r.type === "Salida");
  const firstIn = entradas[0]?.time ?? null;
  const finJornada = salidas.find((r) => r.reason === "Fin de jornada");
  const lastOut = finJornada?.time ?? salidas.at(-1)?.time ?? null;
  const isOpen = !finJornada;

  let totalMin = 0;
  if (firstIn && lastOut) totalMin = Math.max(0, toMin(lastOut) - toMin(firstIn));
  else if (firstIn && isOpen) {
    // jornada abierta: contar hasta ahora
    totalMin = Math.max(0, nowMeridaMinutes() - toMin(firstIn)); // B1: reloj de Mérida, no del server (UTC)
  }

  const { target_min, tolerance_min } = schedule;
  return {
    date,
    firstIn,
    lastOut: isOpen ? null : lastOut,
    totalMin,
    targetMin: target_min,
    extraMin: Math.max(0, totalMin - target_min),
    metTarget: totalMin >= target_min - tolerance_min,
    isOpen,
    movements: day,
  };
}

/** ¿Es día laborable? Excluye fin de semana y festivos. */
function isWorkday(isoDate: string, holidayDates: Set<string>): boolean {
  const dow = isoWeekday(isoDate); // B1: sin Date locales
  if (dow === 0 || dow === 6) return false;
  return !holidayDates.has(isoDate);
}

/** Días hábiles entre dos fechas (inclusive), excluyendo festivos. */
export function businessDaysBetween(start: string, end: string, holidayDates: Set<string>): number {
  let count = 0;
  const d = new Date(start + "T12:00:00Z"); // mediodía UTC: inmune a saltos de zona
  const e = new Date(end + "T12:00:00Z");
  while (d <= e) {
    if (isWorkday(d.toISOString().slice(0, 10), holidayDates)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

/** El siguiente motivo de fichaje lógico según los movimientos del día. */
