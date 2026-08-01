"use client";
import { STATUS_ICON, type MessageStatus } from "@/lib/chat/message-state";

/** Indicador discreto de estado — 🕓 / ✓ / ✓✓ / ✓✓ (leído, en acento) / ⚠.
    Con tone="accent" (burbujas propias, fondo sólido de acento) los ticks
    se pintan en blanco — sobre el azul sólido el acento no se vería. */
export function MessageStatusIcon({ status, onRetry, tone }: {
  status: MessageStatus; onRetry?: () => void; tone?: "accent";
}) {
  if (status === "failed") {
    return (
      <button
        onClick={onRetry}
        title="No se pudo enviar — tocar para reintentar"
        className="text-[10.5px] leading-none inline-flex items-center gap-0.5"
        style={{ color: tone === "accent" ? "rgba(255,255,255,0.92)" : "var(--danger)" }}
      >
        {STATUS_ICON.failed} reintentar
      </button>
    );
  }
  return (
    <span
      className="text-[10.5px] leading-none select-none"
      style={{
        color: tone === "accent" ? "#FFFFFF" : status === "read" ? "var(--accent)" : "currentColor",
        opacity: status === "pending" ? (tone === "accent" ? 0.6 : 0.55) : 0.75,
      }}
      title={status}
    >
      {STATUS_ICON[status]}
    </span>
  );
}
