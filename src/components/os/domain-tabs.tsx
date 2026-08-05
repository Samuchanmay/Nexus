"use client";
// ══════════════════════════════════════════════════════════
//  EMET · DomainTabs — pestañas de un dominio-hub (Personas/Tiempo).
//  Navegación real (Link a una URL real), no estado de cliente: cada
//  pestaña sigue siendo su propia página server-rendered de siempre —
//  esto es solo el "envoltorio" que las presenta como vistas de un mismo
//  dominio en vez de módulos sueltos (Fase 2, 2026-07-31). El componente
//  nunca inventa una URL: si domainViewsFor() no devuelve nada para ese
//  rol, no se renderiza nada.
// ══════════════════════════════════════════════════════════
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { cx } from "./ui";
import { domainViewsFor, type Role } from "@/lib/nav";

export function DomainTabs({ domain, role }: { domain: string; role: Role }) {
  const pathname = usePathname();
  const views = domainViewsFor(domain, role);
  // Con 0-1 vistas no hay nada que elegir — no estorbar con una sola pestaña.
  if (views.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5 mb-5 overflow-x-auto nx-scroll" role="tablist">
      {views.map((v) => {
        const on = pathname === v.href || pathname.startsWith(v.href + "/");
        return (
          <Link
            key={v.key} href={v.href} role="tab" aria-selected={on} data-ripple
            className={cx(
              "flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13.5px] font-semibold whitespace-nowrap transition-colors shrink-0",
              on ? "bg-accent text-white shadow-sm" : "text-text-2 hover:bg-hover"
            )}
          >
            <Icon name={v.icon} size={14} />
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}
