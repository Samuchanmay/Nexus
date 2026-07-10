"use client";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction } from "@/lib/admin-log";

/** Enlace de exportación CSV (data-URI, sin librerías) que además queda
 * registrado en la bitácora de productividad del admin. */
export function CsvLink({ rows, filename, adminId, label = "CSV ↓" }: {
  rows: (string | number)[][]; filename: string; adminId: string; label?: string;
}) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  return (
    <a
      href={href} download={filename} className="no-print text-[11.5px] font-semibold shrink-0" style={{ color: "var(--accent)" }}
      onClick={() => { if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", filename); }}
    >
      {label}
    </a>
  );
}
