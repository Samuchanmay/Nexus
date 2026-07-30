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
