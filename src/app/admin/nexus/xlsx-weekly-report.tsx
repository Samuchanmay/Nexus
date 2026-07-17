"use client";
// NEXUS · Descarga del reporte semanal de asistencia en Excel real (.xlsx),
// agrupado por empleado y semana — mismo formato que el checador legado
// (Control_Asistencias_Semanal): un bloque de color por persona, con
// Día/Fecha/Hora Entrada/Hora Salida/Hora Entrada/Hora Salida/Horas
// Trabajadas/Horas Extra/Comentarios. Los colores de cada bloque usan el
// mismo nexus_color asignado a esa persona en el resto de la app.
import { useState } from "react";
import { logAdminAction } from "@/lib/admin-log";
import { createClient } from "@/lib/supabase/client";
import { IconDownload } from "@/components/icons";

export interface DayDetail {
  dayLabel: string;
  date: string; // YYYY-MM-DD
  entrada: string | null;
  salida1: string | null;
  entrada2: string | null;
  salidaFinal: string | null;
  horasTrabajadas: number | null;
  horasExtra: number | null;
}

export interface WeekBlock {
  userId: string;
  name: string;
  color: string;
  weekStart: string; // lunes, YYYY-MM-DD — usado para ordenar/agrupar
  weekLabel: string;  // "29 junio al 04 de julio"
  days: DayDetail[];  // Lunes..Sábado
}

const HEADERS = ["Día", "Fecha", "Hora Entrada", "Hora Salida", "Hora Entrada", "Hora Salida", "Horas Trabajadas", "Horas Extra", "Comentarios"];
const COL_W = [11, 12, 13, 13, 13, 13, 15, 11, 26];

/** Aclara un color hex hacia blanco (amount 0..1) — para el fondo del renglón "Semana …". */
function tintHex(hex: string, amount: number): string {
  const h = (hex || "#5856D6").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 88;
  const g = parseInt(full.slice(2, 4), 16) || 86;
  const b = parseInt(full.slice(4, 6), 16) || 214;
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return [mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
function solidHex(hex: string): string {
  const h = (hex || "#5856D6").replace("#", "");
  return (h.length === 3 ? h.split("").map((c) => c + c).join("") : h).toUpperCase();
}

export function XlsxWeeklyReportButton({ blocks, adminId }: { blocks: WeekBlock[]; adminId: string }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (blocks.length === 0) return;
    setBusy(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Nexus";
      wb.created = new Date();

      const byWeek = new Map<string, WeekBlock[]>();
      for (const b of blocks) {
        const arr = byWeek.get(b.weekStart) ?? [];
        arr.push(b);
        byWeek.set(b.weekStart, arr);
      }
      const weeks = [...byWeek.keys()].sort((a, b) => b.localeCompare(a));

      for (const wk of weeks) {
        const empBlocks = byWeek.get(wk)!;
        const rawName = `Semana ${wk}`;
        const sheetName = rawName.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
        const ws = wb.addWorksheet(sheetName);
        ws.columns = COL_W.map((w) => ({ width: w }));

        for (const emp of empBlocks) {
          const titleRowIdx = ws.rowCount + 1;
          const titleRow = ws.addRow([`Semana (${emp.weekLabel})`]);
          ws.mergeCells(titleRowIdx, 1, titleRowIdx, HEADERS.length);
          titleRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + tintHex(emp.color, 0.72) } };
            cell.font = { bold: true, size: 11, color: { argb: "FF1D1D1F" } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
          });
          titleRow.height = 20;

          const nameRowIdx = titleRowIdx + 1;
          const nameRow = ws.addRow([emp.name]);
          ws.mergeCells(nameRowIdx, 1, nameRowIdx, HEADERS.length);
          nameRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + solidHex(emp.color) } };
            cell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
          });
          nameRow.height = 22;

          const headerRow = ws.addRow(HEADERS);
          headerRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
            cell.font = { bold: true, size: 10, color: { argb: "FF334155" } };
            cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
            cell.alignment = { horizontal: "center" };
          });

          for (const d of emp.days) {
            const row = ws.addRow([
              d.dayLabel,
              d.date ? d.date.split("-").reverse().join("/") : "",
              d.entrada ?? "",
              d.salida1 ?? "",
              d.entrada2 ?? "",
              d.salidaFinal ?? "",
              d.horasTrabajadas ?? "",
              d.horasExtra ?? "",
              "",
            ]);
            row.eachCell((cell) => {
              cell.border = { bottom: { style: "thin", color: { argb: "FFF1F5F9" } } };
              cell.alignment = { horizontal: "center" };
            });
            row.getCell(1).alignment = { horizontal: "left" };
          }
          ws.addRow([]);
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asistencia-semanal-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      if (adminId) logAdminAction(createClient(), adminId, "Descargó reporte semanal de asistencia", "xlsx");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={download} disabled={busy || blocks.length === 0}
      className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap"
      style={{ background: "var(--purple-tint)", color: "var(--purple)" }}>
      <IconDownload className="w-3.5 h-3.5" /> {busy ? "Generando…" : "Excel semanal ↓"}
    </button>
  );
}
