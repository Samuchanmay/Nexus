"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { businessDaysBetween } from "@/lib/hours";
import { seniorityLabel, shortDate, dmy } from "@/lib/tz";
import type { Vacation } from "@/lib/types";
import { useToast, Sheet, Pill, DateRangeCalendar } from "@/components/ui";
import { notifyAdmins } from "@/lib/notify";
import { IconPlus } from "@/components/icons";
import { Icon } from "@/components/os/icons";

import { VACATION_TONE as STATUS_TONE } from "@/lib/ui-maps";

export default function VacacionesClient({ userId, displayName, balance, hireDate, vacations, holidays }: {
  userId: string; displayName: string; balance: number; hireDate: string | null; vacations: Vacation[]; holidays: string[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  // Fechas ya ocupadas por otra solicitud propia (Aprobada o Pendiente),
  // expandidas día a día — se muestran bloqueadas en el calendario visual
  // (equivalente a fechasTomadas() del checador legado).
  const takenDates = useMemo(() => {
    const set = new Set<string>();
    for (const v of vacations) {
      if (v.status !== "Aprobada" && v.status !== "Pendiente") continue;
      const d = new Date(v.start_date + "T12:00:00");
      const endD = new Date(v.end_date + "T12:00:00");
      while (d <= endD) {
        set.add(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    }
    return set;
  }, [vacations]);
  const todayIso = new Date().toISOString().slice(0, 10);

  const days = useMemo(() => {
    if (!start || !end || end < start) return 0;
    return businessDaysBetween(start, end, holidaySet);
  }, [start, end, holidaySet]);

  const overBalance = days > balance;

  const overlaps = useMemo(() => {
    if (!start || !end) return [];
    return vacations.filter((v) =>
      (v.status === "Aprobada" || v.status === "Pendiente") &&
      v.start_date <= end && v.end_date >= start
    );
  }, [start, end, vacations]);

  const submit = async () => {
    if (!start || !end) { toast("Selecciona las fechas"); return; }
    if (end < start) { toast("La fecha final debe ser posterior"); return; }
    if (days === 0) { toast("El rango no incluye días hábiles"); return; }
    if (overBalance) { toast("No tienes saldo suficiente"); return; }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("vacations")
      .insert({ user_id: userId, start_date: start, end_date: end, days })
      .select("id").single();
    if (error || !data) { toast("No se pudo enviar — intenta de nuevo"); setSaving(false); return; }
    // Notificar a Samuel por correo (Edge Function) — el correo es best-effort:
    // si Resend falla, la solicitud ya quedó guardada y el admin igual recibe
    // la notificación de campana de abajo, más una alerta de que el correo falló.
    let emailOk = false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-vacation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ vacation_id: data.id }),
      });
      const json = await res.json().catch(() => null);
      emailOk = !!json?.ok;
    } catch { /* el correo es best-effort; la solicitud ya quedó guardada */ }
    notifyAdmins(supabase, `${displayName} solicitó vacaciones`, `${days} día${days === 1 ? "" : "s"} · ${shortDate(start)} → ${shortDate(end)}`, "vacation", "/admin/vacaciones");
    setSaving(false);
    setOpen(false);
    setStart(""); setEnd("");
    toast(emailOk ? "Solicitud enviada — Samuel recibió un correo" : "Solicitud enviada — el correo automático no pudo enviarse, pero Samuel ya la ve en Nexus");
    router.refresh();
  };

  return (
    <>
      <header className="pt-8 pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Vacaciones</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Solicita y consulta tus periodos
            {seniorityLabel(hireDate) && ` · ${seniorityLabel(hireDate)} de antigüedad`}
          </p>
        </div>
        <div className="card px-5 py-3 text-center shrink-0">
          <p className="text-[23px] font-bold tabular-nums" style={{ color: "var(--ok)" }}>{balance}</p>
          <p className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>días disponibles</p>
        </div>
      </header>

      <button onClick={() => setOpen(true)}
        className="btn-primary btn-ok w-full py-3.5 text-[14.5px] mb-6 flex items-center justify-center gap-2">
        <IconPlus className="w-4 h-4" /> Solicitar vacaciones
      </button>

      {vacations.length === 0 && (
        <div className="card p-8 text-center">
          <Icon name="plane" size={28} className="mx-auto mb-2" />
          <p className="font-semibold text-[14px]">Sin solicitudes aún</p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Tu historial de vacaciones aparecerá aquí
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {vacations.map((v) => (
          <div key={v.id} className="card px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold">{dmy(v.start_date)} → {dmy(v.end_date)}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                {v.days} {v.days === 1 ? "día hábil" : "días hábiles"}
                {v.admin_note && ` · ${v.admin_note}`}
              </p>
            </div>
            <Pill tone={STATUS_TONE[v.status]}>{v.status}</Pill>
          </div>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Solicitar vacaciones">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
              Selecciona las fechas <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(sin contar fines de semana ni festivos)</span>
            </label>
            <DateRangeCalendar
              start={start || null} end={end || null}
              onSelect={(s, e) => { setStart(s ?? ""); setEnd(e ?? ""); }}
              holidays={holidaySet} disabledDates={takenDates} minDate={todayIso}
            />
          </div>
          {days > 0 && (
            <div className="rounded-sm px-4 py-3 text-[13px] font-semibold"
              style={{
                background: overBalance ? "var(--danger-tint)" : "var(--ok-tint)",
                color: overBalance ? "var(--danger)" : "var(--ok)",
              }}>
              {days} {days === 1 ? "día hábil" : "días hábiles"} · te quedarían {balance - days}
              {overBalance && " — saldo insuficiente"}
            </div>
          )}
          {overlaps.length > 0 && (
            <div className="rounded-sm px-4 py-3 text-[12.5px]" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
              <p className="font-semibold mb-1">Se cruza con otra solicitud tuya:</p>
              {overlaps.map((v) => (
                <p key={v.id}>{dmy(v.start_date)} → {dmy(v.end_date)} ({v.status})</p>
              ))}
            </div>
          )}
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
            Fines de semana y días inhábiles no cuentan. Samuel recibirá un correo con tu solicitud y la aprobará una vez que tenga el visto bueno.
          </p>
          <div className="flex gap-2.5 mt-1">
            <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary btn-ok flex-[2] py-3 text-[14px]" disabled={saving || days === 0 || overBalance} onClick={submit}>
              {saving ? "Enviando…" : "Enviar solicitud"}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
