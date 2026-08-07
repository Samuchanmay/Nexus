// ══════════════════════════════════════════════════════════════════
//  EMET · ReportEngine — motor único de exportación a Excel (.xlsx)
//  ══════════════════════════════════════════════════════════════════
//  Generalización de components/shared/xlsx-report.tsx: aquella versión
//  tenía HEADERS/COL_W/STATUS_COLORS fijos para el bloque semanal de
//  asistencia. Este archivo es el motor real que pide la auditoría de
//  Reportes (docs/audits/report-system-audit.md): TODO export de EMET
//  (Asistencia, Vacaciones, Pendientes por coordinación, Eventos por
//  persona, y cualquier botón "Exportar" suelto que quede en el sistema)
//  debe llamar a `downloadReportXlsx()` — nunca armar su propio workbook.
//
//  Reglas de formato exigidas por el usuario (7 ago 2026):
//   - Siempre .xlsx, nunca CSV.
//   - Encabezado institucional: título, periodo, fecha de generación,
//     filtros aplicados (con su valor real, "Todos" si no se filtró).
//   - Anchos de columna automáticos (se declaran por columna).
//   - Fechas dd/MM/yyyy, horas 12h "h:mm a.m./p.m.".
//   - Colores del design system de EMET (globals.css), nunca hex al azar.
//
//  Este archivo NO es un componente React — es el motor puro. Cada
//  pantalla de reporte (#5-#8 del plan) renderiza su propio botón y le
//  pasa un ReportWorkbookConfig; el motor no sabe nada de UI.
// ══════════════════════════════════════════════════════════════════
import { dmy, todayMerida } from "@/lib/tz";
import type { DateRange, ReportColumn, ReportWorkbookConfig } from "./types";

// ── Colores institucionales EMET (hex literal — ExcelJS no lee var(--…)) ──
// Fuente: src/app/globals.css, tema claro. Si esos hex cambian, actualizar
// aquí también (comentario de sincronización deliberado: son solo 4
// constantes, no vale la pena una build-step para leer CSS en Node).
export const EMET_XLSX_COLORS = {
  accent: "0066FF",
  ok: "2FB344",
  warn: "FF8A00",
  danger: "FF3B30",
  surface: "FFFFFF",
  surface2: "F0F0F2",
  text1: "1D1D1F",
} as const;

/** "Del 01/08/2026 al 07/08/2026" — o "01/08/2026" si from===to. */
export function buildPeriodLabel(range: DateRange): string {
  if (range.from === range.to) return dmy(range.from);
  return `Del ${dmy(range.from)} al ${dmy(range.to)}`;
}

/** "07/08/2026, 14:32" — fecha y hora de generación en Mérida. */
export function buildGeneratedAtLabel(d: Date = new Date()): string {
  const iso = todayMerida(d);
  const hm = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
  return `${dmy(iso)}, ${hm}`;
}

/** "HH:MM" o "HH:MM:SS" (24h) → "8:05 a.m." / "2:30 p.m.". `null`/`undefined`
 *  → cadena vacía (nunca inventa una hora que no existe). */
export function formatTime12h(time: string | null | undefined): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const suffix = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Convierte HEX (con o sin "#") a ARGB con alfa FF, formato que pide ExcelJS. */
function argb(hex: string): string {
  return "FF" + hex.replace("#", "").toUpperCase();
}

/** Aplica el formateador de columna al valor crudo de la fila. */
export function formatReportCell<T>(col: ReportColumn<T>, row: T): string | number {
  const raw = col.get(row);
  if (raw === null || raw === undefined) return "";
  switch (col.format) {
    case "date":
      return typeof raw === "string" && raw ? dmy(raw) : "";
    case "time12h":
      return typeof raw === "string" ? formatTime12h(raw) : "";
    case "hours":
      return typeof raw === "number" ? Number(raw.toFixed(2)) : raw;
    case "number":
      return raw;
    default:
      return raw;
  }
}

/**
 * Arma el workbook completo (encabezado institucional + resumen opcional +
 * tabla) para un reporte. Devuelve el ExcelJS.Workbook — el caller decide
 * si lo descarga (downloadReportXlsx) o lo adjunta a un correo (edge
 * function de envío automático, mismo motor, sin duplicar lógica).
 */
export async function buildReportWorkbook<T>(config: ReportWorkbookConfig<T>) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "EMET";
  wb.created = new Date();

  const sheetName = config.filenameBase.replace(/[:\\/?*[\]]/g, "").slice(0, 31) || "Reporte";
  const ws = wb.addWorksheet(sheetName);
  const colCount = config.columns.length;
  ws.columns = config.columns.map((c) => ({ width: c.width ?? 16 }));

  // ── Banda de título institucional ──
  const titleRow = ws.addRow([config.header.title]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, colCount);
  titleRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(EMET_XLSX_COLORS.accent) } };
    cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  titleRow.height = 26;

  // ── Metadatos: periodo, generado, filtros ──
  const meta = [
    `Periodo: ${config.header.periodLabel}`,
    `Generado: ${config.header.generatedAtLabel}`,
    `Filtros: ${config.header.appliedFilters.length
      ? config.header.appliedFilters.map((f) => `${f.label}: ${f.value}`).join(" · ")
      : "Todos"}`,
  ];
  for (const line of meta) {
    const row = ws.addRow([line]);
    ws.mergeCells(row.number, 1, row.number, colCount);
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(EMET_XLSX_COLORS.surface2) } };
      cell.font = { size: 10.5, color: { argb: argb(EMET_XLSX_COLORS.text1) } };
      cell.alignment = { horizontal: "left", vertical: "middle" };
    });
  }
  ws.addRow([]);

  // ── Tarjeta resumen opcional (Vacaciones, Eventos) ──
  if (config.summary?.length) {
    for (const item of config.summary) {
      const row = ws.addRow([item.label, item.value]);
      ws.mergeCells(row.number, 2, row.number, colCount);
      row.getCell(1).font = { bold: true, size: 10.5, color: { argb: argb(EMET_XLSX_COLORS.text1) } };
      row.getCell(2).font = { size: 10.5, color: { argb: argb(EMET_XLSX_COLORS.accent) } };
    }
    ws.addRow([]);
  }

  // ── Encabezados de columna ──
  const headerRow = ws.addRow(config.columns.map((c) => c.header));
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(EMET_XLSX_COLORS.surface2) } };
    cell.font = { bold: true, size: 10.5, color: { argb: argb(EMET_XLSX_COLORS.text1) } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // ── Filas de datos ──
  for (const row of config.rows) {
    const values = config.columns.map((c) => formatReportCell(c, row));
    const xlsxRow = ws.addRow(values);
    xlsxRow.eachCell((cell, colNumber) => {
      const col = config.columns[colNumber - 1];
      cell.alignment = { horizontal: col.align ?? "center", vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFF1F5F9" } } };
      const tint = col.tint?.(row);
      if (tint) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(tint.bg) } };
        cell.font = { bold: true, size: 10, color: { argb: argb(tint.fg) } };
      }
    });
  }

  return wb;
}

/** Arma el workbook y dispara la descarga en el navegador. Único punto de
 *  descarga de Excel en todo EMET — cualquier botón "Exportar" debe llamar
 *  esta función (o buildReportWorkbook si necesita el buffer para otra
 *  cosa, ej. adjuntar a un correo desde una edge function). */
export async function downloadReportXlsx<T>(config: ReportWorkbookConfig<T>): Promise<void> {
  const wb = await buildReportWorkbook(config);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${config.filenameBase}-${todayMerida()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
