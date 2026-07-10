"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Vacation } from "@/lib/types";
import { useToast, Pill, Avatar, Sheet } from "@/components/ui";
import { useSupabaseMutation } from "@/components/shared";
import { VACATION_TONE as STATUS_TONE } from "@/lib/ui-maps";
import { vacationCalendarUrl as calendarUrl } from "@/lib/gcal";
import { seniorityLabel, addDays } from "@/lib/tz";
import { logAdminAction } from "@/lib/admin-log";

/** Semáforo de salud del saldo: verde <50% usado, amarillo 50-79%, rojo >=80%. */
function balanceColor(pctUsed: number): string {
  return pctUsed < 50 ? "var(--ok)" : pctUsed < 80 ? "var(--warn)" : "var(--danger)";
}

export default function VacAdminClient({ vacations, team, adminId }: {
  vacations: Vacation[];
  team: { id: string; display_name: string; vacation_balance: number; vacation_days_per_year: number; hire_date: string | null; nexus_color: string | null }[];
  adminId: string;
}) {
  const toast = useToast();
  const { run, saving } = useSupabaseMutation();
  const { run: runCancel, saving: cancelling } = useSupabaseMutation();
  const [sel, setSel] = useState<Vacation | null>(null);
  const [note, setNote] = useState("");
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const cancelVacation = async (id: string) => {
    const target = vacations.find((v) => v.id === id);
    const ok = await runCancel(async () => {
      const supabase = createClient();
      const res = await supabase.rpc("cancel_vacation", { p_vacation_id: id, p_note: null });
      if (res.error) return { error: { message: "No se pudo cancelar" } };
      // Borrar el evento de Calendar es best-effort: si falla, la cancelación ya quedó guardada.
      if (target?.calendar_event_id) {
        try { await supabase.functions.invoke("gcal-delete-event", { body: { eventId: target.calendar_event_id } }); }
        catch { /* no bloquea la cancelación */ }
      }
      return { error: null };
    }, { ok: "Vacación cancelada — saldo reembolsado" });
    if (ok) {
      if (adminId) logAdminAction(createClient(), adminId, "Canceló vacación", target?.users?.display_name ?? undefined);
      setConfirmCancelId(null);
    }
  };

  const decide = async (status: "Aprobada" | "Rechazada") => {
    if (!sel) return;
    const target = sel;
    const ok = await run(async () => {
      const supabase = createClient();
      if (status === "Aprobada") {
        // B4: RPC atómica — valida saldo y descuenta en UNA transacción (sin carreras)
        const res = await supabase.rpc("approve_vacation", { p_vacation_id: target.id, p_note: note || null });
        if (res.error) {
          return { error: { message: res.error.message.includes("Saldo") ? res.error.message : "No se pudo actualizar" } };
        }
        if (addToCalendar) {
          // Intentamos crear el evento real (Edge Function); si quien aprueba no ha
          // dado permiso de Calendar, caemos al enlace manual de toda la vida.
          const { data: gcalData, error: gcalError } = await supabase.functions.invoke("gcal-create-event", {
            body: {
              title: `🌴 Vacaciones — ${target.users?.display_name ?? ""}`,
              details: `${target.days} días hábiles aprobados en Nexus.`,
              start: target.start_date,
              end: addDays(target.end_date, 1),
              allDay: true,
            },
          });
          const result = gcalData as { ok?: boolean; eventId?: string } | null;
          if (gcalError || !result?.ok) {
            window.open(calendarUrl(target), "_blank");
          } else if (result.eventId) {
            await supabase.from("vacations").update({ calendar_event_id: result.eventId }).eq("id", target.id);
          }
        }
        return { error: null };
      }
      return supabase.from("vacations").update({ status, admin_note: note || null }).eq("id", target.id);
    }, { ok: status === "Aprobada" ? "Vacaciones aprobadas" : "Solicitud rechazada" });
    if (ok) {
      if (adminId) {
        logAdminAction(createClient(), adminId,
          status === "Aprobada" ? "Aprobó vacaciones" : "Rechazó vacaciones",
          target.users?.display_name ?? undefined);
      }
      setSel(null); setNote("");
    }
  };

  const pending = vacations.filter((v) => v.status === "Pendiente");
  const rest = vacations.filter((v) => v.status !== "Pendiente");

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Vacaciones</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Aprueba una vez que tengas el visto bueno externo
        </p>
      </header>

      {/* Saldos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-7">
        {team.map((t) => {
          const total = t.vacation_days_per_year || 0;
          const used = Math.max(0, total - t.vacation_balance);
          const pctUsed = total > 0 ? Math.round((used / total) * 100) : 0;
          const color = balanceColor(pctUsed);
          const seniority = seniorityLabel(t.hire_date);
          return (
            <div key={t.id} className="card p-4 flex items-center gap-2.5">
              <Avatar name={t.display_name} color={t.nexus_color} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold truncate">{t.display_name}</p>
                <p className="text-[11.5px] flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                  <span style={{ color }}>●</span> {t.vacation_balance} días
                </p>
                {seniority && (
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-3)" }}>{seniority}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="text-[15px] font-bold mb-3">Pendientes {pending.length > 0 && `(${pending.length})`}</h2>
      {pending.length === 0 && (
        <div className="card p-6 text-center mb-7">
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>Sin solicitudes pendientes</p>
        </div>
      )}
      <div className="flex flex-col gap-2.5 mb-7">
        {pending.map((v) => (
          <div key={v.id} className="card px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} size={34} />
              <div>
                <p className="text-[14px] font-bold">{v.users?.full_name}</p>
                <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
                  {v.start_date} → {v.end_date} · {v.days} días hábiles
                </p>
              </div>
            </div>
            <button className="btn-primary px-5 py-2.5 text-[13px]" onClick={() => { setSel(v); setNote(""); }}>
              Revisar
            </button>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <>
          <h2 className="text-[15px] font-bold mb-3">Historial</h2>
          <div className="flex flex-col gap-2.5">
            {rest.map((v) => (
              <div key={v.id} className="card px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[13.5px] font-bold">{v.users?.display_name} · {v.start_date} → {v.end_date}</p>
                  <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                    {v.days} días{v.admin_note && ` · ${v.admin_note}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={STATUS_TONE[v.status]}>{v.status}</Pill>
                  {v.status === "Aprobada" && (
                    confirmCancelId === v.id ? (
                      <div className="flex items-center gap-1.5">
                        <button className="text-[11.5px] font-semibold" style={{ color: "var(--danger)" }}
                          disabled={cancelling} onClick={() => cancelVacation(v.id)}>
                          {cancelling ? "Cancelando…" : "Sí, cancelar"}
                        </button>
                        <button className="text-[11.5px] font-semibold" style={{ color: "var(--text-3)" }}
                          onClick={() => setConfirmCancelId(null)}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button className="text-[11.5px] font-semibold" style={{ color: "var(--text-3)" }}
                        onClick={() => setConfirmCancelId(v.id)}>
                        Cancelar
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!sel} onClose={() => setSel(null)} title="Decidir solicitud">
        {sel && (
          <div className="flex flex-col gap-3.5">
            <div className="rounded-sm px-4 py-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-[14px] font-bold">{sel.users?.full_name}</p>
              <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-2)" }}>
                {sel.start_date} → {sel.end_date} · {sel.days} días hábiles
              </p>
            </div>
            <div className="rounded-sm px-4 py-3 text-[12.5px]" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
              Recuerda: la aprobación aquí es el paso final, después de tu gestión del VoBo por fuera.
            </div>
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                Nota <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional, visible para el empleado)</span>
              </label>
              <input className="field-input" placeholder="Ej. Aprobado con VoBo de dirección"
                value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <label className="flex items-center gap-2.5 text-[13px] font-semibold cursor-pointer">
              <input type="checkbox" checked={addToCalendar} onChange={(e) => setAddToCalendar(e.target.checked)}
                className="w-[18px] h-[18px] accent-[var(--accent)]" />
              Crear evento en Google Calendar al aprobar
            </label>
            <div className="flex gap-2.5">
              <button className="flex-1 py-3 text-[13.5px] rounded-sm font-semibold"
                style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
                disabled={saving} onClick={() => decide("Rechazada")}>
                Rechazar
              </button>
              <button className="btn-primary btn-ok flex-[2] py-3 text-[14px]" disabled={saving} onClick={() => decide("Aprobada")}>
                {saving ? "Guardando…" : "Aprobar vacaciones"}
              </button>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
              Al aprobar se descuentan {sel.days} días del saldo del empleado.
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}
