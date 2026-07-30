"use client";
import { STATUS_ICON, type MessageStatus } from "@/lib/chat/message-state";

/** Indicador discreto de estado — 🕓 / ✓ / ✓✓ / ✓✓ (leído, en acento) / ⚠. */
export function MessageStatusIcon({ status, onRetry }: { status: MessageStatus; onRetry?: () => void }) {
  if (status === "failed") {
    return (
      <button
        onClick={onRetry}
        title="No se pudo enviar — tocar para reintentar"
        className="text-[10.5px] leading-none inline-flex items-center gap-0.5"
        style={{ color: "var(--danger)" }}
      >
        {STATUS_ICON.failed} reintentar
      </button>
    );
  }
  return (
    <span
      className="text-[10.5px] leading-none select-none"
      style={{ color: status === "read" ? "var(--accent)" : "currentColor", opacity: status === "pending" ? 0.55 : 0.75 }}
      title={status}
    >
      {STATUS_ICON[status]}
    </span>
  );
}
