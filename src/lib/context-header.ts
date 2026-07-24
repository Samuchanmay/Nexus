// ═══════════════════════════════════════════════════════════════
//  Context Header — motor de saludo/subtítulo dinámico del Dashboard.
//  No es una lista de mensajes al azar: es un motor de prioridades.
//  hora + rol + estado + prioridad = mensaje final.
//
//  Reglas de diseño (ver conversación con Samu):
//  · Cumpleaños > vacaciones > regreso > próximas vacaciones >
//    incidencias/eventos > estado del equipo > estado personal >
//    día de la semana > casual — nunca se elige un mensaje de menor
//    prioridad si uno de mayor prioridad aplica.
//  · Nunca repetir el mismo saludo/subtítulo dos veces seguidas si
//    existe otra opción aplicable (lo resuelve el componente cliente
//    vía localStorage, pasando `avoid` a buildContextMessage).
//  · Tono profesional/premium — nunca infantil ni exagerado.
// ═══════════════════════════════════════════════════════════════

export type ContextRole = "admin" | "empleado";

export interface ContextHeaderInput {
  role: ContextRole;
  name: string;
  hour: number; // 0-23, hora local Mérida
  dow: number;  // 0=domingo … 6=sábado
  isBirthdayToday: boolean;
  /** Estado de vacaciones — Nexus solo administra vacaciones de admin/empleado. */
  vacation: { today: boolean; soonDays: number | null; returnedRecently: boolean };
  /** Pendientes relevantes para el rol (solicitudes+vacaciones+incidencias en
      admin; tareas propias en empleado). */
  pendingCount: number;
  /** true si todo el equipo ya registró entrada (solo tiene sentido en admin). */
  teamAllIn: boolean | null;
  /** Nombres de OTRAS personas (no el usuario) que cumplen años hoy. */
  othersBirthdayToday: string[];
  /** No quedan pendientes ni alertas — día "bajo control". */
  allDone: boolean;
  isHoliday: boolean;
}

export interface ContextMessage {
  dateLabel: string;
  greetingKey: string;
  greetingEmoji: string;
  greetingText: string;
  subtitleKey: string;
  subtitleEmoji: string;
  subtitleText: string;
}

type Entry = { key: string; emoji: string; text: string };

const pick = (name: string, list: Entry[], avoidKey?: string): Entry => {
  const pool = list.length > 1 && avoidKey ? list.filter((e) => e.key !== avoidKey) : list;
  const chosen = pool[Math.floor(Math.random() * pool.length)] ?? list[0];
  return { ...chosen, text: chosen.text.replace(/\{name\}/g, name) };
};

/* ── Nivel 1: saludo por hora del día (24 variantes, 6 por franja) ── */
const GREETING_MANANA: Entry[] = [
  { key: "g-manana-1", emoji: "👋", text: "Buenos días, {name}" },
  { key: "g-manana-2", emoji: "👋", text: "Qué gusto verte, {name}" },
  { key: "g-manana-3", emoji: "☀️", text: "Listo para comenzar, {name}" },
  { key: "g-manana-4", emoji: "☕", text: "Hora del primer café, {name}" },
  { key: "g-manana-5", emoji: "🌤️", text: "Hoy pinta para un buen día, {name}" },
  { key: "g-manana-6", emoji: "✨", text: "Comencemos, {name}" },
  { key: "g-manana-7", emoji: "🌅", text: "Arrancamos el día, {name}" },
];
const GREETING_MEDIODIA: Entry[] = [
  { key: "g-mediodia-1", emoji: "✌️", text: "Hola, {name}" },
  { key: "g-mediodia-2", emoji: "😄", text: "¿Cómo va el día, {name}?" },
  { key: "g-mediodia-3", emoji: "💪", text: "Ya llevas buena parte del camino, {name}" },
  { key: "g-mediodia-4", emoji: "🍽️", text: "No olvides tomar un descanso, {name}" },
  { key: "g-mediodia-5", emoji: "☀️", text: "A media jornada, {name}" },
  { key: "g-mediodia-6", emoji: "🌤️", text: "Buen momento para una pausa, {name}" },
];
const GREETING_TARDE: Entry[] = [
  { key: "g-tarde-1", emoji: "✌️", text: "Buenas tardes, {name}" },
  { key: "g-tarde-2", emoji: "😎", text: "Ya casi termina la jornada, {name}" },
  { key: "g-tarde-3", emoji: "🔥", text: "Un último esfuerzo, {name}" },
  { key: "g-tarde-4", emoji: "📋", text: "Cerrando pendientes, {name}" },
  { key: "g-tarde-5", emoji: "🌇", text: "Recta final del día, {name}" },
  { key: "g-tarde-6", emoji: "💼", text: "La tarde avanza bien, {name}" },
];
const GREETING_NOCHE: Entry[] = [
  { key: "g-noche-1", emoji: "🌙", text: "Buenas noches, {name}" },
  { key: "g-noche-2", emoji: "⭐", text: "Buen trabajo hoy, {name}" },
  { key: "g-noche-3", emoji: "😴", text: "Hora de descansar, {name}" },
  { key: "g-noche-4", emoji: "🌙", text: "Cerrando el día, {name}" },
  { key: "g-noche-5", emoji: "✨", text: "Casi termina el día, {name}" },
];

/* ── Nivel 2: estado del usuario — tiene prioridad sobre la hora ── */
const GREETING_BIRTHDAY: Entry[] = [
  { key: "g-birthday-1", emoji: "🥳", text: "¡Feliz cumpleaños, {name}!" },
  { key: "g-birthday-2", emoji: "🎂", text: "Hoy es tu día, {name}" },
];
const GREETING_VACATION_TODAY: Entry[] = [
  { key: "g-vac-today-1", emoji: "🏖️", text: "Disfruta tus vacaciones, {name}" },
  { key: "g-vac-today-2", emoji: "😎", text: "Hoy no hay pendientes, {name}" },
  { key: "g-vac-today-3", emoji: "🌴", text: "A descansar, {name}" },
];
const GREETING_VACATION_SOON: Entry[] = [
  { key: "g-vac-soon-1", emoji: "🌴", text: "Hola, {name}" },
  { key: "g-vac-soon-2", emoji: "😎", text: "La cuenta regresiva ya empezó, {name}" },
  { key: "g-vac-soon-3", emoji: "✈️", text: "Ve preparando la maleta, {name}" },
];
const GREETING_VACATION_RETURN: Entry[] = [
  { key: "g-vac-return-1", emoji: "👋", text: "Bienvenido de nuevo, {name}" },
  { key: "g-vac-return-2", emoji: "👋", text: "Qué bueno tenerte de vuelta, {name}" },
];
const GREETING_MONDAY: Entry[] = [
  { key: "g-monday-1", emoji: "💪", text: "Nueva semana, {name}" },
  { key: "g-monday-2", emoji: "🚀", text: "Arrancamos la semana, {name}" },
  { key: "g-monday-3", emoji: "👋", text: "Buen inicio de semana, {name}" },
];
const GREETING_FRIDAY: Entry[] = [
  { key: "g-friday-1", emoji: "🎉", text: "Llegamos al viernes, {name}" },
  { key: "g-friday-2", emoji: "😌", text: "Ya casi es fin de semana, {name}" },
  { key: "g-friday-3", emoji: "✌️", text: "Último día de la semana, {name}" },
];

function greetingTier(hour: number): Entry[] {
  if (hour < 12) return GREETING_MANANA;
  if (hour < 15) return GREETING_MEDIODIA;
  if (hour < 19) return GREETING_TARDE;
  return GREETING_NOCHE;
}

function resolveGreeting(input: ContextHeaderInput, avoidKey?: string): Entry {
  const { name } = input;
  if (input.isBirthdayToday) return pick(name, GREETING_BIRTHDAY, avoidKey);
  if (input.vacation.today) return pick(name, GREETING_VACATION_TODAY, avoidKey);
  if (input.vacation.returnedRecently) return pick(name, GREETING_VACATION_RETURN, avoidKey);
  if (input.vacation.soonDays != null && input.vacation.soonDays <= 3) return pick(name, GREETING_VACATION_SOON, avoidKey);
  if (input.dow === 1 && input.hour < 15) return pick(name, GREETING_MONDAY, avoidKey);
  if (input.dow === 5 && input.hour >= 12) return pick(name, GREETING_FRIDAY, avoidKey);
  return pick(name, greetingTier(input.hour), avoidKey);
}

/* ── Subtítulos — organizados por categoría, resueltos en cascada de
   prioridad (cumpleaños > vacaciones > incidencias/eventos > equipo >
   estado personal > día de la semana > casual). 56 variantes en total. ── */
const SUB_BIRTHDAY_SELF: Entry[] = [
  { key: "s-bday-self-1", emoji: "🎂", text: "Que tengas un gran día." },
  { key: "s-bday-self-2", emoji: "🥳", text: "Todo el equipo te desea un excelente cumpleaños." },
  { key: "s-bday-self-3", emoji: "🎈", text: "Hoy es un buen día para celebrar." },
];
const SUB_BIRTHDAY_OTHER: Entry[] = [
  { key: "s-bday-other-1", emoji: "🎂", text: "Hoy celebramos el cumpleaños de {who}." },
  { key: "s-bday-other-2", emoji: "🎈", text: "No olvides felicitar a {who} — hoy es su cumpleaños." },
  { key: "s-bday-other-3", emoji: "🥳", text: "Hoy es un día especial para {who}." },
];
const SUB_VACATION_TODAY: Entry[] = [
  { key: "s-vac-today-1", emoji: "🏖️", text: "Nexus se encarga del resto." },
  { key: "s-vac-today-2", emoji: "🌴", text: "Nada urgente te espera hoy." },
  { key: "s-vac-today-3", emoji: "😎", text: "Aprovecha el día sin pendientes." },
  { key: "s-vac-today-4", emoji: "☀️", text: "Desconecta con tranquilidad." },
];
const SUB_VACATION_RETURN: Entry[] = [
  { key: "s-vac-return-1", emoji: "👋", text: "Esperamos que hayas descansado." },
  { key: "s-vac-return-2", emoji: "📋", text: "Aquí tienes un resumen de lo que pasó mientras no estabas." },
  { key: "s-vac-return-3", emoji: "☕", text: "Buen momento para retomar con calma." },
];
const SUB_VACATION_SOON: Entry[] = [
  { key: "s-vac-soon-1", emoji: "🌴", text: "Solo faltan {days} día{s} para tus vacaciones." },
  { key: "s-vac-soon-2", emoji: "📋", text: "Deja tus pendientes en orden antes de salir." },
  { key: "s-vac-soon-3", emoji: "🏝️", text: "Ya casi cambias la oficina por la playa." },
  { key: "s-vac-soon-4", emoji: "✅", text: "Todo está listo para tu descanso." },
];
const SUB_HOLIDAY: Entry[] = [
  { key: "s-holiday-1", emoji: "🗓️", text: "Hoy es día inhábil — nada urgente en puerta." },
  { key: "s-holiday-2", emoji: "☕", text: "Día tranquilo por el feriado de hoy." },
  { key: "s-holiday-3", emoji: "🌤️", text: "Poca actividad esperada — hoy es inhábil." },
];
const SUB_TEAM_COMPLETE: Entry[] = [
  { key: "s-team-1", emoji: "👥", text: "Todo tu equipo ya registró entrada." },
  { key: "s-team-2", emoji: "🟢", text: "Todo marcha con normalidad hoy." },
  { key: "s-team-3", emoji: "✅", text: "El equipo completo ya está trabajando." },
];
const SUB_MANY_PENDING: Entry[] = [
  { key: "s-many-1", emoji: "💪", text: "Hoy será un día ocupado." },
  { key: "s-many-2", emoji: "📋", text: "Tienes {n} pendientes acumulados." },
  { key: "s-many-3", emoji: "🗂️", text: "Hay bastante por revisar hoy." },
  { key: "s-many-4", emoji: "⚡", text: "Día cargado — {n} pendientes esperan." },
];
const SUB_FEW_PENDING: Entry[] = [
  { key: "s-few-1", emoji: "📋", text: "Hoy tienes {n} pendientes importantes." },
  { key: "s-few-2", emoji: "🗒️", text: "Quedan {n} pendientes por resolver." },
  { key: "s-few-3", emoji: "📌", text: "{n} pendientes están esperando tu revisión." },
  { key: "s-few-4", emoji: "🧭", text: "Nada abrumador — solo {n} pendientes hoy." },
];
const SUB_ONE_PENDING: Entry[] = [
  { key: "s-one-1", emoji: "📋", text: "Solo hay un pendiente importante." },
  { key: "s-one-2", emoji: "🗒️", text: "Un solo asunto necesita tu atención." },
  { key: "s-one-3", emoji: "📌", text: "Queda un pendiente antes de cerrar el día." },
];
const SUB_ALL_CLEAR: Entry[] = [
  { key: "s-clear-1", emoji: "✅", text: "Hoy todo está bajo control." },
  { key: "s-clear-2", emoji: "😌", text: "No tienes pendientes urgentes." },
  { key: "s-clear-3", emoji: "🧘", text: "Día despejado — buen momento para adelantar trabajo." },
  { key: "s-clear-4", emoji: "🌤️", text: "Sin pendientes por ahora — todo en orden." },
];
const SUB_FRIDAY: Entry[] = [
  { key: "s-friday-1", emoji: "📋", text: "Aprovecha para cerrar pendientes importantes." },
  { key: "s-friday-2", emoji: "😌", text: "Cerramos la semana con buen ritmo." },
  { key: "s-friday-3", emoji: "🍕", text: "¿Ya pensaste qué harás este fin de semana?" },
  { key: "s-friday-4", emoji: "✅", text: "Todo va en orden. Mantén el ritmo." },
];
const SUB_MONDAY: Entry[] = [
  { key: "s-monday-1", emoji: "🗓️", text: "Buen momento para planear la semana." },
  { key: "s-monday-2", emoji: "📋", text: "Revisa tus prioridades antes de arrancar." },
  { key: "s-monday-3", emoji: "☕", text: "Un café y a organizar el día." },
  { key: "s-monday-4", emoji: "🧭", text: "Define lo importante antes de lo urgente." },
];
const SUB_CASUAL: Entry[] = [
  { key: "s-casual-1", emoji: "🌧️", text: "Buen día para un café tranquilo." },
  { key: "s-casual-2", emoji: "☕", text: "¿Otro cafecito antes de arrancar?" },
  { key: "s-casual-3", emoji: "🎨", text: "Que no falten las buenas ideas hoy." },
  { key: "s-casual-4", emoji: "🎵", text: "¿Ya elegiste la música para trabajar?" },
  { key: "s-casual-5", emoji: "💡", text: "Las mejores ideas aparecen trabajando." },
  { key: "s-casual-6", emoji: "🧩", text: "Buen día para avanzar algo pendiente hace tiempo." },
  { key: "s-casual-7", emoji: "🗂️", text: "Buen momento para poner en orden lo importante." },
  { key: "s-casual-8", emoji: "🌤️", text: "Un día tranquilo puede ser lo más productivo." },
  { key: "s-casual-9", emoji: "📈", text: "Cada avance pequeño también cuenta." },
  { key: "s-casual-10", emoji: "🧭", text: "Buen momento para revisar prioridades." },
];

function resolveSubtitle(input: ContextHeaderInput, avoidKey?: string): Entry {
  const { name } = input;
  if (input.isBirthdayToday) return pick(name, SUB_BIRTHDAY_SELF, avoidKey);
  if (input.othersBirthdayToday.length > 0) {
    const who = input.othersBirthdayToday.length === 1
      ? input.othersBirthdayToday[0]
      : `${input.othersBirthdayToday.slice(0, -1).join(", ")} y ${input.othersBirthdayToday.at(-1)}`;
    const e = pick(name, SUB_BIRTHDAY_OTHER, avoidKey);
    return { ...e, text: e.text.replace(/\{who\}/g, who) };
  }
  if (input.vacation.today) return pick(name, SUB_VACATION_TODAY, avoidKey);
  if (input.vacation.returnedRecently) return pick(name, SUB_VACATION_RETURN, avoidKey);
  if (input.vacation.soonDays != null && input.vacation.soonDays <= 3) {
    const days = input.vacation.soonDays;
    const e = pick(name, SUB_VACATION_SOON, avoidKey);
    return { ...e, text: e.text.replace(/\{days\}/g, String(days)).replace(/\{s\}/g, days === 1 ? "" : "s") };
  }
  if (input.isHoliday) return pick(name, SUB_HOLIDAY, avoidKey);
  if (input.teamAllIn === true) return pick(name, SUB_TEAM_COMPLETE, avoidKey);
  if (input.pendingCount >= 4) {
    const e = pick(name, SUB_MANY_PENDING, avoidKey);
    return { ...e, text: e.text.replace(/\{n\}/g, String(input.pendingCount)) };
  }
  if (input.pendingCount >= 2) {
    const e = pick(name, SUB_FEW_PENDING, avoidKey);
    return { ...e, text: e.text.replace(/\{n\}/g, String(input.pendingCount)) };
  }
  if (input.pendingCount === 1) return pick(name, SUB_ONE_PENDING, avoidKey);
  if (input.allDone) return pick(name, SUB_ALL_CLEAR, avoidKey);
  if (input.dow === 5) return pick(name, SUB_FRIDAY, avoidKey);
  if (input.dow === 1) return pick(name, SUB_MONDAY, avoidKey);
  return pick(name, SUB_CASUAL, avoidKey);
}

function dateLabelOf(): string {
  const fmt = new Intl.DateTimeFormat("es-MX", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Merida",
  });
  const label = fmt.format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildContextMessage(
  input: ContextHeaderInput,
  avoid?: { greetingKey?: string; subtitleKey?: string },
): ContextMessage {
  const g = resolveGreeting(input, avoid?.greetingKey);
  const s = resolveSubtitle(input, avoid?.subtitleKey);
  return {
    dateLabel: dateLabelOf(),
    greetingKey: g.key, greetingEmoji: g.emoji, greetingText: g.text,
    subtitleKey: s.key, subtitleEmoji: s.emoji, subtitleText: s.text,
  };
}
