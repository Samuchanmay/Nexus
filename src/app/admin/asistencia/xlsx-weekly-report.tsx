// EMET · Re-export de los tipos WeekBlock/DayDetail para la vista "Semana"
// de /admin/asistencia.
//
// El botón XlsxWeeklyReportButton que vivía aquí fue eliminado el 7 ago 2026
// (unificación al ReportEngine, docs/audits/report-system-audit.md): el
// export de asistencia ahora lo hace downloadReportXlsx() con el motor único
// (src/lib/reports/*). Este archivo conserva solo el re-export de tipos que
// la UI sigue necesitando; no arma ningún workbook.
export type { WeekBlock, DayDetail } from "@/components/shared/xlsx-report";
