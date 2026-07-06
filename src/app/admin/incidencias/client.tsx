"use client";
import { createClient } from "@/lib/supabase/client";
import type { Incident } from "@/lib/types";
import { useToast, Pill } from "@/components/ui";
import { useSupabaseMutation } from "@/components/shared";
import { KIND_LABELS, INCIDENT_TONE as STATUS_TONE } from "@/lib/ui-maps";

export default function IncAdminClient({ incidents }: { incidents: Incident[] }) {
  const toast = useToast(); void toast;
  const { run } = useSupabaseMutation();
  const decide = (id: string, status: "Autorizado" | "Rechazado") =>
    run(() => createClient().from("incidents").update({ status }).eq("id", id),
      { ok: status === "Autorizado" ? "Incidencia autorizada" : "Incidencia rechazada", err: "No se pudo actualizar" });

  const pending = incidents.filter((i) => i.status === "Pendiente");
  const rest = incidents.filter((i) => i.status !== "Pendiente");

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Incidencias</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Las incidencias autorizadas nunca generan falta
        </p>
      </header>

      <h2 className="text-[15px] font-bold mb-3">Pendientes {pending.length > 0 && `(${pending.length})`}</h2>
      {pending.length === 0 && (
        <div className="card p-6 text-center mb-7">
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>Sin incidencias pendientes</p>
        </div>
      )}
      <div className="flex flex-col gap-2.5 mb-7">
        {pending.map((i) => (
          <div key={i.id} className="card px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[14px] font-bold">{i.users?.full_name} · {KIND_LABELS[i.kind]}</p>
              <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
                {i.start_date}{i.end_date !== i.start_date && ` → ${i.end_date}`}
                {i.note && ` · ${i.note}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-full text-[12.5px] font-semibold"
                style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
                onClick={() => decide(i.id, "Rechazado")}>
                Rechazar
              </button>
              <button className="px-4 py-2 rounded-full text-[12.5px] font-semibold"
                style={{ background: "var(--ok-tint)", color: "var(--ok)" }}
                onClick={() => decide(i.id, "Autorizado")}>
                Autorizar
              </button>
            </div>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <>
          <h2 className="text-[15px] font-bold mb-3">Historial</h2>
          <div className="flex flex-col gap-2.5">
            {rest.map((i) => (
              <div key={i.id} className="card px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13.5px] font-bold">{i.users?.display_name} · {KIND_LABELS[i.kind]}</p>
                  <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                    {i.start_date}{i.end_date !== i.start_date && ` → ${i.end_date}`}
                  </p>
                </div>
                <Pill tone={STATUS_TONE[i.status]}>{i.status}</Pill>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
