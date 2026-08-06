/** "Activo ahora" / "Hace 5 minutos" / "Hace 2 horas" a partir de un heartbeat. */
export function formatPresence(lastSeenAt: string | null | undefined): string | null {
  if (!lastSeenAt) return null;
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return "Activo ahora";
  if (diffMin < 60) return `Hace ${diffMin} minuto${diffMin === 1 ? "" : "s"}`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} hora${diffH === 1 ? "" : "s"}`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Hace ${diffD} día${diffD === 1 ? "" : "s"}`;
  return null; // más de una semana — no aporta, se omite (filosofía: no mostrar si no ayuda)
}

/** Los tres estados de presencia que se pintan como punto de color en la
    app (FASE W7.1 + Fase 5). "online" = heartbeat reciente (<2 min) o
    estado manual "active"; "away"/"dnd" = estado MANUAL fijado por la
    propia persona, tiene prioridad sobre el heartbeat aunque este siga
    llegando; null = sin indicador (heartbeat viejo o inexistente). */
export type PresenceDot = "online" | "away" | "dnd" | null;

/** Color de cada punto de presencia — único lugar que lo define, para que
    el indicador se vea igual en la lista de chats, el encabezado de la
    conversación y el panel de miembros. */
export const PRESENCE_DOT_COLOR: Record<Exclude<PresenceDot, null>, string> = {
  online: "var(--ok)",
  away: "var(--warn)",
  dnd: "var(--danger)",
};

const MANUAL_STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  away: "Ausente",
  busy: "No molestar",
  // Legacy (migración 0039 puede tener valores antiguos)
  ausente: "Ausente",
  no_molestar: "No molestar",
};

/**
 * Info de presencia lista para pintar: texto + qué punto de color mostrar.
 * El estado manual (Activo/Ausente/No molestar) siempre gana sobre el
 * cálculo automático por heartbeat — es una decisión explícita de la persona.
 */
export function getPresenceInfo(
  lastSeenAt: string | null | undefined,
  manualStatus?: string | null,
): { label: string | null; dot: PresenceDot } {
  if (manualStatus && MANUAL_STATUS_LABEL[manualStatus]) {
    const dot: PresenceDot = manualStatus === "busy" || manualStatus === "no_molestar"
      ? "dnd"
      : manualStatus === "away" || manualStatus === "ausente"
        ? "away"
        : "online";
    return { label: MANUAL_STATUS_LABEL[manualStatus], dot };
  }
  const label = formatPresence(lastSeenAt);
  const isRecentlyActive = !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
  return { label, dot: isRecentlyActive ? "online" : null };
}
