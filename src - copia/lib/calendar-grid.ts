/**
 * lib/calendar-grid.ts — helpers compartidos para vistas de calendario
 * mensual (Lun–Dom) usadas en admin/calendario y admin/dias-inhabiles.
 */
import { addDays, isoWeekday } from "@/lib/tz";

export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthBounds(ym: string) {
  const [year, month] = ym.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth).padStart(2, "0")}`;
  return { year, month, daysInMonth, first, last };
}

/** Rejilla Lun–Dom que cubre el mes completo, incluyendo días de relleno de meses vecinos. */
export function buildMonthGrid(first: string, last: string, daysInMonth: number) {
  const firstDow = isoWeekday(first); // 0=dom..6=sáb
  const leadDays = firstDow === 0 ? 6 : firstDow - 1;
  const gridStart = addDays(first, -leadDays);
  const totalCells = Math.ceil((leadDays + daysInMonth) / 7) * 7;
  return Array.from({ length: totalCells }, (_, i) => {
    const date = addDays(gridStart, i);
    return { date, inMonth: date >= first && date <= last, day: Number(date.slice(8, 10)) };
  });
}
