/**
 * lib/calendar-core.ts — helpers de fechas del Calendar Engine.
 * Todo aritmético hereda de lib/tz.ts (zona America/Merida, jamás UTC).
 * Centraliza las funciones que antes estaban duplicadas en los clients de
 * admin/calendario y comunicacion/calendario (mondayIndex, dayLongLabel,
 * weekRangeLabel, MONTHS_SHORT, DOW_LONG).
 */
import { addDays, isoWeekday } from "@/lib/tz";

export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DOW_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Lun=0..Dom=6, para indexar en DOW/DOW_LONG que ya empiezan en lunes. */
export function mondayIndex(iso: string): number {
  return (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
}

/** "Viernes 31 de julio 2026" a partir de una fecha ISO. */
export function dayLongLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = DOW_LONG[new Date(`${iso}T12:00:00`).getDay()];
  return `${dow.charAt(0).toUpperCase()}${dow.slice(1)} ${d} de ${MONTHS[m - 1]} ${y}`;
}

/** Rango de una semana (Lun–Dom) como etiqueta: "27–31 jul 2026" o "27 jul – 2 ago 2026". */
export function weekRangeLabel(cells: { date: string }[]): string {
  if (!cells.length) return "";
  const a = cells[0].date, b = cells[cells.length - 1].date;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  if (am === bm && ay === by) return `${ad}–${bd} ${MONTHS_SHORT[am - 1]} ${ay}`;
  return `${ad} ${MONTHS_SHORT[am - 1]} – ${bd} ${MONTHS_SHORT[bm - 1]} ${by}`;
}

/** "Julio 2026" a partir de un ym "YYYY-MM". */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** Lunes de la semana (Lun–Dom) que contiene `iso`. */
export function weekStartOf(iso: string): string {
  const diff = (isoWeekday(iso) + 6) % 7; // isoWeekday: 0=dom..6=sáb
  return addDays(iso, -diff);
}

/** {start, end} de la semana (Lun–Dom) que contiene `iso`. */
export function weekRangeFor(iso: string): { start: string; end: string } {
  const start = weekStartOf(iso);
  return { start, end: addDays(start, 6) };
}

/** Array de fechas ISO entre start y end, inclusivo. */
export function daysInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  let guard = 0;
  while (d <= end && guard < 400) {
    out.push(d);
    d = addDays(d, 1);
    guard++;
  }
  return out;
}

/** Suma n meses a una fecha ISO "YYYY-MM-DD" sin corrimientos de zona. */
export function addMonthsISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1 + n, 1));
  const y2 = dt.getUTCFullYear();
  const m2 = dt.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y2, m2, 0)).getUTCDate();
  const d2 = Math.min(d ?? 1, lastDay);
  return `${y2}-${String(m2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;
}

/** Primer y último día de un año. */
export function yearRange(year: number): { first: string; last: string } {
  return { first: `${year}-01-01`, last: `${year}-12-31` };
}

/* ── Fase B — vistas Día/Semana (EMET-CALENDAR-ENGINE.md §5.2, §5.5) ──
   Overlap y línea de "ahora". La curva exponencial de anchos de cal.diy
   (groupSize/(groupSize+1), exponent 1.3) no se portó literal: sin build/
   tsc en este entorno para verificar el resultado visual, se simplificó a
   columnas de ancho igual (mismo patrón que Google Calendar/Outlook) —
   correcto y predecible, aunque menos elaborado que el original. */

/** Minutos desde medianoche de la parte de hora de un ISO "YYYY-MM-DDTHH:mm". */
export function minutesOfDay(iso: string): number {
  const t = iso.slice(11, 16); // "HH:mm"
  if (!t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export interface OverlapLayout { left: number; width: number; zIndex: number }

/**
 * Asigna columna/ancho a eventos con hora que se solapan en un mismo día.
 * Algoritmo de barrido: agrupa por solapamiento transitivo, luego asigna
 * cada evento a la primera columna libre (greedy, orden por inicio). El
 * ancho de columna es 100/columnas del grupo (mínimo 25%).
 */
export function layoutDayOverlaps(
  events: { id: string; startMin: number; endMin: number }[]
): Map<string, OverlapLayout> {
  const out = new Map<string, OverlapLayout>();
  if (events.length === 0) return out;
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  let cluster: typeof sorted = [];
  let clusterMaxEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const colEnds: number[] = []; // fin actual de cada columna
    const colOf = new Map<string, number>();
    for (const ev of cluster) {
      let col = colEnds.findIndex((end) => end <= ev.startMin);
      if (col === -1) { col = colEnds.length; colEnds.push(ev.endMin); }
      else colEnds[col] = ev.endMin;
      colOf.set(ev.id, col);
    }
    const columns = Math.max(1, colEnds.length);
    const width = Math.max(25, 100 / columns);
    for (const ev of cluster) {
      const col = colOf.get(ev.id) ?? 0;
      out.set(ev.id, { left: col * width, width, zIndex: 60 + col });
    }
    cluster = [];
    clusterMaxEnd = -Infinity;
  };

  for (const ev of sorted) {
    if (cluster.length > 0 && ev.startMin >= clusterMaxEnd) flush();
    cluster.push(ev);
    clusterMaxEnd = Math.max(clusterMaxEnd, ev.endMin);
  }
  flush();
  return out;
}

/** Altura de una hora en la rejilla de Día/Semana (constante `hourSize` de cal.diy). */
export const HOUR_HEIGHT_PX = 58;

/** Offset en px de la línea de "ahora" dentro del rango startHour–endHour, o null si está fuera de rango. */
export function nowLineOffsetPx(nowMinutes: number, startHour: number, endHour: number): number | null {
  const rangeStart = startHour * 60;
  const rangeEnd = endHour * 60;
  if (nowMinutes < rangeStart || nowMinutes > rangeEnd) return null;
  return ((nowMinutes - rangeStart) / 60) * HOUR_HEIGHT_PX;
}
