/**
 * Sonido sutil al recibir un mensaje — Web Audio API, sin archivos.
 * Sigue el mismo patrón que jornada-watcher.tsx.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Tono suave tipo "pop" — dos sinusoides cortos que imitan un mensaje entrante. */
export function playMessageReceived() {
  const c = getCtx();
  if (!c) return;
  try {
    const now = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.04, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    g.connect(c.destination);

    const o1 = c.createOscillator();
    o1.type = "sine";
    o1.frequency.value = 520;
    o1.start(now);
    o1.stop(now + 0.08);

    const o2 = c.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 680;
    o2.start(now + 0.06);
    o2.stop(now + 0.14);

    o1.connect(g);
    o2.connect(g);
  } catch { /* silencio */ }
}
