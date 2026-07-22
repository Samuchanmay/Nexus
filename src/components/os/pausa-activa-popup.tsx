"use client";
import { useEffect, useState } from "react";
import type { AssistantMessage } from "@/lib/assistant";

const SEEN_KEY = "nx-assistant-popup-seen";

/** Emoji grande en vez de ícono de línea — encaja mejor con el tono relajado
 * (pausa activa) o festivo (cumpleaños) de estos dos avisos, y evita el
 * problema de un ícono SVG que se ve descentrado a este tamaño. */
function emojiFor(msg: AssistantMessage): string {
  if (msg.id === "cumpleanos") return "🎉";
  if (msg.id.startsWith("pausa-activa-")) return "☕";
  return "✨";
}

/**
 * Aviso destacado (pausa activa, cumpleaños) como pop-up centrado, la
 * primera vez que aparece cada ciclo/sesión — se recuerda con
 * sessionStorage para no insistir. El cumpleaños tiene prioridad (es más
 * especial y solo pasa un día al año); si además cae un aviso de pausa
 * activa en la misma sesión, se muestra justo después de cerrar el de
 * cumpleaños (ids distintos → sessionStorage no lo bloquea).
 */
export function PausaActivaPopup({ messages }: { messages: AssistantMessage[] }) {
  const msg = messages.find((m) => m.id === "cumpleanos") ?? messages.find((m) => m.id.startsWith("pausa-activa-")) ?? null;
  const [shownId, setShownId] = useState<string | null>(null);

  useEffect(() => {
    if (!msg) return;
    const seen = sessionStorage.getItem(SEEN_KEY);
    if (seen !== msg.id) setShownId(msg.id);
  }, [msg]);

  if (!msg || shownId !== msg.id) return null;

  const dismiss = () => {
    sessionStorage.setItem(SEEN_KEY, msg.id);
    setShownId(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 nx-fade" onClick={dismiss}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[360px] rounded-lg p-6 text-center nx-pop"
        style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-14 h-14 rounded-full grid place-items-center mb-4 text-[30px] leading-none nx-msg-icon-bounce"
          style={{ background: "var(--accent-tint)" }}>
          <span>{emojiFor(msg)}</span>
        </div>
        <p className="text-[15px] font-bold leading-snug mb-5">{msg.text}</p>
        <button className="btn-primary w-full py-2.5" onClick={dismiss}>Entendido</button>
      </div>
    </div>
  );
}
