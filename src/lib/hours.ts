// ══════════════════════════════════════════════════════════
//  NEXUS · Motor de horas — LA regla de negocio más crítica
//  · NO se miden retardos
//  · tiempo_total = suma de los tramos del día cuyo ESTADO cuenta
//    como tiempo trabajado (jornada_states.cuenta_tiempo,
//    configurable desde Configuración → Estados de Jornada)
//  · Por defecto "Trabajando" cuenta; "Comida", "Diligencia",
//    "Consulta médica", "Permiso temporal" y "Pendientes" NO cuentan
//    a menos que se edite su estado.
//  · Extra = excedente sobre el objetivo
//  · Tolerancia: 15 min
//  · Vacaciones/permisos/HO/inhábiles NUNCA generan falta
// ══════════════════════════════════════════════════════════
import type { AttendanceRow, Schedule } from "./types";
import { nowMeridaMinutes, isoWeekday, todayMerida } from "./tz";

export interface DaySummary {
  date: string;
  firstIn: string | null;      // primera Entrada
  lastOut: string | null;      // última Salida
  totalMin: number;            // suma de tramos que cuentan como trabajado, HASTA AHORA si sigue abierta
  targetMin: number;
  extraMin: number;            // max(0, total − target)
  metTarget: boolean;          // con tolerancia
  isOpen: boolean;             // aún sin "Fin de jornada"
  /**
   * SOLO tiene sentido para días PASADOS (date !== hoy): entrada registrada,
   * nunca hubo salida, y el día ya terminó por completo. NUNCA es true para
   * el día de hoy — mientras sea hoy la jornada está simplemente "En curso",
   * sin importar cuántas horas lleve. Un día pasado en este estado NO se
   * etiqueta directamente como "No registró salida": queda "Pendiente de
   * confirmar salida" hasta que la persona indique la hora real o RH/Admin
   * confirme que de verdad no hay forma de recuperarla (tabla
   * `pending_exits`, ver lib/pending-exits.ts).
   */
  noRegistroSalida: boolean;
  /**
   * Hora (HH:MM:SS) en la que empezó el tramo ABIERTO actual — el que
   * sigue sumando en vivo — o null si la jornada está cerrada, si nunca
   * inició, o si el estado vigente no cuenta como tiempo trabajado (p.ej.
   * "Comida"). El cronómetro del cliente usa esto + totalMinBeforeOpenSegment
   * para seguir contando en tiempo real sin volver a pedir datos al server.
   */
  openSegmentStartsAt: string | null;
  /** totalMin SIN el tramo abierto actual — la base sobre la que el cliente suma en vivo. */
  totalMinBeforeOpenSegment: number;
  movements: AttendanceRow[];
}

export interface JornadaState {
  id?: string;
  nombre: string;
  cuenta_tiempo: boolean;
  pausa_actividad: boolean;
  requiere_motivo: boolean;
  color: string;
  orden: number;
  activo: boolean;
}

/** Nombre del estado "en jornada normal" — siempre existe, no depende de la BD. */
export const TRABAJANDO = "Trabajando";

/**
 * Los motivos del check-in (fichar) están fijos: coinciden con el checador
 * oficial y se validan también en la Edge Function `fichar`. Lo que SÍ es
 * configurable es el COMPORTAMIENTO de cada estado (tabla jornada_states,
 * editable en Configuración → Estados de Jornada): si cuenta como tiempo
 * trabajado y si pausa la actividad en curso.
 */
export const SALIDA_REASON_TO_STATE: Record<string, string> = {
  "Salida a comer": "Comida",
  "Salida a diligencia": "Diligencia",
  "Salida a cita médica": "Consulta médica",
  "Salida a permiso": "Permiso temporal",
  "Salida a pendientes": "Pendientes",
};

/** Estado vigente justo DESPUÉS de este movimiento (hasta el siguiente). null = jornada cerrada. */
export function stateAfter(m: { type: string; reason: string }): string | null {
  if (m.type === "Entrada") return TRABAJANDO;
  if (m.reason === "Fin de jornada") return null;
  return SALIDA_REASON_TO_STATE[m.reason] ?? TRABAJANDO;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Elige, de entre TODOS los registros de `schedules` de una persona, el que
 * aplica en una fecha dada. Soporta horarios temporales (ej. cobertura de
 * vacaciones): un registro con valid_from/valid_until acotado gana sobre el
 * horario permanente (valid_until = null) si su rango cubre la fecha,
 * porque su valid_from es más reciente. Al pasar valid_until, el horario
 * temporal deja de aplicar solo y vuelve a regir el permanente.
 */
export function scheduleFor<T extends { user_id: string; valid_from: string; valid_until: string | null }>(
  scheds: T[], userId: string, date: string,
): T | undefined {
  const candidates = scheds.filter(
    (s) => s.user_id === userId && s.valid_from <= date && (!s.valid_until || s.valid_until >= date),
  );
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, s) => (s.valid_from > best.valid_from ? s : best));
}

export const fmtMin = (min: number) => {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
};

export const fmtTime = (t: string | null) => {
  if (!t) return "—";
  const [hStr, mStr] = t.slice(0, 5).split(":");
  let h = Number(hStr);
  const suffix = h >= 12 ? "p.m." : "a.m.";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
};

/**
 * Resume la jornada de un día, tramo por tramo. Cada tramo (entre un
 * movimiento y el siguiente) hereda el estado que abrió el tramo; solo
 * cuenta para el total si ese estado tiene cuenta_tiempo = true.
 * Si no se pasa el catálogo de estados, todo cuenta (comportamiento seguro
 * por defecto, igual al de antes).
 */
export function summarizeDay(
  date: string,
  rows: AttendanceRow[],
  schedule: Pick<Schedule, "target_min" | "tolerance_min" | "end_time">,
  states: JornadaState[] = [],
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

  const cuentaTiempo = new Map(states.map((s) => [s.nombre, s.cuenta_tiempo]));
  const countsAsWorked = (stateName: string) => cuentaTiempo.get(stateName) ?? true;

  // ── Estado vs. cronómetro: dos cosas completamente separadas ──
  // "noRegistroSalida" (a nivel de datos crudos) SOLO describe un día
  // PASADO que quedó abierto — nunca el día de hoy. Mientras sea hoy, no
  // importa cuántas horas lleve la persona ni si ya pasó su horario: sigue
  // "En curso", punto. El corte real entre "pendiente de confirmar" y
  // "no registró salida" (definitivo) vive en la tabla `pending_exits`,
  // fuera de esta función pura.
  const isToday = date === todayMerida();
  const noRegistroSalida = isOpen && !!firstIn && !isToday;

  let totalMin = 0;
  let totalMinBeforeOpenSegment = 0;
  let openSegmentStartsAt: string | null = null;
  if (firstIn) {
    const nowMin = nowMeridaMinutes();
    // El cronómetro NUNCA se detiene solo porque ya pasó la hora objetivo —
    // eso es nada más una referencia visual (barra/alerta), no una razón
    // para congelar el tiempo. El único caso en que NO extendemos el tramo
    // abierto hasta "ahora" es cuando la fecha ya no es hoy: ahí "ahora" no
    // representa nada real y ese tramo pasa a resolverse vía pending_exits.
    const extendOpenSegmentToNow = isOpen && isToday;
    for (let i = 0; i < day.length; i++) {
      const m = day[i];
      if (toMin(m.time) < toMin(firstIn)) continue; // defensivo
      const state = stateAfter(m);
      if (state === null) break; // "Fin de jornada": ya no hay más tramos
      const next = day[i + 1];
      const segStart = toMin(m.time);
      const isOpenSegment = !next;
      const segEnd = next ? toMin(next.time) : (extendOpenSegmentToNow ? nowMin : segStart);
      const segMin = Math.max(0, segEnd - segStart);
      if (countsAsWorked(state)) {
        totalMin += segMin;
        // El tramo abierto (el último, sin "next") es el que el cliente
        // sigue sumando en vivo — solo si de verdad cuenta como trabajado
        // (p.ej. no durante "Comida", ahí el cronómetro se ve pausado con
        // toda intención, como pidió Samu).
        if (isOpenSegment && extendOpenSegmentToNow) {
          openSegmentStartsAt = m.time;
        } else {
          totalMinBeforeOpenSegment += segMin;
        }
      }
    }
  }

  const { target_min, tolerance_min } = schedule;
  return {
    date,
    firstIn,
    lastOut: isOpen ? null : lastOut,
    totalMin,
    noRegistroSalida,
    openSegmentStartsAt,
    totalMinBeforeOpenSegment,
    targetMin: target_min,
    extraMin: Math.max(0, totalMin - target_min),
    metTarget: totalMin >= target_min - tolerance_min,
    isOpen,
    movements: day,
  };
}

/**
 * Estado actual de la persona "ahora" (para pintar su pill de presencia en
 * vivo): nombre del estado, color y si cuenta como tiempo trabajado.
 * Devuelve null si no ha fichado entrada hoy.
 */
export function currentState(
  rows: AttendanceRow[],
  date: string,
  states: JornadaState[] = [],
): { nombre: string; color: string; cuenta_tiempo: boolean } | null {
  const day = rows.filter((r) => r.date === date).sort((a, b) => a.time.localeCompare(b.time));
  if (!day.some((r) => r.type === "Entrada")) return null;
  const last = day.at(-1)!;
  const stateName = stateAfter(last);
  if (stateName === null) return null; // ya terminó su jornada
  const found = states.find((s) => s.nombre === stateName);
  return {
    nombre: stateName,
    color: found?.color ?? (stateName === TRABAJANDO ? "#3ECF8E" : "#8E8E93"),
    cuenta_tiempo: found?.cuenta_tiempo ?? true,
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
