// ══════════════════════════════════════════════════════════
//  EMU · Reglas — Fase 1, sin IA (ver EMU-ARQUITECTURA.md §3).
//  Cada regla es una función pura: (contexto) → candidato | null.
//  Nunca hace red, nunca decide POR SÍ SOLA si se muestra — eso
//  es trabajo del Decision Engine, que puede tener varias reglas
//  aplicando a la vez y solo deja pasar una.
//
//  Nota deliberada: "no has registrado tu salida" — la regla que
//  EMU-ARQUITECTURA.md proponía como primera candidata — NO se
//  implementa aquí. Ya existe, completa y probada, en
//  JornadaWatcher (recordatorios a 30/60/120 min + diálogo de
//  jornada pendiente). Duplicarla como regla de EMU con su propio
//  texto y temporización sería confundir al usuario con dos
//  sistemas distintos avisando lo mismo. Fase 1 de EMU cubre
//  terreno que hoy NO tiene ningún aviso propio.
// ══════════════════════════════════════════════════════════
import type { EmuContext, EmuCandidate, EmuRule } from "./types";

/** Tono EMU (ver crítica del usuario, punto 5 "personalidad"): nunca un
 *  saludo, nunca relleno — un hecho corto y, si aplica, una acción. */

const solicitudesPendientes: EmuRule = (ctx: EmuContext): EmuCandidate | null => {
  const n = ctx.pendingRequestsCount;
  if (n === null || n === 0) return null;
  return {
    id: "solicitudes-pendientes",
    priority: n >= 5 ? "critical" : "high",
    tone: "neutral",
    message: n === 1 ? "Hay una solicitud por revisar." : `Hay ${n} solicitudes por revisar.`,
    ctaLabel: "Ver solicitudes",
    ctaHref: "/admin/solicitudes",
  };
};

/** Presencia silenciosa (crítica del usuario, punto 6): EMU también aparece
 *  cuando algo salió BIEN, no solo cuando hay que corregir algo. Baja
 *  prioridad a propósito — nunca compite con una regla accionable. */
const jornadaCompletaATiempo: EmuRule = (ctx: EmuContext): EmuCandidate | null => {
  const j = ctx.jornada;
  if (!j || j.isOpen || !j.hasWorkedToday || !j.metTarget) return null;
  return {
    id: "jornada-completa-a-tiempo",
    priority: "low",
    tone: "positive",
    message: "Registraste tu jornada completa hoy, a tiempo.",
  };
};

export const EMU_RULES_FASE1: EmuRule[] = [
  solicitudesPendientes,
  jornadaCompletaATiempo,
];
