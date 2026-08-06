"use client";
/**
 * FASE W8 — Soporte interno, bandeja del admin. Alcance simple: filtrar
 * por estado, abrir un ticket, cambiar su estado y escribir una
 * respuesta — sin SLA ni hilo de comentarios (decisión del usuario, 6
 * ago 2026). Mismo patrón visual que otras bandejas del admin
 * (proyectos/client.tsx): tarjetas + Sheet de detalle.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Sheet, Select, SlidingSegments, useToast } from "@/components/ui";
import { Badge, EmptyState } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { notifyUser } from "@/lib/notify";
import { getErrorMessage } from "@/lib/errors";
import {
  SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL,
  type SupportTicketStatus,
} from "@/lib/types";
import type { SupportTicketRow } from "./page";

const STATUS_BADGE: Record<SupportTicketStatus, "neutral" | "accent" | "ok"> = {
  abierto: "neutral", en_progreso: "accent", resuelto: "ok",
};

const FILTERS = ["Todos", "Abiertos", "En progreso", "Resueltos"] as const;
const FILTER_STATUS: Record<(typeof FILTERS)[number], SupportTicketStatus | null> = {
  Todos: null, Abiertos: "abierto", "En progreso": "en_progreso", Resueltos: "resuelto",
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function SoporteAdminClient({ adminId, initialTickets }: { adminId: string; initialTickets: SupportTicketRow[] }) {
  const toast = useToast();
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Abiertos");
  const [active, setActive] = useState<SupportTicketRow | null>(null);
  const [status, setStatus] = useState<SupportTicketStatus>("abierto");
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);

  const wanted = FILTER_STATUS[filter];
  const visible = useMemo(
    () => wanted ? initialTickets.filter((t) => t.status === wanted) : initialTickets,
    [initialTickets, wanted]
  );

  const open = (t: SupportTicketRow) => {
    setActive(t);
    setStatus(t.status);
    setResponse(t.admin_response ?? "");
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("support_tickets").update({
      status, admin_response: response.trim() || null, admin_id: adminId,
      resolved_at: status === "resuelto" ? new Date().toISOString() : null,
    }).eq("id", active.id);
    setSaving(false);
    if (error) { toast(getErrorMessage(error, "No se pudo guardar"), "danger"); return; }
    if (status !== active.status || response.trim() !== (active.admin_response ?? "")) {
      notifyUser(supabase, active.user_id,
        status === "resuelto" ? "Tu ticket fue resuelto" : "Hay novedades en tu ticket",
        active.title, "info", "/comunicacion/soporte");
    }
    setActive(null);
    toast("Ticket actualizado");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[24px] font-bold tracking-tight">Soporte</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Reportes internos del equipo — responde y da seguimiento
        </p>
      </header>

      <SlidingSegments options={[...FILTERS]} value={filter} onChange={(v) => setFilter(v as (typeof FILTERS)[number])} />

      {visible.length === 0 ? (
        <EmptyState icon="info" title="Sin tickets aquí" hint="No hay reportes en este filtro." />
      ) : (
        <div className="grid gap-3">
          {visible.map((t) => (
            <button key={t.id} onClick={() => open(t)}
              className="text-left rounded-m border border-border bg-card px-5 py-4 transition-colors hover:bg-hover">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={t.requester?.display_name ?? "?"} avatarUrl={t.requester?.avatar_url} color={t.requester?.nexus_color} size={30} />
                  <div className="min-w-0">
                    <p className="font-semibold text-text-1 truncate">{t.title}</p>
                    <p className="text-[12px] text-text-3">
                      {t.requester?.display_name ?? "Alguien"} · {SUPPORT_CATEGORY_LABEL[t.category]} · {fmtDateTime(t.created_at)}
                    </p>
                  </div>
                </div>
                <Badge tone={STATUS_BADGE[t.status]}>{SUPPORT_STATUS_LABEL[t.status]}</Badge>
              </div>
              <p className="text-[13px] text-text-2 mt-2 line-clamp-2">{t.description}</p>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!active} onClose={() => setActive(null)} title={active?.title ?? ""} subtitle={active ? SUPPORT_CATEGORY_LABEL[active.category] : ""}>
        {active && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={active.requester?.display_name ?? "?"} avatarUrl={active.requester?.avatar_url} color={active.requester?.nexus_color} size={32} />
              <div>
                <p className="text-[13.5px] font-semibold">{active.requester?.display_name ?? "Alguien"}</p>
                <p className="text-[11.5px] text-text-3">{fmtDateTime(active.created_at)}</p>
              </div>
            </div>
            <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
              <p className="text-[13.5px] whitespace-pre-wrap">{active.description}</p>
            </div>
            <div>
              <label className="text-[11.5px] font-semibold mb-1 block" style={{ color: "var(--text-3)" }}>Estado</label>
              <Select
                value={status} onChange={(v) => setStatus(v as SupportTicketStatus)}
                title="Estado" searchable={false}
                options={(Object.keys(SUPPORT_STATUS_LABEL) as SupportTicketStatus[]).map((k) => ({ value: k, label: SUPPORT_STATUS_LABEL[k] }))}
              />
            </div>
            <div>
              <label className="text-[11.5px] font-semibold mb-1 block" style={{ color: "var(--text-3)" }}>Respuesta (opcional)</label>
              <textarea className="field-input resize-none" rows={4} placeholder="Explica qué se hizo o qué falta…"
                value={response} onChange={(e) => setResponse(e.target.value)} />
            </div>
            <div className="flex gap-2.5 mt-1">
              <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setActive(null)}>Cancelar</button>
              <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={saving} onClick={save}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
