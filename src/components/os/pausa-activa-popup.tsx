"use client";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import type { AssistantMessage } from "@/lib/assistant";

const SEEN_KEY = "nx-pausa-activa-seen";

/**
 * El aviso de pausa activa ("llevas 2 horas seguidas…") vivía como una fila
 * más dentro de la tarjeta del Asistente, algo fácil de no notar. Ahora se
 * muestra como un pop-up centrado la primera vez que aparece cada ciclo —
 * se recuerda con sessionStorage para no insistir si la persona ya lo vio
 * y solo recarga la página (pero sí vuelve a aparecer en el siguiente
 * ciclo de 2 horas, o en una sesión nueva).
 */
export function PausaActivaPopup({ messages }: { messages: AssistantMessage[] }) {
  const msg = messages.find((m) => m.id.startsWith("pausa-activa-")) ?? null;
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
        <div className="mx-auto w-14 h-14 rounded-full grid place-items-center mb-4 nx-msg-icon-bounce"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
          <Icon name={msg.icon} size={26} />
        </div>
        <p className="text-[15px] font-bold leading-snug mb-5">{msg.text}</p>
        <button className="btn-primary w-full py-2.5" onClick={dismiss}>Entendido</button>
      </div>
    </div>
  );
}
