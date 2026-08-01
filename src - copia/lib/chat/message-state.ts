/**
 * Máquina de estados de mensaje — lógica pura, sin React.
 *
 * pending  → el mensaje vive solo en memoria del cliente, aún no se intentó
 *            el insert (o el insert está en vuelo).
 * sent     → ya existe la fila en Supabase.
 * delivered → al menos un destinatario distinto del remitente lo recibió
 *            en vivo (realtime) o lo cargó al abrir la conversación.
 * read     → al menos un destinatario lo marcó como leído (abrió la
 *            conversación con el mensaje visible).
 * failed   → se agotaron los reintentos del outbox sin éxito.
 *
 * Nota de alcance: es un solo estado por mensaje, no un recibo por
 * destinatario (eso es lo que hace Signal de verdad, con una fila de
 * "delivery receipt" por dispositivo). Para conversaciones directas es
 * exactamente equivalente; para grupos, "delivered"/"read" reflejan al
 * primer participante que llega a ese estado, no a todos. Documentado
 * como simplificación consciente, no como descuido.
 */

export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

const RANK: Record<MessageStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: -1, // failed no es parte de la progresión normal, es una salida
};

/** ¿b es un avance real sobre a? (failed nunca "avanza" sobre nada — es terminal). */
export function isForwardTransition(from: MessageStatus, to: MessageStatus): boolean {
  if (to === "failed") return from !== "read"; // no degradar un mensaje ya leído
  if (from === "failed") return to === "pending"; // solo un reintento puede sacarlo de failed
  return RANK[to] > RANK[from];
}

/** Aplica una transición solo si es válida; si no, regresa el estado actual sin cambios. */
export function advance(current: MessageStatus, to: MessageStatus): MessageStatus {
  return isForwardTransition(current, to) ? to : current;
}

export const STATUS_ICON: Record<MessageStatus, string> = {
  pending: "🕓",
  sent: "✓",
  delivered: "✓✓",
  read: "✓✓",
  failed: "⚠",
};

export const STATUS_LABEL: Record<MessageStatus, string> = {
  pending: "Enviando",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "No se pudo enviar",
};
