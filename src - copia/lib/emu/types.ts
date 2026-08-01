// ══════════════════════════════════════════════════════════
//  EMU · Tipos base — capa de inteligencia contextual de Nexus
//  Fase 1: motor de reglas deterministas, sin LLM (ver
//  EMU-ARQUITECTURA.md). Context Engine → Decision Engine →
//  Surface. La UI (Banner/Toast/Card) nunca decide POR SÍ SOLA
//  qué mostrar — solo recibe una EmuDecision ya resuelta.
// ══════════════════════════════════════════════════════════

export type EmuPriority = "critical" | "high" | "medium" | "low";

/** Orden de prioridad, mayor primero — usado por el Decision Engine para
 *  elegir un único ganador cuando varias reglas aplican a la vez. */
export const PRIORITY_RANK: Record<EmuPriority, number> = {
  critical: 3, high: 2, medium: 1, low: 0,
};

/** Objeto de contexto único (Context Engine). Cada regla lee de aquí — nunca
 *  hace su propia consulta a Supabase. Mantiene a EMU desacoplado de cómo se
 *  obtienen los datos y hace que las reglas sean funciones puras, testeables
 *  sin red. Fase 1 trae solo las señales que las reglas actuales usan; se
 *  amplía módulo por módulo (Documentos, Calendario, Proyectos…) en fases
 *  futuras, nunca todo de golpe. */
export interface EmuContext {
  userId: string;
  role: string;
  /** Fecha de hoy en la zona horaria de la organización (America/Merida). */
  today: string;
  /** null si el rol no ficha (no aplica, no "sin datos"). */
  jornada: { isOpen: boolean; hasWorkedToday: boolean; metTarget: boolean } | null;
  /** null si el rol no tiene bandeja de solicitudes real todavía (ver
   *  app-shell.tsx HREF — hoy solo "admin" tiene una ruta funcional). */
  pendingRequestsCount: number | null;
}

/** Lo que devuelve una regla cuando aplica. Sin lenguaje generado — el
 *  texto vive en la regla misma, escrito a mano, corto y sin saludos
 *  (tono Apple/Linear/Signal: nunca "Hola Samuel, espero que…"). */
export interface EmuCandidate {
  /** Estable entre días — es la clave de memoria (cuántas veces se ignoró). */
  id: string;
  priority: EmuPriority;
  tone: "critical" | "positive" | "neutral";
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface EmuDecision extends EmuCandidate {
  /** true cuando esta regla lleva ≥3 veces ignorada — memoria mínima de
   *  Fase 1 (ver crítica del usuario: "falta memoria"). El Decision Engine
   *  la marca; la Surface decide cómo ofrecerlo (Fase 1: un CTA extra). */
  offerAutoRemind?: boolean;
}

export type EmuRule = (ctx: EmuContext) => EmuCandidate | null;
