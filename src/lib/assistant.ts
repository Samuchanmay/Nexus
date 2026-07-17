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
 */
const PAUSA_ACTIVA_INTERVAL_MIN = 120; // cada 2 horas de trabajo continuo
const PAUSA_ACTIVA_WINDOW_MIN = 12;    // ventana en la que se muestra el aviso

const PAUSA_ACTIVA_FRASES = [
  "Llevas 2 horas seguidas — buen momento para una pausa activa. ¿Bala time o Taxito time? ☕",
  "Pausa activa: camina un poco, despeja la mente con un chismecito — bala time / taxito time ☕",
  "2 horas de corrido — párate, estira las piernas, un cafecito no le hace mal a nadie ☕",
];

export function contextualMessages(params: {
  today: string; // YYYY-MM-DD, hoy en Mérida
  nowMin: number; // minutos desde medianoche, hora Mérida
  tasks: AssistantTask[];
  birthDate?: string | null;   // YYYY-MM-DD — cumpleaños de la persona (perfil)
  working?: boolean;           // true si ya fichó entrada y la jornada sigue abierta
  workStartTime?: string | null; // HH:MM[:SS] — inicio del tramo de trabajo continuo actual
                                  // (la última "Entrada", ya sea la del día o tras un descanso)
}): AssistantMessage[] {
  const { today, nowMin, tasks, birthDate, working, workStartTime } = params;
  const msgs: AssistantMessage[] = [];

  // Regla 0a — Cumpleaños: mensaje cálido, siempre primero, todo el día.
  if (birthDate) {
    const md = birthDate.slice(5); // MM-DD
    if (md === today.slice(5)) {
      msgs.push({
        id: "cumpleanos",
        tone: "info",
        icon: "cake",
        text: "¡Feliz cumpleaños! 🎉 Eres una parte muy valiosa del equipo — que tengas un día increíble.",
      });
    }
  }

  // Regla 0b — Pausa activa: cada 2 horas de trabajo continuo (no de reloj fijo).
  if (working && workStartTime) {
    const [hStr, mStr] = workStartTime.slice(0, 5).split(":");
    const startMin = Number(hStr) * 60 + Number(mStr);
    const elapsed = nowMin - startMin;
    if (elapsed >= PAUSA_ACTIVA_INTERVAL_MIN) {
      const cycle = Math.floor(elapsed / PAUSA_ACTIVA_INTERVAL_MIN);
      const intoCycle = elapsed % PAUSA_ACTIVA_INTERVAL_MIN;
      if (intoCycle <= PAUSA_ACTIVA_WINDOW_MIN) {
        msgs.push({
          id: `pausa-activa-${cycle}`,
          tone: "info",
          icon: "food",
          text: PAUSA_ACTIVA_FRASES[(cycle - 1) % PAUSA_ACTIVA_FRASES.length],
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
