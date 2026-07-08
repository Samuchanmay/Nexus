"use client";
import { useMemo, useState } from "react";
import { Avatar, Pill } from "@/components/ui";

export type Item = {
  id: string;
  deadline: string | null;
  priority: string | null;
  requests: {
    title: string; type: string; subtype: string | null;
    requester_name: string | null; requester_area: string | null; event_date: string | null;
  } | null;
  project_assignments: { is_lead: boolean; users: { display_name: string; nexus_color: string | null } | null }[];
  evidences: { id: string; drive_url: string | null; publish_url: string | null; created_at: string }[];
  comments: { id: string }[];
};

const TYPE_LABEL: Record<string, string> = {
  cobertura: "Cobertura", diseno: "Diseño", lona: "Lona", video: "Video", difusion: "Difusión",
};

export default function BibliotecaClient({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((it) => {
      const r = it.requests;
      const haystack = [
        r?.title, r?.type, r?.subtype, r?.requester_name, r?.requester_area,
        ...it.project_assignments.map((a) => a.users?.display_name),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(t);
    });
  }, [items, q]);

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Biblioteca</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Memoria institucional: {items.length} actividad{items.length === 1 ? "" : "es"} terminada{items.length === 1 ? "" : "s"}.
        </p>
      </header>

      <div className="mb-5">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título, tipo, coordinación o colaborador…"
          className="w-full h-11 rounded-s px-3.5 text-[14px]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-2)" }}>
            {items.length === 0 ? "Aún no hay actividades terminadas." : "Sin resultados para tu búsqueda."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((it) => {
            const r = it.requests;
            return (
              <div key={it.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-bold truncate">{r?.title ?? "Sin título"}</p>
                    <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-3)" }}>
                      {r?.requester_area ?? "—"} · {r?.event_date ?? "sin fecha de evento"}
                    </p>
                  </div>
                  <Pill tone="ok">{TYPE_LABEL[r?.type ?? ""] ?? r?.type ?? "—"}</Pill>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {it.project_assignments.map((a, i) => a.users && (
                    <span key={i} className="flex items-center gap-1.5">
                      <Avatar name={a.users.display_name} color={a.users.nexus_color} size={22} />
                      <span className="text-[12px] font-semibold">{a.users.display_name}{a.is_lead ? " (responsable)" : ""}</span>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-4 mt-3 text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>
                  <span>{it.evidences.length} evidencia{it.evidences.length === 1 ? "" : "s"}</span>
                  <span>{it.comments.length} comentario{it.comments.length === 1 ? "" : "s"}</span>
                  {it.deadline && <span>Entregada · {it.deadline}</span>}
                </div>

                {it.evidences.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {it.evidences.map((e) => (
                      <a key={e.id} href={e.publish_url || e.drive_url || "#"} target="_blank" rel="noreferrer"
                        className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                        Ver evidencia →
                      </a>
                    ))}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
