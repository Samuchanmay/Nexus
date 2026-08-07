"use client";
import { useMemo, useState } from "react";
import { Avatar, Pill } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { Icon } from "@/components/os/icons";
import { dmy } from "@/lib/tz";
import { isBirthdayToday, todayISO } from "@/lib/birthday";

export type Item = {
  id: string;
  deadline: string | null;
  priority: string | null;
  requests: {
    title: string; type: string; subtype: string | null;
    requester_name: string | null; requester_area: string | null; event_date: string | null;
  } | null;
  project_assignments: { is_lead: boolean; users: { display_name: string; nexus_color: string | null; avatar_url: string | null; birth_date: string | null } | null }[];
  evidences: { id: string; drive_url: string | null; publish_url: string | null; created_at: string }[];
  comments: { id: string }[];
};

export default function BibliotecaClient({ items, typeLabel, types }: {
  items: Item[]; typeLabel: Record<string, string>; types: { key: string; label: string }[];
}) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const k = it.requests?.type;
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((it) => {
      if (typeFilter && it.requests?.type !== typeFilter) return false;
      if (!t) return true;
      const r = it.requests;
      const haystack = [
        r?.title, r?.type, r?.subtype, r?.requester_name, r?.requester_area,
        ...it.project_assignments.map((a) => a.users?.display_name),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(t);
    });
  }, [items, q, typeFilter]);

  return (
    <>
      {/* Header compacto */}
      <header className="pt-6 pb-5">
        <h1 className="text-[28px] font-bold tracking-tight text-text-1 leading-none">Biblioteca</h1>
        <p className="text-[15px] mt-2" style={{ color: "var(--text-2)" }}>
          Todo el conocimiento generado por el equipo
        </p>
      </header>

      {/* Buscador prominente estilo Spotlight */}
      <div className="relative mb-5">
        <svg 
          className="absolute left-4 top-1/2 -translate-y-1/2" 
          width="18" height="18" viewBox="0 0 24 24" fill="none" 
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--text-3)" }}
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar actividades, documentos o personas..."
          className="w-full h-11 pl-11 pr-4 rounded-xl text-[14px] transition-all duration-200 focus:ring-2 focus:ring-accent/20"
          style={{ 
            background: "var(--surface-2)", 
            border: "1.5px solid var(--border)",
            color: "var(--text-1)"
          }}
        />
      </div>

      {/* Filtros discretos */}
      <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setTypeFilter("")}
            className="text-[13.5px] font-semibold px-4 py-2 rounded-full transition-all duration-200"
            style={{
              background: typeFilter === "" ? "var(--accent)" : "var(--surface-2)",
              color: typeFilter === "" ? "#fff" : "var(--text-2)",
              boxShadow: typeFilter === "" ? "var(--shadow-2)" : "none"
            }}>
          Todos
          <span className="ml-1.5 text-[12px] opacity-70">{items.length}</span>
        </button>
        {types.filter((t) => counts.has(t.key)).map((t) => (
          <button key={t.key} onClick={() => setTypeFilter(t.key)}
            className="text-[13.5px] font-semibold px-4 py-2 rounded-full transition-all duration-200"
            style={{
              background: typeFilter === t.key ? "var(--accent)" : "var(--surface-2)",
              color: typeFilter === t.key ? "#fff" : "var(--text-2)",
              boxShadow: typeFilter === t.key ? "var(--shadow-2)" : "none"
            }}>
            {t.label}
            <span className="ml-1.5 text-[12px] opacity-70">{counts.get(t.key)}</span>
          </button>
        ))}
      </div>

      {/* Estado vacío compacto */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div 
            className="w-16 h-16 rounded-2xl grid place-items-center mb-4 mx-auto"
            style={{ background: "var(--surface-2)" }}
          >
            <Icon name="book" size={32} className="text-text-3" />
          </div>
          <h2 className="text-[19px] font-semibold text-text-1 mb-1">
            {items.length === 0 ? "Aún no hay actividades archivadas" : "Sin resultados"}
          </h2>
          <p className="text-[14px] text-text-3 max-w-[360px] mx-auto">
            {items.length === 0 
              ? "Cuando una actividad se marque como completada, la encontrarás aquí para futuras consultas."
              : "Prueba con otro tipo o quita el filtro."}
          </p>
        </div>
      ) : (
        /* Lista tipo Notion - filas compactas */
        <div>
          {/* Header de tabla */}
          <div className="hidden md:grid grid-cols-[1fr_120px_140px_100px] gap-4 px-4 py-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
            <span>Actividad</span>
            <span>Tipo</span>
            <span>Responsable</span>
            <span>Fecha</span>
          </div>

          {/* Filas */}
          <div className="flex flex-col">
            {filtered.map((it) => {
              const r = it.requests;
              const lead = it.project_assignments.find((a) => a.is_lead)?.users ?? it.project_assignments[0]?.users;
              
              return (
                <div 
                  key={it.id} 
                  className="group grid grid-cols-1 md:grid-cols-[1fr_120px_140px_100px] gap-2 md:gap-4 px-4 py-3.5 rounded-xl hover:bg-hover transition-all duration-200 cursor-pointer border border-transparent hover:border-border"
                >
                  {/* Título + metadata */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-text-1 truncate group-hover:text-accent transition-colors">
                        {r?.title ?? "Sin título"}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[12px] text-text-3">{r?.requester_area ?? "—"}</span>
                        {it.evidences.length > 0 && (
                          <>
                            <span className="text-[12px] text-text-3">·</span>
                            <span className="text-[12px] text-text-3">{it.evidences.length} evidencia{it.evidences.length === 1 ? "" : "s"}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tipo */}
                  <div className="flex items-center">
                    <span 
                      className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: "var(--ok-tint)", color: "var(--ok)" }}
                    >
                      {typeLabel[r?.type ?? ""] ?? r?.type ?? "—"}
                    </span>
                  </div>

                  {/* Responsable */}
                  <div className="flex items-center gap-2">
                    {lead ? (
                      <>
                        <Avatar name={lead.display_name} color={lead.nexus_color} avatarUrl={lead.avatar_url} size={24} birthday={isBirthdayToday(lead.birth_date, todayISO())} />
                        <span className="text-[13.5px] font-medium text-text-2 truncate hidden lg:block">{lead.display_name}</span>
                      </>
                    ) : (
                      <span className="text-[13.5px] text-text-3">—</span>
                    )}
                  </div>

                  {/* Fecha */}
                  <div className="flex items-center">
                    {it.deadline ? (
                      <span className="text-[13.5px] font-medium text-text-2">{dmy(it.deadline)}</span>
                    ) : (
                      <span className="text-[13.5px] text-text-3">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
