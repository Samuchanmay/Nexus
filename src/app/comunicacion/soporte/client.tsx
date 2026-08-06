"use client";
/**
 * FASE W8 — Soporte interno, lado empleado. Reportar un problema (mismo
 * patrón de UI que Incidencias: botón "+", Sheet con el formulario, lista
 * de lo ya enviado con su estado) + ver la respuesta del admin cuando
 * llega. Alcance simple confirmado por el usuario: sin SLA, sin hilo de
 * comentarios — si hace falta ida y vuelta, se resuelve por Chat.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast, Sheet, Pill, Select } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { notifyAdmins } from "@/lib/notify";
import { getErrorMessage } from "@/lib/errors";
import {
  SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL,
  type SupportTicket, type SupportTicketCategory,
} from "@/lib/types";

const STATUS_TONE: Record<string, "muted" | "accent" | "ok"> = {
  abierto: "muted", en_progreso: "accent", resuelto: "ok",
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function SoporteClient({ userId, initialTickets }: { userId: string; initialTickets: SupportTicket[] }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ category: SupportTicketCategory; title: string; description: string }>({
    category: "otro", title: "", description: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast("Título y descripción son obligatorios", "warn"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("support_tickets").insert({
      user_id: userId, category: form.category, title: form.title.trim(), description: form.description.trim(),
    });
    setSaving(false);
    if (error) { toast(getErrorMessage(error, "No se pudo enviar"), "danger"); return; }
    notifyAdmins(supabase, "Nuevo ticket de soporte", form.title.trim(), "info", "/admin/soporte");
    setOpen(false);
    setForm({ category: "otro", title: "", description: "" });
    toast("Reporte enviado");
    router.refresh();
  };

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Soporte</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Reporta un problema y da seguimiento a tus solicitudes
        </p>
      </header>

      <button onClick={() => setOpen(true)}
        className="btn-primary w-full py-3.5 text-[14px] mb-6 flex items-center justify-center gap-2">
        <Icon name="plus" size={16} /> Reportar un problema
      </button>

      {initialTickets.length === 0 && (
        <div className="card p-8 text-center">
          <Icon name="info" size={26} className="mx-auto mb-2" style={{ color: "var(--text-3)" }} />
          <p className="font-semibold text-[14px]">Sin reportes</p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Cuando reportes un problema, aparecerá aquí con su estado
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {initialTickets.map((t) => (
          <div key={t.id} className="card px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-bold truncate">{t.title}</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                  {SUPPORT_CATEGORY_LABEL[t.category]} · {fmtDateTime(t.created_at)}
                </p>
              </div>
              <Pill tone={STATUS_TONE[t.status]}>{SUPPORT_STATUS_LABEL[t.status]}</Pill>
            </div>
            <p className="text-[13px] mt-2" style={{ color: "var(--text-2)" }}>{t.description}</p>
            {t.admin_response && (
              <div className="mt-3 rounded-lg px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
                <p className="text-[11.5px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>Respuesta</p>
                <p className="text-[13px]">{t.admin_response}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Reportar un problema">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Categoría</label>
            <Select
              value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v as SupportTicketCategory }))}
              title="Categoría" searchable={false}
              options={(Object.keys(SUPPORT_CATEGORY_LABEL) as SupportTicketCategory[]).map((k) => ({ value: k, label: SUPPORT_CATEGORY_LABEL[k] }))}
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Título</label>
            <input className="field-input" placeholder="Resumen breve del problema"
              value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Descripción</label>
            <textarea className="field-input resize-none" rows={4} placeholder="Qué pasó, cuándo, y qué esperabas que pasara…"
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-2.5 mt-1">
            <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={saving} onClick={submit}>
              {saving ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
