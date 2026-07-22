"use client";
import { IconDownload } from "@/components/icons";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print btn-secondary text-[12.5px] px-3.5 py-2 flex items-center gap-1.5"
    >
      <IconDownload className="w-3.5 h-3.5" /> Guardar como PDF
    </button>
  );
}
