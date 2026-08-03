"use client";
import { Icon } from "@/components/os/icons";
import { STATUS_LABEL, type MessageStatus } from "@/lib/chat/message-state";

/** Indicador discreto de estado — reloj (enviando) / ✓ / ✓✓ / ✓✓ (leído, en
    acento) / alerta con reintento. Con tone="accent" (burbujas propias,
    fondo sólido de acento) los ticks se pintan en blanco — sobre el azul
    sólido el acento no se vería. */
export function MessageStatusIcon({ status, onRetry, tone }: {
  status: MessageStatus; onRetry?: () => void; tone?: "accent";
}) {
  if (status === "failed") {
    return (
      <button
        onClick={onRetry}
        title="No se pudo enviar — tocar para reintentar"
        className="text-[10.5px] leading-none inline-flex items-center gap-1"
        style={{ color: tone === "accent" ? "rgba(255,255,255,0.92)" : "var(--danger)" }}
      >
        <Icon name="alert" size={11} /> reintentar
      </button>
    );
  }
  const glyph = status === "pending" ? <Icon name="clock" size={11} /> : status === "sent" ? "✓" : "✓✓";
  return (
    <span
      className="text-[10.5px] leading-none select-none inline-flex"
      style={{
        color: tone === "accent" ? "#FFFFFF" : status === "read" ? "var(--accent)" : "currentColor",
        opacity: status === "pending" ? (tone === "accent" ? 0.6 : 0.55) : 0.75,
      }}
      title={STATUS_LABEL[status]}
    >
      {glyph}
    </span>
  );
}
