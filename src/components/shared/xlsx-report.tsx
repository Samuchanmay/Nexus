// EMET · Tipos del bloque semanal de asistencia (WeekBlock/DayDetail).
//
// OBSOLETO como mecanismo de exportación: el builder de Excel que vivía
// aquí (XlsxReportButton) fue generalizado en src/lib/reports/xlsx-builder.ts
// (ReportEngine, 7 ago 2026, docs/audits/report-system-audit.md) — todo
// export de EMET pasa por downloadReportXlsx()/buildReportWorkbook().
// Este archivo conserva SOLO los tipos que todavía usa la vista "Semana"
// de /admin/asistencia para su desglose día a día en pantalla; no exporta
// nada al navegador.

export interface DayDetail {
  dayLabel: string;
  date: string; // YYYY-MM-DD
  entrada: string | null;
  salida1: string | null;
  entrada2: string | null;
  salidaFinal: string | null;
  horasTrabajadas: number | null;
  horasExtra: number | null;
  /** Motivo de ausencia (Vacaciones/Incapacidad/Permiso/…) cuando no hubo entrada. */
  statusLabel?: string;
}

export interface WeekBlock {
  userId: string;
  name: string;
  color: string;
  weekStart: string; // lunes, YYYY-MM-DD
  weekLabel: string;  // "29 junio al 04 de julio"
  days: DayDetail[];  // Lunes..Viernes
}
