/**
 * lib/tz.ts — Fuente única de verdad para fecha/hora en zona America/Merida.
 *
 * Fix B1 (AUDIT.md): NUNCA usar new Date().toISOString().slice(0,10) para "hoy":
 * toISOString() es UTC y en Mérida (UTC−6/−5) el sistema cambiaría de día ~18:00.
 *
 * Todas las pantallas y cálculos deben pasar por estos helpers.
 */

export const TZ = "America/Merida";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Fecha de HOY en Mérida como "YYYY-MM-DD" (en-CA produce ISO). */
export function todayMerida(d: Date = new Date()): string {
  return dateFmt.format(d);
}

/** Hora actual en Mérida como "HH:MM:SS". */
export function nowMeridaTime(d: Date = new Date()): string {
  return timeFmt.format(d);
}

/** Minutos transcurridos del día en Mérida (para cálculos de jornada en vivo). */
export function nowMeridaMinutes(d: Date = new Date()): number {
  const [h, m] = timeFmt.format(d).split(":").map(Number);
  return h * 60 + m;
}

/** Convierte un Date a "YYYY-MM-DD" en Mérida (no en UTC). */
export function toMeridaDate(d: Date): string {
  return dateFmt.format(d);
}

/** "YYYY-MM-DD" ± n días, operando en mediodía UTC para evitar saltos de zona. */
export function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Primer día del mes de una fecha ISO. */
export function monthStart(isoDate: string): string {
  return isoDate.slice(0, 8) + "01";
}

/** Día de la semana (0=domingo…6=sábado) de una fecha ISO, sin efectos de zona. */
export function isoWeekday(isoDate: string): number {
  return new Date(isoDate + "T12:00:00Z").getUTCDay();
}
