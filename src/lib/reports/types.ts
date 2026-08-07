// ══════════════════════════════════════════════════════════════════
//  EMET · Reportes — tipos compartidos del ReportEngine
//  ══════════════════════════════════════════════════════════════════
//  Rediseño del módulo de Reportes (7 ago 2026, ver docs/audits/
//  report-system-audit.md). Antes cada pantalla (admin/reportes,
//  admin/asistencia, /rh, admin/vacaciones, admin/proyectos) tenía su
//  propio "shape" de filtros y su propia forma de armar el Excel. Este
//  archivo es el único vocabulario compartido: los 4 reportes
//  (Asistencia, Vacaciones, Pendientes por coordinación, Eventos por
//  persona) y el DateRangeFilter único lo usan sin reinventarlo.
// ══════════════════════════════════════════════════════════════════

/**
 * Filtros rápidos de fecha — únicos para TODO el sistema (asistencia,
 * vacaciones, actividades, eventos, reportes, personas, etc.). No existe
 * "año pasado" a propósito (decisión del usuario, 7 ago 2026): con 9
 * presets alcanza para el uso real; lo demás se cubre con "Rango
 * personalizado", que NO tiene límite artificial de tamaño.
 */
export type DateRangePreset =
  | "hoy"
  | "ayer"
  | "esta_semana"
  | "semana_pasada"
  | "esta_quincena"
  | "quincena_pasada"
  | "este_mes"
  | "mes_pasado"
  | "este_anio"
  | "personalizado";

export const DATE_PRESET_ORDER: DateRangePreset[] = [
  "hoy", "ayer",
  "esta_semana", "semana_pasada",
  "esta_quincena", "quincena_pasada",
  "este_mes", "mes_pasado",
  "este_anio",
];

export const DATE_PRESET_LABELS: Record<DateRangePreset, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  esta_semana: "Esta semana",
  semana_pasada: "Semana pasada",
  esta_quincena: "Esta quincena",
  quincena_pasada: "Quincena pasada",
  este_mes: "Este mes",
  mes_pasado: "Mes pasado",
  este_anio: "Este año",
  personalizado: "Rango personalizado",
};

/** Rango de fechas resuelto — siempre ISO "YYYY-MM-DD", inclusivo. */
export interface DateRange {
  from: string;
  to: string;
}

/** Selección de fecha tal como la guarda el DateRangeFilter (preset + rango
 *  ya resuelto, para no recalcular el preset en cada consumidor). */
export interface DateFilterValue {
  preset: DateRangePreset;
  range: DateRange;
}

/** Bolsa genérica de filtros combinables por reporte. Cada reporte declara
 *  cuáles de estas llaves usa realmente (ver comentario en cada motor) —
 *  el tipo es común para que el DateRangeFilter y la barra de filtros de
 *  /admin/reportes no necesiten un shape distinto por pestaña. */
export interface ReportFilters {
  date: DateFilterValue;
  employeeId?: string | null;
  departmentId?: string | null;
  status?: string | null;
  /** Vacaciones: filtra por año calendario (independiente del rango de
      fecha, porque "Días asignados/usados" se piensa por año, no por
      rango arbitrario). */
  year?: number | null;
  /** Eventos: responsable principal vs. participante — son roles distintos
      de la misma persona sobre el mismo evento. */
  responsibleId?: string | null;
  participantId?: string | null;
  eventType?: string | null;
}

/** Una columna del reporte tabular — el builder de Excel y (a futuro)
 *  cualquier vista HTML/print consumen esta misma definición, así no hay
 *  dos listas de columnas que puedan desincronizarse. */
export interface ReportColumn<T> {
  header: string;
  /** Ancho de columna en Excel (unidades ExcelJS ~= caracteres). */
  width?: number;
  align?: "left" | "center" | "right";
  format?: "text" | "date" | "time12h" | "number" | "hours";
  get: (row: T) => string | number | null | undefined;
  /** Color semántico de la celda según el valor de la fila (ej. "Vacaciones"
      lila, "Falta injustificada" rojo) — mismo criterio que STATUS_COLORS
      de xlsx-report.tsx, ahora parametrizable por reporte en vez de fijo. */
  tint?: (row: T) => { bg: string; fg: string } | undefined;
}

/** Encabezado institucional que debe aparecer en TODO export — literal
 *  para que el archivo, aunque se abra fuera de EMET, se entienda solo. */
export interface ReportHeaderInfo {
  title: string;
  /** "Del 01/08/2026 al 07/08/2026" — ya formateado dd/MM/yyyy. */
  periodLabel: string;
  /** "07/08/2026, 14:32" — fecha y hora de generación, dd/MM/yyyy + 24h. */
  generatedAtLabel: string;
  /** Nombre de quien genera el reporte (operador logueado) — aparece en el
      encabezado institucional como "Generado por: …". El archivo debe
      responder "quién lo generó", no solo cuándo. */
  generatedByLabel: string;
  /** Cada filtro aplicado como {label, value} — value = "Todos" si no se
      filtró por esa dimensión. Ej: {label:"Departamento", value:"Todos"}. */
  appliedFilters: { label: string; value: string }[];
}

export interface ReportWorkbookConfig<T> {
  header: ReportHeaderInfo;
  columns: ReportColumn<T>[];
  rows: T[];
  /** Nombre de hoja/archivo base (sin fecha ni extensión). */
  filenameBase: string;
  /** Filas de resumen opcionales (tarjeta resumen) — se insertan arriba de
      la tabla cuando el reporte las define (Vacaciones, Eventos). */
  summary?: { label: string; value: string | number }[];
}

// ────────────────────────────────────────────────────────────────────
//  Comparación de periodos — NO IMPLEMENTADO todavía (decisión del
//  usuario, 7 ago 2026: "más adelante, sin refactor grande"). Este tipo
//  existe solo para que el shape de ReportFilters/engine ya tenga un
//  lugar reservado — nada lo lee ni lo escribe hoy. Cuando se implemente:
//  agregar `comparison?: ReportComparisonConfig | null` a ReportFilters
//  y una segunda pasada de datos en cada motor (mismo shape de fila,
//  segunda columna "vs. periodo anterior").
// ────────────────────────────────────────────────────────────────────
export interface ReportComparisonConfig {
  enabled: boolean;
  baseline: DateRange;
  compareTo: DateRange;
}
