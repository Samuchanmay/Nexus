"use client";
// EMET · Descarga del reporte semanal de asistencia en Excel real (.xlsx),
// agrupado por empleado y semana — mismo formato que el checador legado
// (Control_Asistencias_Semanal): un bloque de color por persona, con
// Día/Fecha/Hora Entrada/Hora Salida/Hora Entrada/Hora Salida/Horas
// Trabajadas/Horas Extra/Comentarios. Los colores de cada bloque usan el
// mismo nexus_color asignado a esa persona en el resto de la app.
import { logAdminAction } from "@/lib/admin-log";
import { createClient } from "@/lib/supabase/client";
import { XlsxReportButton, type WeekBlock, type DayDetail } from "@/components/shared/xlsx-report";

export type { WeekBlock, DayDetail };

export function XlsxWeeklyReportButton({ blocks, adminId }: { blocks: WeekBlock[]; adminId: string }) {
  const handleDownload = () => {
    if (adminId) logAdminAction(createClient(), adminId, "Descargó reporte semanal de asistencia", "xlsx");
  };

  return (
    <XlsxReportButton
      blocks={blocks}
      onDownload={handleDownload}
      label="Excel semanal"
      filename="asistencia-semanal"
    />
  );
}
