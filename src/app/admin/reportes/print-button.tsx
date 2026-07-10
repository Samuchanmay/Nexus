"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print btn-secondary text-[12.5px] px-3.5 py-2"
    >
      Guardar como PDF ↓
    </button>
  );
}
