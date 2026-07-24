"use client";
// ═══════════════════════════════════════════════════════════════
//  ContextHeader — encabezado vivo del Dashboard.
//  Recibe el CONTEXTO ya resuelto en el servidor (cumpleaños,
//  vacaciones, pendientes…) y aquí, en el cliente:
//   1. Corre el motor de prioridades (lib/context-header.ts) para
//      elegir saludo + subtítulo.
//   2. Evita repetir el último mensaje mostrado (localStorage).
//   3. Anima el emoji del saludo con Framer Motion — una animación
//      distinta por emoji, lenta y elegante, nunca distractora.
//   4. Anima la transición del mensaje (fade + slide 8px, 250ms, easeOut).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, type Transition } from "framer-motion";
import { buildContextMessage, type ContextHeaderInput } from "@/lib/context-header";

const STORAGE_KEY = "nexus.context-header.last";

/** Animaciones por emoji — agrupadas por "personalidad" de movimiento.
    Todas lentas (duración 1–1.6s), con pausas largas entre repeticiones
    (6–10s) para que nunca se sientan como una distracción constante. */
type Anim = { animate: Record<string, number[] | string[]>; transition: Transition };

const WAVE: Anim = { animate: { rotate: [0, -12, 8, -6, 0] }, transition: { duration: 1.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 7 } };
const POP_ROTATE: Anim = { animate: { scale: [1, 1.18, 1], rotate: [0, 8, 0] }, transition: { duration: 1.1, ease: "easeOut", repeat: Infinity, repeatDelay: 8 } };
const BREATHE: Anim = { animate: { scale: [1, 1.1, 1] }, transition: { duration: 2.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 6 } };
const FLOAT: Anim = { animate: { y: [0, -4, 0] }, transition: { duration: 2.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 6.5 } };
const PULSE: Anim = { animate: { scale: [1, 1.15, 1] }, transition: { duration: 1, ease: "easeInOut", repeat: Infinity, repeatDelay: 7.5 } };
const BOUNCE: Anim = { animate: { y: [0, -7, 0] }, transition: { duration: 1, ease: "easeOut", repeat: Infinity, repeatDelay: 8 } };
const WIGGLE: Anim = { animate: { rotate: [0, -8, 8, -4, 0], scale: [1, 1.08, 1] }, transition: { duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 9 } };
const BOB_SWAY: Anim = { animate: { y: [0, -3, 0], rotate: [0, 5, -5, 0] }, transition: { duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 6 } };
const SCALE_SOFT: Anim = { animate: { scale: [1, 1.12, 1] }, transition: { duration: 0.9, ease: "easeOut", repeat: Infinity, repeatDelay: 10 } };
const DEFAULT_ANIM: Anim = { animate: { scale: [1, 1.06, 1] }, transition: { duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: 7 } };

const EMOJI_ANIM: Record<string, Anim> = {
  "👋": WAVE,
  "✌️": POP_ROTATE, "🎓": POP_ROTATE, "📋": POP_ROTATE, "📷": POP_ROTATE, "🗒️": POP_ROTATE, "📌": POP_ROTATE,
  "☀️": BREATHE, "🌤️": BREATHE, "✨": BREATHE, "💡": BREATHE, "🧭": BREATHE, "🌅": BREATHE,
  "🌙": FLOAT, "🏖️": FLOAT, "🌴": FLOAT, "🏝️": FLOAT, "🧘": FLOAT, "🌇": FLOAT,
  "🔥": PULSE, "⚡": PULSE, "🟢": PULSE,
  "🎉": BOUNCE, "💪": BOUNCE, "⭐": BOUNCE, "🚀": BOUNCE, "🎂": BOUNCE, "🎈": BOUNCE,
  "🥳": WIGGLE,
  "☕": BOB_SWAY, "🍽️": BOB_SWAY, "🍕": BOB_SWAY,
  "✅": SCALE_SOFT, "👥": SCALE_SOFT, "😌": SCALE_SOFT, "😎": SCALE_SOFT, "😄": SCALE_SOFT, "😴": SCALE_SOFT,
};

function AnimatedEmoji({ emoji, size = 20 }: { emoji: string; size?: number }) {
  const a = EMOJI_ANIM[emoji] ?? DEFAULT_ANIM;
  // La caja reserva ~45% más espacio que el glifo: el scale/rotate de la
  // animación nunca debe salirse ni recortarse, y overflow:visible en ambas
  // capas evita que un ancestro con overflow:hidden lo agrave.
  const box = Math.ceil(size * 1.45);
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: box, height: box, overflow: "visible" }}
    >
      <motion.span
        className="inline-block"
        style={{ fontSize: size, lineHeight: 1, overflow: "visible" }}
        animate={a.animate}
        transition={a.transition}
      >
        {emoji}
      </motion.span>
    </span>
  );
}

export function ContextHeader({ input }: { input: ContextHeaderInput }) {
  const [message, setMessage] = useState<ReturnType<typeof buildContextMessage> | null>(null);

  useEffect(() => {
    let avoid: { greetingKey?: string; subtitleKey?: string } = {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) avoid = JSON.parse(raw);
    } catch { /* localStorage no disponible — se ignora, no es crítico */ }
    const next = buildContextMessage(input, avoid);
    setMessage(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ greetingKey: next.greetingKey, subtitleKey: next.subtitleKey }));
    } catch { /* idem */ }
    // Solo se recalcula si cambian las señales de contexto reales — no en
    // cada render — así el mensaje se siente estable durante la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    input.role, input.name, input.hour, input.dow, input.isBirthdayToday,
    input.vacation.today, input.vacation.soonDays, input.vacation.returnedRecently,
    input.pendingCount, input.teamAllIn, input.allDone, input.isHoliday,
    input.othersBirthdayToday.join(","),
  ]);

  const dateLabel = useMemo(() => message?.dateLabel ?? "", [message]);

  if (!message) {
    // Fallback estático mientras el cliente hidrata (evita layout shift) —
    // usa el mismo saludo simple de siempre, sin animación todavía.
    return (
      <header className="pt-1">
        <p className="text-[12px] font-semibold text-text-3">&nbsp;</p>
        <h1 className="text-[24px] md:text-[27px] font-bold tracking-tight text-text-1" style={{ lineHeight: 1.35 }}>
          Hola, {input.name} 👋
        </h1>
        <p className="text-[13px] mt-0.5 text-text-3">&nbsp;</p>
      </header>
    );
  }

  return (
    <header className="pt-1">
      <p className="text-[12px] font-semibold text-text-3">{dateLabel}</p>
      <AnimatePresence mode="wait">
        <motion.div
          key={message.greetingKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <h1
            className="text-[24px] md:text-[27px] font-bold tracking-tight text-text-1 flex items-center gap-2"
            style={{ lineHeight: 1.35 }}
          >
            <span>{message.greetingText}</span> <AnimatedEmoji emoji={message.greetingEmoji} size={22} />
          </h1>
        </motion.div>
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.p
          key={message.subtitleKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut", delay: 0.05 }}
          className="text-[13px] mt-0.5 text-text-3 flex items-center gap-1.5"
        >
          <AnimatedEmoji emoji={message.subtitleEmoji} size={14} /> {message.subtitleText}
        </motion.p>
      </AnimatePresence>
    </header>
  );
}
