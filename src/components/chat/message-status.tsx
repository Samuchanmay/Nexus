"use client";
import { Icon } from "@/components/os/icons";
import { STATUS_LABEL, type MessageStatus } from "@/lib/chat/message-state";

function formatReadTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

/** Indicador discreto de estado — reloj (enviando) / ✓ / ✓✓ / ✓✓ (leído, en
    acento) / alerta con reintento. Con tone="accent" (burbujas propias,
    fondo sólido de acento) los ticks se pintan en blanco — sobre el azul
    sólido el acento no se vería.

    Lecturas con hora (FASE "plataforma de mensajería moderna"): cuando el
    mensaje está leído y el backfill trajo read_at (migración 0025), el tick
    muestra "✓✓ · HH:MM" en vez de la sola doble marca — mismo lenguaje que
    el timbre de hora que ya usan las burbujas. */
export function MessageStatusIcon({ status, readAt, onRetry, tone }: {
  status: MessageStatus; readAt?: string | null; onRetry?: () => void; tone?: "accent";
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
      className="text-[10.5px] leading-none select-none inline-flex items-center gap-1"
      style={{
        color: tone === "accent" ? "#FFFFFF" : status === "read" ? "var(--accent)" : "currentColor",
        opacity: status === "pending" ? (tone === "accent" ? 0.6 : 0.55) : 0.75,
        // Micro-animación al llegar al estado (spec chat §1: 120–220ms,
        // nunca más de 300): los ✓✓ de leído hacen pop al confirmarse.
        animation: status === "read" ? "nx-pop .22s var(--ease)" : status === "pending" ? "nx-breathe-soft 1.6s ease-in-out infinite" : undefined,
      }}
      title={status === "read" && readAt ? `${STATUS_LABEL[status]} · ${formatReadTime(readAt)}` : STATUS_LABEL[status]}
    >
      {glyph}
      {status === "read" && readAt && <span className="opacity-90">{formatReadTime(readAt)}</span>}
    </span>
  );
}
