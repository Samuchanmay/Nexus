// ══════════════════════════════════════════════════════════════════
//  EMET · ReportEngine — motor único de exportación a Excel (.xlsx)
//  ══════════════════════════════════════════════════════════════════
//  Generalización de components/shared/xlsx-report.tsx: aquella versión
//  tenía HEADERS/COL_W/STATUS_COLORS fijos para el bloque semanal de
//  asistencia. Este archivo es el motor real que pide la auditoría de
//  Reportes (docs/audits/report-system-audit.md): TODO export de EMET
//  (Asistencia, Vacaciones, Pendientes por coordinación, Eventos por
//  persona, Actividades, y cualquier botón "Exportar" suelto que quede
//  en el sistema) debe llamar a `downloadReportXlsx()` — nunca armar su
//  propio workbook.
//
//  Estándar de documento (auditoría de exportaciones, 7 ago 2026):
//   - Siempre .xlsx, nunca CSV.
//   - Encabezado institucional: título, periodo, generado por, fecha de
//     generación y filtros aplicados (con su valor real, "Todos" si no).
//   - Filas alternadas (banded rows) + bordes de cuadrícula completos.
//   - Anchos de columna automáticos según el contenido real.
//   - Fechas como fecha real dd/mm/yyyy, horas 12h "h:mm a.m./p.m.",
//     números y horas con formato numérico real.
//   - Configuración de impresión: horizontal, ajusta a 1 página de ancho,
//     repite el encabezado de tabla en cada página, pie de página
//     "Página X de N", sin rejilla, encabezado congelado.
//   - Colores del design system de EMET (globals.css), nunca hex al azar.
//
//  Este archivo NO es un componente React — es el motor puro. Cada
//  pantalla de reporte renderiza su propio botón y le pasa un
//  ReportWorkbookConfig; el motor no sabe nada de UI.
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

/** Rejilla de datos — borde fino en todos los lados (le da "tabla" al
 *  documento impreso sin gritar). */
const GRID_BORDER = {
  top: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
  left: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
  right: { style: "thin" as const, color: { argb: "FFE2E8F0" } },
};

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

function solidFill(hex: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: argb(hex) } };
}

/** "2026-08-07" → Date a mediodía local (evita desfase de zona horaria al
 *  serializar con ExcelJS; con numFmt dd/mm/yyyy la hora no se ve). */
function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Aplica el formateador de columna al valor crudo de la fila — valor de
 *  VISTA (HTML/print). Para Excel ver `excelValue` (fechas/números reales). */
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

/** Valor que se escribe en Excel: fecha real con numFmt, horas y números con
 *  formato numérico — no cadenas "crudas". El caller (buildReportWorkbook)
 *  aplica `numFmt` sobre la celda. */
function excelValue<T>(col: ReportColumn<T>, row: T): { value: string | number | Date; numFmt?: string } {
  const raw = col.get(row);
  if (raw === null || raw === undefined) return { value: "" };
  switch (col.format) {
    case "date": {
      const d = typeof raw === "string" ? isoToDate(raw) : null;
      return d ? { value: d, numFmt: "dd/mm/yyyy" } : { value: "" };
    }
    case "hours":
      return { value: Number(raw), numFmt: "0.00" };
    case "number":
      return { value: Number(raw), numFmt: "#,##0.##" };
    case "time12h":
      return { value: typeof raw === "string" ? formatTime12h(raw) : "" };
    default:
      return { value: raw as string | number };
  }
}

/** Longitud visible del valor (para el cálculo de ancho automático). */
function displayLength<T>(col: ReportColumn<T>, row: T): number {
  const raw = col.get(row);
  if (raw === null || raw === undefined) return 0;
  switch (col.format) {
    case "date": return 10; // dd/mm/yyyy
    case "time12h": return formatTime12h(raw as string).length;
    case "hours": return Number(raw).toFixed(2).length;
    case "number": return String(raw).length;
    default: return String(raw).length;
  }
}

function cellAlign<T>(col: ReportColumn<T>): "left" | "center" | "right" {
  if (col.align) return col.align;
  return col.format === "hours" || col.format === "number" ? "right" : "center";
}

/** "A", "B", …, "Z", "AA"… — para printArea. */
function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
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
  ws.columns = config.columns.map((c) => ({ width: c.width ?? 14 }));

  // ── Banda de título institucional ──
  const titleRow = ws.addRow([config.header.title]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, colCount);
  titleRow.eachCell((cell) => {
    cell.fill = solidFill(EMET_XLSX_COLORS.accent);
    cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  titleRow.height = 26;

  // ── Metadatos: periodo, generado por, generado, filtros ──
  const meta = [
    `Periodo: ${config.header.periodLabel}`,
    `Generado por: ${config.header.generatedByLabel}`,
    `Generado: ${config.header.generatedAtLabel}`,
    `Filtros: ${config.header.appliedFilters.length
      ? config.header.appliedFilters.map((f) => `${f.label}: ${f.value}`).join(" · ")
      : "Todos"}`,
  ];
  for (const line of meta) {
    const row = ws.addRow([line]);
    ws.mergeCells(row.number, 1, row.number, colCount);
    row.eachCell((cell) => {
      cell.fill = solidFill(EMET_XLSX_COLORS.surface2);
      cell.font = { size: 10.5, color: { argb: argb(EMET_XLSX_COLORS.text1) } };
      cell.alignment = { horizontal: "left", vertical: "middle" };
    });
  }
  ws.addRow([]);

  // ── Tarjeta resumen opcional (Vacaciones, Eventos, Actividades) ──
  if (config.summary?.length) {
    for (const item of config.summary) {
      const row = ws.addRow([item.label, item.value]);
      ws.mergeCells(row.number, 2, row.number, colCount);
      row.getCell(1).font = { bold: true, size: 10.5, color: { argb: argb(EMET_XLSX_COLORS.text1) } };
      row.getCell(2).font = { bold: true, size: 10.5, color: { argb: argb(EMET_XLSX_COLORS.accent) } };
    }
    ws.addRow([]);
  }

  // ── Encabezados de columna ──
  const headerRow = ws.addRow(config.columns.map((c) => c.header));
  headerRow.eachCell((cell) => {
    cell.fill = solidFill(EMET_XLSX_COLORS.surface2);
    cell.font = { bold: true, size: 10.5, color: { argb: argb(EMET_XLSX_COLORS.text1) } };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF94A3B8" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  headerRow.height = 20;

  // ── Filas de datos (banded rows + rejilla + formatos reales) ──
  let lastDataRow = headerRow.number;
  config.rows.forEach((row, idx) => {
    const banded = idx % 2 === 1; // filas alternadas: par=blanco, impar=surface2
    const xlsxRow = ws.addRow(config.columns.map((c) => excelValue(c, row).value));
    xlsxRow.eachCell((cell, colNumber) => {
      const col = config.columns[colNumber - 1];
      const tint = col.tint?.(row);
      cell.border = GRID_BORDER;
      cell.alignment = { horizontal: cellAlign(col), vertical: "middle" };
      if (tint) {
        cell.fill = solidFill(tint.bg);
        cell.font = { bold: true, size: 10, color: { argb: argb(tint.fg) } };
      } else {
        if (banded) cell.fill = solidFill(EMET_XLSX_COLORS.surface2);
        cell.font = { size: 10, color: { argb: argb(EMET_XLSX_COLORS.text1) } };
      }
      const fmt = excelValue(col, row).numFmt;
      if (fmt) cell.numFmt = fmt;
    });
    lastDataRow = xlsxRow.number;
  });

  // ── Anchos automáticos (mínimo el declarado, máx 50) ──
  for (let i = 0; i < colCount; i++) {
    const col = config.columns[i];
    let max = col.header.length;
    for (const row of config.rows) {
      const len = displayLength(col, row);
      if (len > max) max = len;
    }
    ws.getColumn(i + 1).width = Math.min(50, Math.max(col.width ?? 14, max + 2));
  }

  // ── Impresión correcta: horizontal, ajusta a 1 hoja de ancho, repite el
  //    encabezado de tabla, pie con numeración, sin rejilla, header congelado ──
  ws.pageSetup.orientation = "landscape";
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.horizontalCentered = true;
  ws.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };
  ws.pageSetup.printArea = `A1:${colLetter(colCount)}${lastDataRow}`;
  ws.pageSetup.printTitlesRow = `${headerRow.number}:${headerRow.number}`;
  ws.views = [{ state: "frozen", ySplit: headerRow.number, showGridLines: false }];
  ws.headerFooter.oddFooter = `&L&"Calibri,Bold"EMET&"Calibri,Regular" · ${config.header.title}  &R Página &P de &N`;

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
