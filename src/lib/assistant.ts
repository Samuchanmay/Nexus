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
  icon: "clock" | "alert" | "sparkle";
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

export function contextualMessages(params: {
  today: string; // YYYY-MM-DD, hoy en Mérida
  nowMin: number; // minutos desde medianoche, hora Mérida
  tasks: AssistantTask[];
}): AssistantMessage[] {
  const { today, nowMin, tasks } = params;
  const msgs: AssistantMessage[] = [];

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
