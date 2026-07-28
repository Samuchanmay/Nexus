"use client";
import { useEffect, useState } from "react";
import type { AssistantMessage } from "@/lib/assistant";
import { useMountOnOpen } from "@/lib/use-mount-on-open";

const SEEN_KEY = "nx-assistant-popup-seen";
// "Ahora no" en Pausa activa no descarta el aviso hasta el siguiente ciclo
// completo (podría ser 60-90 min) — snooze corto: vuelve a insistir en
// SNOOZE_MIN minutos, sin esperar todo el intervalo configurado.
const SNOOZE_KEY = "nx-pausa-activa-snooze-until";
const SNOOZE_MIN = 10;

/** Ilustración propia de Nexus — taza + vapor, estilo flat monolínea (mismo
    lenguaje que components/icons.tsx). Reemplaza el emoji ☕ unicode que
    tenía antes: este popup ya no usa ningún emoji (punto 2 del rediseño). */
function CoffeeIllustration({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 9.5h13v5.5a4 4 0 01-4 4h-5a4 4 0 01-4-4V9.5z" />
      <path d="M17.5 10.5h1a2.3 2.3 0 010 4.6h-1" />
      <line x1="4" y1="20" x2="16.5" y2="20" />
      <path className="nx-steam-1" d="M9 6.2c.7-.9.7-1.6 0-2.5" opacity={0.5} />
      <path className="nx-steam-2" d="M13 6.2c.7-.9.7-1.6 0-2.5" opacity={0.5} />
    </svg>
  );
}

/** Emoji grande — se conserva SOLO para el aviso de cumpleaños (no es el
    componente que este rediseño cubre); pausa activa ya no lo usa. */
function emojiFor(msg: AssistantMessage): string {
  if (msg.id === "cumpleanos") return "🎉";
  return "✨";
}

function fmtElapsed(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/**
 * Aviso destacado (pausa activa, cumpleaños) como pop-up centrado, la
 * primera vez que aparece cada ciclo/sesión — se recuerda con
 * sessionStorage para no insistir. El cumpleaños tiene prioridad; si
 * además cae un aviso de pausa activa en la misma sesión, se muestra justo
 * después de cerrar el de cumpleaños (ids distintos → sessionStorage no
 * lo bloquea).
 *
 * Pausa activa tiene un tratamiento propio (ilustración, jerarquía de 5
 * niveles, tiempo destacado, dos acciones) — ver PausaActivaBody más abajo.
 * Cumpleaños conserva el tratamiento simple anterior (emoji + un botón),
 * fuera de alcance de este rediseño.
 */
export function PausaActivaPopup({ messages }: { messages: AssistantMessage[] }) {
  const msg = messages.find((m) => m.id === "cumpleanos") ?? messages.find((m) => m.id.startsWith("pausa-activa-")) ?? null;
  const [shownId, setShownId] = useState<string | null>(null);
  // Se re-evalúa cada tick para poder volver a mostrarse en cuanto expira un
  // snooze, incluso si el padre no vuelve a recalcular `messages` mientras
  // tanto (el heartbeat de pausa activa puede tardar en volver a tocar).
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!msg) return;
    const check = () => {
      const seen = sessionStorage.getItem(SEEN_KEY);
      if (seen === msg.id) return;
      const snoozeUntil = Number(sessionStorage.getItem(SNOOZE_KEY) || 0);
      if (Date.now() < snoozeUntil) { forceTick((n) => n + 1); return; }
      setShownId(msg.id);
    };
    check();
    const t = setInterval(check, 15_000);
    return () => clearInterval(t);
  }, [msg]);

  const open = !!msg && shownId === msg.id;
  // Se desmonta por completo ~220ms después de cerrar — mismo estándar que
  // Sheet/NotificationBell: nunca queda un overlay fantasma en el DOM.
  const { mounted, visible } = useMountOnOpen(open, 220);

  // "Tomaré una pausa" — acuse de recibo real: no vuelve a insistir hasta
  // el siguiente ciclo (nuevo id de pausa-activa-N).
  const dismiss = () => {
    if (msg) sessionStorage.setItem(SEEN_KEY, msg.id);
    setShownId(null);
  };

  // "Ahora no" — solo para pausa activa: snooze corto (SNOOZE_MIN), NO
  // marca el id como "visto" para siempre, así puede volver a aparecer
  // antes del próximo ciclo si el usuario sigue trabajando sin pausar.
  const snooze = () => {
    sessionStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MIN * 60_000));
    setShownId(null);
  };

  if (!mounted || !msg) return null;
  const isPausaActiva = msg.id.startsWith("pausa-activa-");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{
        background: visible ? "rgba(0,0,0,.5)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(4px)" : "blur(0px)",
        // Mismo patrón de causa raíz que overlay.tsx/date-sheet.tsx — sin
        // esto, los ~220ms de salida dejaban un overlay de página completa
        // invisible pero clickeable (este popup puede aparecer en CUALQUIER
        // pantalla, incluida Equipo, por el heartbeat de pausa activa).
        pointerEvents: visible ? "all" : "none",
        transition: "background .22s ease-out, backdrop-filter .22s ease-out",
      }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-[380px] rounded-lg text-center"
        style={{
          background: "var(--panel)", border: "1px solid var(--border)",
          padding: isPausaActiva ? "32px 28px 28px" : "24px",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(.96)",
          filter: visible ? "blur(0px)" : "blur(2px)",
          transition: "opacity .2s ease-out, transform .2s ease-out, filter .2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isPausaActiva ? (
          <PausaActivaBody msg={msg} onDismiss={dismiss} onSnooze={snooze} />
        ) : (
          <>
            <div className="mx-auto w-14 h-14 rounded-full mb-4 nx-msg-icon-bounce flex items-center justify-center"
              style={{ background: "var(--accent-tint)" }}>
              <span className="block text-[28px] leading-none text-center" style={{ width: "1em" }}>{emojiFor(msg)}</span>
            </div>
            <p className="text-[11.5px] font-bold mb-1.5" style={{ color: "var(--accent)" }}>Un día especial</p>
            <p className="text-[15px] font-semibold leading-snug mb-5" style={{ color: "var(--text-1)" }}>{msg.text}</p>
            <button className="btn-primary w-full py-2.5" onClick={dismiss}>Entendido</button>
          </>
        )}
      </div>
    </div>
  );
}

/** Cuerpo de pausa activa — jerarquía de 5 niveles (ilustración → título →
    mensaje principal → explicación con el tiempo destacado → botones),
    exactamente en ese orden y sin repetir "Pausa activa" dos veces. */
function PausaActivaBody({ msg, onDismiss, onSnooze }: { msg: AssistantMessage; onDismiss: () => void; onSnooze: () => void }) {
  const elapsed = msg.elapsedMin != null ? fmtElapsed(msg.elapsedMin) : null;
  return (
    <>
      {/* 1 — Ilustración: círculo de 56px, SVG de 24px, respira muy lento. */}
      <div
        className="mx-auto w-14 h-14 rounded-full flex items-center justify-center nx-breathe-soft"
        style={{ background: "var(--accent-tint)", color: "var(--accent)", boxShadow: "0 4px 14px rgba(0,0,0,.08)" }}
      >
        <CoffeeIllustration size={24} />
      </div>

      {/* 2 — Título (único, no se repite en ningún otro lado del popup). */}
      <p className="text-[16px] font-bold mt-6" style={{ color: "var(--text-1)" }}>Pausa activa</p>

      {/* 3 — Mensaje principal. */}
      <p className="text-[14px] font-semibold mt-2" style={{ color: "var(--text-2)" }}>
        Es un buen momento para descansar.
      </p>

      {/* 4 — Explicación, con el tiempo trabajado como dato protagonista. */}
      <p className="text-[12.5px] leading-relaxed mt-3" style={{ color: "var(--text-3)" }}>
        {elapsed && (
          <span className="block text-[20px] font-bold mb-1" style={{ color: "var(--text-1)" }}>{elapsed}</span>
        )}
        Llevas {elapsed ?? "un buen rato"} trabajando sin interrupciones. Una pausa de 10 a 15 minutos puede ayudarte
        a mantener la concentración durante el resto de la jornada.
      </p>

      {/* 5 — Botones: acción principal + salida sin fricción. */}
      <div className="flex flex-col gap-2 mt-6">
        <button className="btn-primary w-full py-2.5" onClick={onDismiss}>Tomaré una pausa</button>
        <button className="btn-tertiary w-full py-2" onClick={onSnooze}>Ahora no</button>
      </div>
    </>
  );
}
