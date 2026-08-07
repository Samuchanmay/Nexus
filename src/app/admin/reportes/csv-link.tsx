// EMET · Export CSV data-URI — OBSOLETO (7 ago 2026).
//
// Unificación al ReportEngine (docs/audits/report-system-audit.md): todo
// export de EMET pasa por downloadReportXlsx() en src/lib/reports/* — nunca
// CSV, y nunca data-URIs armados a mano. Este componente ya no se importa
// en ningún módulo; se conserva como marcador para que el historial de git
// explique el porqué. Si algún día vuelve a necesitarse CSV, debe hacerse
// dentro del motor, no con un link suelto.
export {};
