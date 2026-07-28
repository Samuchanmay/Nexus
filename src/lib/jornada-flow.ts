// ══════════════════════════════════════════════════════════
//  NEXUS · Motor de Registro de Jornada (antes "Check-in")
//  · Máquina de estados: el colaborador SIEMPRE está en un único
//    estado (sin_iniciar / trabajando / temporal(X) / finalizada).
//  · La pantalla nunca pregunta "¿entrada o salida?" — este módulo
//    ya calculó, a partir de los movimientos de HOY, cuál es la
//    única acción con sentido (o la lista ordenada de acciones
//    válidas cuando hay más de una).
//  · Los estados "temporales" (Comida, Diligencia, Consulta médica,
//    Permiso temporal, Pendientes...) son 100% configurables desde
//    la tabla jornada_states (Configuración → Estados de Jornada) —
//    agregar uno nuevo (ej. "Capacitación") es una fila nueva, no
//    código nuevo. "Iniciar jornada" y "Finalizar jornada" son
//    estructurales (abren/cierran el día) y por eso NO viven en esa
//    tabla — son las dos únicas excepciones, a propósito.
//  · Los valores de `reason` (motivo) son EXACTAMENTE los que ya
//    usa attendance.reason y valida la Edge Function `fichar` —
//    nunca se inventan valores nuevos aquí, solo se decide cuáles
//    mostrar y en qué orden.
// ══════════════════════════════════════════════════════════
import type { AttendanceReason, AttendanceRow } from "./types";
import { nowMeridaMinutes, todayMerida } from "./tz";

export const ACCION_INICIAR_ID: AttendanceReason = "Entrada a trabajo";
export const ACCION_FIN_ID: AttendanceReason = "Fin de jornada";

/** Fila de jornada_states, con las columnas nuevas (todas opcionales —
 *  un estado sin motivo_salida configurado simplemente no genera tarjeta). */
export interface JornadaStateDef {
  nombre: string;
  activo: boolean;
  emoji: string | null;
  motivo_salida: AttendanceReason | null;
  motivo_regreso: AttendanceReason | null;
  label_salida: string | null;
  label_regreso: string | null;
  desc_salida: string | null;
  desc_regreso: string | null;
  limite_salida: number | null;
  prioridad_manana: number | null;
  prioridad_mediodia: number | null;
  prioridad_tarde: number | null;
}

export interface AccionJornada {
  id: AttendanceReason;
  emoji: string;
  titulo: string;
  descripcion: string;
}

export type EstadoJornada =
  | { kind: "sin_iniciar" }
  | { kind: "trabajando" }
  | { kind: "temporal"; nombre: string }
  | { kind: "finalizada" };

export type Momento = "inicio" | "durante" | "cierre" | "finalizada";

export interface ContextoJornada {
  estado: EstadoJornada;
  acciones: AccionJornada[];
  /** id de la acción preseleccionada — solo cuando hay EXACTAMENTE una
   *  acción válida (spec: nunca se preselecciona entre varias opciones). */
  preseleccionId: AttendanceReason | null;
  momento: Momento;
}

type Franja = "manana" | "mediodia" | "tarde";

/** <11:00 mañana · 11:00–15:59 mediodía · ≥16:00 tarde. Interpolación propia
 *  entre las 3 franjas de ejemplo del spec (antes de 11:00 / 12:00–15:30 /
 *  después de 17:00), que dejaba huecos sin cubrir. */
function franjaDe(minutosDelDia: number): Franja {
  const hora = Math.floor(minutosDelDia / 60);
  if (hora < 11) return "manana";
  if (hora < 16) return "mediodia";
  return "tarde";
}

function prioridadDe(def: JornadaStateDef, f: Franja): number {
  const p = f === "manana" ? def.prioridad_manana : f === "mediodia" ? def.prioridad_mediodia : def.prioridad_tarde;
  return p ?? 99;
}

/** Prioridad de "Finalizar jornada" en cada franja — la única acción
 *  estructural que participa del mismo orden que las de jornada_states. */
function prioridadFin(f: Franja): number {
  return f === "tarde" ? 1 : 6;
}

/**
 * Resuelve TODO el contexto de la pantalla de Registro de Jornada a partir
 * de los movimientos de HOY. Pura (sin acceso a red/DB) — se llama con los
 * datos ya cargados, para poder correr tanto en el server component (antes
 * de renderizar, sin parpadeos) como, en su día, en la Edge Function para
 * validar server-side que la acción pedida de verdad es válida.
 */
export function resolverContextoJornada(
  rows: AttendanceRow[],
  states: JornadaStateDef[],
  now: Date = new Date(),
): ContextoJornada {
  const hoy = todayMerida(now);
  const dia = rows.filter((r) => r.date === hoy).sort((a, b) => a.time.localeCompare(b.time));
  const minutos = nowMeridaMinutes(now);
  const f = franjaDe(minutos);

  const yaInicio = dia.some((r) => r.type === "Entrada" && r.reason === ACCION_INICIAR_ID);
  if (!yaInicio) {
    const accion: AccionJornada = {
      id: ACCION_INICIAR_ID, emoji: "🟢", titulo: "Iniciar jornada", descripcion: "Comenzar mi día laboral.",
    };
    return { estado: { kind: "sin_iniciar" }, acciones: [accion], preseleccionId: accion.id, momento: "inicio" };
  }

  const finRow = dia.find((r) => r.type === "Salida" && r.reason === ACCION_FIN_ID);
  if (finRow) {
    return { estado: { kind: "finalizada" }, acciones: [], preseleccionId: null, momento: "finalizada" };
  }

  const last = dia[dia.length - 1];
  const estadoTemporalDef = last.type === "Salida" ? states.find((s) => s.motivo_salida === last.reason) : undefined;

  if (estadoTemporalDef && estadoTemporalDef.motivo_regreso) {
    // En un estado temporal (Comida, Diligencia, ...): única acción posible,
    // preseleccionada — jamás mostrar ninguna otra tarjeta aquí.
    const accion: AccionJornada = {
      id: estadoTemporalDef.motivo_regreso,
      emoji: estadoTemporalDef.emoji ?? "↩️",
      titulo: estadoTemporalDef.label_regreso ?? `Regresar de ${estadoTemporalDef.nombre.toLowerCase()}`,
      descripcion: estadoTemporalDef.desc_regreso ?? "Volver a la oficina.",
    };
    return {
      estado: { kind: "temporal", nombre: estadoTemporalDef.nombre },
      acciones: [accion], preseleccionId: accion.id, momento: "durante",
    };
  }

  // Trabajando: listar salidas disponibles (activas, dentro de su límite
  // diario) + Finalizar jornada, ordenadas por prioridad de la franja actual.
  const usosHoy = new Map<string, number>();
  for (const r of dia) if (r.type === "Salida") usosHoy.set(r.reason, (usosHoy.get(r.reason) ?? 0) + 1);

  const candidatas: { accion: AccionJornada; prioridad: number }[] = [];
  for (const def of states) {
    if (!def.activo || !def.motivo_salida) continue;
    const usos = usosHoy.get(def.motivo_salida) ?? 0;
    if (def.limite_salida !== null && usos >= def.limite_salida) continue; // agotada por hoy — desaparece, no se deshabilita
    candidatas.push({
      accion: {
        id: def.motivo_salida, emoji: def.emoji ?? "🚪",
        titulo: def.label_salida ?? def.nombre, descripcion: def.desc_salida ?? "",
      },
      prioridad: prioridadDe(def, f),
    });
  }
  candidatas.push({
    accion: { id: ACCION_FIN_ID, emoji: "🏁", titulo: "Finalizar jornada", descripcion: "Cerrar tu día laboral." },
    prioridad: prioridadFin(f),
  });

  candidatas.sort((a, b) => a.prioridad - b.prioridad);
  const acciones = candidatas.map((c) => c.accion);
  const preseleccionId = acciones.length === 1 ? acciones[0].id : null;
  const sugerida = preseleccionId ?? acciones[0]?.id ?? null;
  const momento: Momento = sugerida === ACCION_FIN_ID ? "cierre" : "durante";

  return { estado: { kind: "trabajando" }, acciones, preseleccionId, momento };
}
