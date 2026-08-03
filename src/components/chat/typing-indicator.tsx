"use client";

/** Tres puntos animados del indicador "está escribiendo…" (spec chat §1:
    micro-animaciones 120–220ms, ease-out). Los puntos hacen una pequeña
    ondulación escalonada — no es un texto, no parpadea: ondula. */
export function TypingDots() {
  const dot = (delay: string) => ({
    width: 3,
    height: 3,
    borderRadius: 999,
    background: "currentColor",
    animation: `nx-typing-dot 1.2s ease-in-out ${delay} infinite`,
  } as const);
  return (
    <span className="inline-flex items-center gap-[2px] ml-1" aria-hidden>
      <span style={dot("0ms")} />
      <span style={dot(".15s")} />
      <span style={dot(".3s")} />
    </span>
  );
}
