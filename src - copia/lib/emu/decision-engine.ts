// ══════════════════════════════════════════════════════════
//  EMU · Decision Engine — recibe todos los candidatos que las
//  reglas produjeron para este contexto y decide UNO (crítica del
//  usuario, punto 3: "no puedes mostrar seis banners, necesitas
//  decidir"). También aplica la memoria mínima de Fase 1 (punto 4):
//  si una regla lleva ≥3 veces ignorada, se lo marca a la Surface
//  para que ofrezca automatizar el recordatorio.
// ══════════════════════════════════════════════════════════
import type { EmuCandidate, EmuDecision } from "./types";
import { PRIORITY_RANK } from "./types";

const AUTO_REMIND_THRESHOLD = 3;

export function decide(
  candidates: (EmuCandidate | null)[],
  ignoreCounts: Record<string, number> = {},
): EmuDecision | null {
  const valid = candidates.filter((c): c is EmuCandidate => c !== null);
  if (valid.length === 0) return null;

  // Prioridad más alta gana; en empate, la primera regla en orden de
  // declaración (EMU_RULES_FASE1) — el orden ahí ya refleja qué se
  // considera más relevante a igualdad de prioridad.
  const winner = valid.reduce((best, c) =>
    PRIORITY_RANK[c.priority] > PRIORITY_RANK[best.priority] ? c : best
  );

  return {
    ...winner,
    offerAutoRemind: (ignoreCounts[winner.id] ?? 0) >= AUTO_REMIND_THRESHOLD,
  };
}

/** Surface abstraction (crítica del usuario, punto "lo que cambiaría
 *  completamente"): la regla/decisión nunca dice "banner" o "toast" —
 *  solo describe prioridad y tono. Esta función es la única que traduce
 *  eso a un tipo de superficie visual. Fase 1 solo renderiza "banner"
 *  (ver EMU-ARQUITECTURA.md Fase 2 para tarjeta/toast) — existe ya para
 *  que agregar las otras superficies después no toque ninguna regla. */
export type EmuSurfaceKind = "banner" | "toast" | "card";

export function resolveSurface(decision: EmuDecision): EmuSurfaceKind {
  if (decision.priority === "critical" || decision.priority === "high") return "banner";
  if (decision.tone === "positive") return "toast";
  return "card";
}
