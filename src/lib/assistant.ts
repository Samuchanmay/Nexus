/**
 * lib/assistant.ts — Motor de reglas del Asistente Contextual (Plano Maestro §11).
 *
 * "No es un chatbot: es un motor contextual que analiza el estado del
 * sistema y ofrece recomendaciones útiles." Observa Actividades, Jornada
 * y Calendario (agenda del día ya guardada en la solicitud) y calcula
 * mensajes en cada carga de Mi Día — no hay estado persistido ni cron;
 * se recalcula siempre con datos frescos.
 */

export interface AssistantMessage {
  id: string;
  tone: "info" | "warn" | "danger";
  icon: "clock" | "alert" | "sparkle" | "cake" | "food";
  text: string;
  /** true para mensajes que deben resaltar con animación (pausa activa, cumpleaños). */
  animated?: boolean;
}

export interface AssistantTask {
  projectId: string;
  title: string;
  status: string; // solicitada | aprobada | en_progreso | en_revision | completada | pausada | cancelada
  deadline: string | null; // YYYY-MM-DD
  eventDate: string | null; // YYYY-MM-DD — fecha del evento/entrega de la solicitud
  eventTime: string | null; // HH:MM:SS
  isLead: boolean;
  hasEvidence: boolean;
}

const CLOSED = new Set(["completada", "cancelada"]);

/** Ventana de aviso antes de que empiece un evento con hora (minutos). */
const REUNION_WINDOW_MIN = 45;
/** Días de anticipación para avisar que una actividad está por vencer. */
const VENCE_WINDOW_DAYS = 2;

/**
 * Pausa activa — antes era un solo aviso fijo a las 4:00–4:20 p.m., sin
 * relación con cuánto llevaba trabajando la persona ese día. Corregido
 * según la recomendación real de pausas activas: mínimo 2 veces al día,
 * idealmente cada 2 horas de trabajo CONTINUO (no de reloj — si hubo un
 * descanso de por medio, el conteo se reinicia desde que retomó).
 * Se avisa en una ventana de ~12 min cada vez que se cumple el ciclo,
 * para que alcance a notarlo sin que el aviso se quede pegado todo el día.
 *
 * El intervalo, la ventana y las frases ahora son configurables desde
 * Configuración → Pausa activa (admin) — viven en app_settings y en la
 * tabla pausa_activa_frases. Estos valores son solo el respaldo por si la
 * configuración llegara vacía (nunca debería, pero el asistente no debe
 * romperse por eso).
 */
const PAUSA_ACTIVA_INTERVAL_MIN_DEFAULT = 120; // cada 2 horas de trabajo continuo
const PAUSA_ACTIVA_WINDOW_MIN_DEFAULT = 12;    // ventana en la que se muestra el aviso

const PAUSA_ACTIVA_FRASES_DEFAULT = [
  "Llevas 2 horas seguidas — buen momento para una pausa activa. ¿Bala time o Taxito time? ☕",
];

export function contextualMessages(params: {
  today: string; // YYYY-MM-DD, hoy en Mérida
  nowMin: number; // minutos desde medianoche, hora Mérida
  tasks: AssistantTask[];
  birthDate?: string | null;   // YYYY-MM-DD — cumpleaños de la persona (perfil)
  working?: boolean;           // true si ya fichó entrada y la jornada sigue abierta
  workStartTime?: string | null; // HH:MM[:SS] — inicio del tramo de trabajo continuo actual
                                  // (la última "Entrada", ya sea la del día o tras un descanso)
  pausaActivaFrases?: string[];   // frases configurables (Configuración → Pausa activa)
  pausaActivaIntervalMin?: number; // minutos de trabajo continuo entre avisos
  pausaActivaWindowMin?: number;   // minutos que dura visible cada aviso
}): AssistantMessage[] {
  const {
    today, nowMin, tasks, birthDate, working, workStartTime,
    pausaActivaFrases, pausaActivaIntervalMin, pausaActivaWindowMin,
  } = params;
  const frases = pausaActivaFrases && pausaActivaFrases.length > 0 ? pausaActivaFrases : PAUSA_ACTIVA_FRASES_DEFAULT;
  const intervalMin = pausaActivaIntervalMin && pausaActivaIntervalMin > 0 ? pausaActivaIntervalMin : PAUSA_ACTIVA_INTERVAL_MIN_DEFAULT;
  const windowMin = pausaActivaWindowMin && pausaActivaWindowMin > 0 ? pausaActivaWindowMin : PAUSA_ACTIVA_WINDOW_MIN_DEFAULT;
  const msgs: AssistantMessage[] = [];

  // Regla 0a — Cumpleaños: mensaje cálido, siempre primero, todo el día.
  if (birthDate) {
    const md = birthDate.slice(5); // MM-DD
    if (md === today.slice(5)) {
      msgs.push({
        id: "cumpleanos",
        tone: "info",
        icon: "cake",
        animated: true,
        text: "¡Feliz cumpleaños! 🎉 Eres una parte muy valiosa del equipo — que tengas un día increíble.",
      });
    }
  }

  // Regla 0b — Pausa activa: cada N horas de trabajo continuo (no de reloj fijo).
  if (working && workStartTime) {
    const [hStr, mStr] = workStartTime.slice(0, 5).split(":");
    const startMin = Number(hStr) * 60 + Number(mStr);
    const elapsed = nowMin - startMin;
    if (elapsed >= intervalMin) {
      const cycle = Math.floor(elapsed / intervalMin);
      const intoCycle = elapsed % intervalMin;
      if (intoCycle <= windowMin) {
        msgs.push({
          id: `pausa-activa-${cycle}`,
          tone: "info",
          icon: "food",
          animated: true,
          text: frases[(cycle - 1) % frases.length],
        });
      }
    }
  }

  for (const t of tasks) {
    if (CLOSED.has(t.status)) continue;

    // Regla 1 — "Tu reunión comienza en 15 min"
    if (t.eventDate === today && t.eventTime) {
      const [h, m] = t.eventTime.split(":").map(Number);
      const diff = h * 60 + m - nowMin;
      if (diff >= -5 && diff <= REUNION_WINDOW_MIN) {
        msgs.push({
          id: `reunion-${t.projectId}`,
          tone: diff <= 15 ? "danger" : "warn",
          icon: "clock",
          text: diff <= 1 ? `"${t.title}" empieza ahora` : `"${t.title}" empieza en ${diff} min`,
        });
      }
    }

    // Regla 2 — "Tienes una actividad por vencer"
    if (t.deadline) {
      const daysLeft = diffDays(today, t.deadline);
      if (daysLeft >= 0 && daysLeft <= VENCE_WINDOW_DAYS) {
        msgs.push({
          id: `vence-${t.projectId}`,
          tone: daysLeft === 0 ? "danger" : "warn",
          icon: "alert",
          text: daysLeft === 0 ? `"${t.title}" vence hoy` : `"${t.title}" vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`,
        });
      }
    }

    // Regla 3 — "No olvides subir evidencias"
    if (t.isLead && t.status === "en_revision" && !t.hasEvidence) {
      msgs.push({
        id: `evidencia-${t.projectId}`,
        tone: "warn",
        icon: "sparkle",
        text: `"${t.title}" está en revisión sin evidencia adjunta`,
      });
    }
  }

  return msgs;
}

function diffDays(a: string, b: string): number {
  const d1 = Date.parse(a + "T12:00:00Z");
  const d2 = Date.parse(b + "T12:00:00Z");
  return Math.round((d2 - d1) / 86400000);
}
