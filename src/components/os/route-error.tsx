"use client";
// ══════════════════════════════════════════════════════════
//  Error boundary compartido (auditoría MEJORAS-GENERALES.md
//  §4.2) — antes ninguna ruta tenía error.tsx, así que un fallo
//  en un Server Component (ej. una de las ~19 queries del
//  dashboard, o cualquier otra página) mostraba la pantalla de
//  error genérica de Next.js en vez de algo consistente con el
//  resto de Emet. Un solo componente, reusado por cada grupo de
//  rutas — no se duplica el marcado seis veces.
// ══════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Icon } from "./icons";

export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[Emet] Error de ruta:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6 text-center">
      <div className="grid place-items-center h-14 w-14 rounded-full" style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
        <Icon name="alert" size={24} />
      </div>
      <p className="text-[16px] font-bold text-text-1">Algo salió mal</p>
      <p className="text-[13.5px] max-w-[340px]" style={{ color: "var(--text-2)" }}>
        No se pudo cargar esta pantalla. Puedes intentar de nuevo — si el problema sigue, avísale al equipo técnico.
      </p>
      <button onClick={reset} className="btn-primary px-4 py-2 text-[13.5px] mt-1">
        Intentar de nuevo
      </button>
    </div>
  );
}
