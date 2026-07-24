"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Vacation } from "@/lib/types";
import { useToast, Pill, Avatar, Sheet, SelectField, DateRangeCalendar, DatePicker } from "@/components/ui";
import { IconDownload } from "@/components/icons";
import { Icon } from "@/components/os/icons";
import { useSupabaseMutation } from "@/components/shared";
import { VACATION_TONE as STATUS_TONE } from "@/lib/ui-maps";
import { vacationCalendarUrl as calendarUrl } from "@/lib/gcal";
import { seniorityLabel, addDays, shortDate, dmy, nextAnniversary, todayMerida } from "@/lib/tz";
import { businessDaysBetween } from "@/lib/hours";
import { logAdminAction } from "@/lib/admin-log";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { notifyUser } from "@/lib/notify";

/** Semáforo de salud del saldo: verde <50% usado, amarillo 50-79%, rojo >=80%. */
function balanceColor(pctUsed: number): string {
  return pctUsed < 50 ? "var(--ok)" : pctUsed < 80 ? "var(--warn)" : "var(--danger)";
}

/** Días de calendario entre dos ISO (b - a), para el timeline/ocupación —
 * a diferencia de businessDaysBetween, aquí sí importan fines de semana
 * porque el periodo de vacaciones "ocupa" esos días igual. */
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}

const TIMELINE_WINDOW = 60;

type SmartAlert = { icon: string; tone: "danger" | "warn" | "accent"; text: string };

export default function VacAdminClient({ vacations, team, adminId, vacationCalendarId, authorizationEmail, holidays }: {
  vacations: Vacation[];
  team: {
    id: string; display_name: string; vacation_balance: number; vacation_days_per_year: number; hire_date: string | null; nexus_color: string | null;
    vacation_balance_reset: string | null; avatar_url?: string | null; birth_date?: string | null;
    lastReset: { reset_at: string; days_granted: number; days_used: number; days_forfeited: number } | null;
  }[];
  adminId: string;
  vacationCalendarId: string | null;
  authorizationEmail: string;
  holidays: string[];
}) {
  const toast = useToast();
  const { run, saving } = useSupabaseMutation();
  const { run: runCancel, saving: cancelling } = useSupabaseMutation();
  const { run: runEdit, saving: editing } = useSupabaseMutation();
  const { run: runRegister, saving: registering } = useSupabaseMutation();
  const [sel, setSel] = useState<Vacation | null>(null);
  const [note, setNote] = useState("");
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState(authorizationEmail);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  // ── Editar vacación ya aprobada ──
  const [editTarget, setEditTarget] = useState<Vacation | null>(null);
  const [editStart, setEditStart] = useState<string | null>(null);
  const [editEnd, setEditEnd] = useState<string | null>(null);
  const editDays = useMemo(() => {
    if (!editStart || !editEnd) return 0;
    return businessDaysBetween(editStart, editEnd, holidaySet);
  }, [editStart, editEnd, holidaySet]);

  const openEdit = (v: Vacation) => {
    setEditTarget(v);
    setEditStart(v.start_date);
    setEditEnd(v.end_date);
  };

  const saveEdit = async () => {
    if (!editTarget || !editStart || !editEnd || editDays === 0) return;
    const target = editTarget;
    const ok = await runEdit(async () => {
      const supabase = createClient();
      const res = await supabase.rpc("edit_vacation", {
        p_vacation_id: target.id, p_start_date: editStart, p_end_date: editEnd, p_days: editDays,
      });
      if (res.error) return { error: { message: res.error.message.includes("Saldo") ? res.error.message : "No se pudo editar" } };
      if (target.calendar_event_id) {
        try { await supabase.functions.invoke("gcal-delete-event", { body: { eventId: target.calendar_event_id, calendarId: target.calendar_id ?? vacationCalendarId ?? undefined } }); }
        catch { /* no bloquea */ }
      }
      try {
        const { data: gcalData } = await supabase.functions.invoke("gcal-create-event", {
          body: {
            title: `🌴 Vacaciones — ${target.users?.display_name ?? ""}`,
            details: `${editDays} días hábiles (editado).`,
            start: editStart, end: addDays(editEnd, 1), allDay: true,
            calendarId: vacationCalendarId ?? undefined,
          },
        });
        const result = gcalData as { ok?: boolean; eventId?: string; calendarId?: string } | null;
        if (result?.ok && result.eventId) {
          await supabase.from("vacations").update({ calendar_event_id: result.eventId, calendar_id: result.calendarId ?? null }).eq("id", target.id);
        }
      } catch { /* no bloquea */ }
      return { error: null };
    }, { ok: "Vacación actualizada" });
    if (ok) {
      if (adminId) logAdminAction(createClient(), adminId, "Editó vacación", target.users?.display_name ?? undefined);
      notifyUser(createClient(), target.user_id, "Se actualizaron las fechas de tu vacación",
        `${dmy(editStart)} → ${dmy(editEnd)} · ${editDays} ${editDays === 1 ? "día" : "días"} hábiles`, "vacation", "/comunicacion/vacaciones");
      setEditTarget(null);
    }
  };

  // ── Registrar vacaciones directo (sin flujo de solicitud) ──
  const [regUserId, setRegUserId] = useState("");
  const [regStart, setRegStart] = useState<string | null>(null);
  const [regEnd, setRegEnd] = useState<string | null>(null);
  const regDays = useMemo(() => {
    if (!regStart || !regEnd) return 0;
    return businessDaysBetween(regStart, regEnd, holidaySet);
  }, [regStart, regEnd, holidaySet]);
  const regUser = team.find((t) => t.id === regUserId) ?? null;
  const regOverBalance = !!regUser && regDays > regUser.vacation_balance;
  const regMessage = !regStart || !regEnd
    ? "Elige empleado y rango de fechas"
    : regDays === 0
    ? "Ese rango no tiene días hábiles — revisa fines de semana/festivos"
    : `${regDays} ${regDays === 1 ? "día hábil" : "días hábiles"}${regUser ? ` · quedarían ${regUser.vacation_balance - regDays}` : ""}${regOverBalance ? " — saldo insuficiente" : ""}`;

  const registerDirect = async () => {
    if (!regUserId || !regStart || !regEnd || regDays === 0 || regOverBalance) return;
    const uid = regUserId, s = regStart, e = regEnd, d = regDays;
    const ok = await runRegister(async () => {
      const supabase = createClient();
      const res = await supabase.rpc("register_vacation_direct", { p_user_id: uid, p_start_date: s, p_end_date: e, p_days: d, p_note: "Registrado directo por admin" });
      if (res.error) return { error: { message: res.error.message.includes("Saldo") ? res.error.message : "No se pudo registrar" } };
      try {
        const { data: gcalData } = await supabase.functions.invoke("gcal-create-event", {
          body: { title: `🌴 Vacaciones — ${regUser?.display_name ?? ""}`, details: `${d} días hábiles (registrado por admin).`, start: s, end: addDays(e, 1), allDay: true, calendarId: vacationCalendarId ?? undefined },
        });
        const result = gcalData as { ok?: boolean; eventId?: string; calendarId?: string } | null;
        const row = (res.data as { id: string; new_balance: number }[] | null)?.[0];
        if (result?.ok && result.eventId && row?.id) {
          await supabase.from("vacations").update({ calendar_event_id: result.eventId, calendar_id: result.calendarId ?? null }).eq("id", row.id);
        }
      } catch { /* no bloquea */ }
      return { error: null };
    }, { ok: "Vacación registrada" });
    if (ok) {
      if (adminId) logAdminAction(createClient(), adminId, "Registró vacación directa", regUser?.display_name ?? undefined);
      notifyUser(createClient(), uid, "Se te registró un periodo de vacaciones", `${dmy(s)} → ${dmy(e)} · ${d} ${d === 1 ? "día" : "días"} hábiles`, "vacation", "/comunicacion/vacaciones");
      setRegUserId(""); setRegStart(null); setRegEnd(null);
    }
  };

  const saveAuthEmail = async () => {
    if (authEmail === authorizationEmail) return;
    await createClient().from("app_settings").upsert({ key: "vacation_authorization_email", value: authEmail.trim() });
    toast("Correo de autorización actualizado");
  };

  const cancelVacation = async (id: string) => {
    const target = vacations.find((v) => v.id === id);
    const ok = await runCancel(async () => {
      const supabase = createClient();
      const res = await supabase.rpc("cancel_vacation", { p_vacation_id: id, p_note: null });
      if (res.error) return { error: { message: "No se pudo cancelar" } };
      if (target?.calendar_event_id) {
        try { await supabase.functions.invoke("gcal-delete-event", { body: { eventId: target.calendar_event_id, calendarId: target.calendar_id ?? vacationCalendarId ?? undefined } }); }
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
        const res = await supabase.rpc("approve_vacation", { p_vacation_id: target.id, p_note: note || null });
        if (res.error) {
          return { error: { message: res.error.message.includes("Saldo") ? res.error.message : "No se pudo actualizar" } };
        }
        if (addToCalendar) {
          const { data: gcalData, error: gcalError } = await supabase.functions.invoke("gcal-create-event", {
            body: {
              title: `🌴 Vacaciones — ${target.users?.display_name ?? ""}`,
              details: `${target.days} días hábiles aprobados en Nexus.`,
              start: target.start_date,
              end: addDays(target.end_date, 1),
              allDay: true,
              calendarId: vacationCalendarId ?? undefined,
            },
          });
          const result = gcalData as { ok?: boolean; eventId?: string; calendarId?: string } | null;
          if (gcalError || !result?.ok) {
            window.open(calendarUrl(target), "_blank");
          } else if (result.eventId) {
            await supabase.from("vacations").update({ calendar_event_id: result.eventId, calendar_id: result.calendarId ?? null }).eq("id", target.id);
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
      notifyUser(createClient(), target.user_id,
        status === "Aprobada" ? "Vacaciones aprobadas — ¡disfrútalas!" : "Tu solicitud de vacaciones fue rechazada",
        `${dmy(target.start_date)} al ${dmy(target.end_date)}${note ? " — " + note : ""}`, "vacation", "/comunicacion/vacaciones");
      setSel(null); setNote("");
    }
  };

  const todayIso = todayMerida();
  const today = todayIso;
  const futuras = vacations.filter((v) => v.status === "Aprobada" && v.start_date > todayIso).length;
  const criticosTeam = team.filter((t) => t.vacation_balance <= 3);
  const criticos = criticosTeam.length;
  const proximoReinicio = team
    .filter((t) => !!t.hire_date)
    .map((t) => ({ t, next: nextAnniversary(t.hire_date as string, today) }))
    .sort((a, b) => a.next.localeCompare(b.next))[0] ?? null;
  const diasParaReinicio = proximoReinicio
    ? Math.max(0, Math.round((new Date(proximoReinicio.next).getTime() - new Date(today).getTime()) / 86400000))
    : null;

  const pending = vacations.filter((v) => v.status === "Pendiente");
  const rest = vacations.filter((v) => v.status !== "Pendiente");

  // ── Vacaciones aprobadas que siguen vigentes o están por venir — base de
  //    timeline, ocupación, "próximamente" y alertas de cobertura. ──
  const approvedUpcoming = useMemo(
    () => vacations.filter((v) => v.status === "Aprobada" && v.end_date >= todayIso).sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [vacations, todayIso]
  );

  // ── Alertas inteligentes — solo si hay datos reales que las respalden ──
  const smartAlerts = useMemo<SmartAlert[]>(() => {
    const alerts: SmartAlert[] = [];

    // 1) Traslapes entre solicitudes activas (pendientes o aprobadas) de personas distintas.
    const active = vacations.filter((v) => (v.status === "Aprobada" || v.status === "Pendiente") && v.end_date >= todayIso);
    const overlaps: { aName: string; bName: string; start: string; end: string }[] = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        if (a.user_id === b.user_id) continue;
        const start = a.start_date > b.start_date ? a.start_date : b.start_date;
        const end = a.end_date < b.end_date ? a.end_date : b.end_date;
        if (start <= end) {
          overlaps.push({ aName: a.users?.display_name ?? "—", bName: b.users?.display_name ?? "—", start, end });
        }
      }
    }
    if (overlaps.length === 1) {
      const o = overlaps[0];
      alerts.push({ icon: "alert", tone: "danger", text: `${o.aName} y ${o.bName} se traslapan del ${dmy(o.start)} al ${dmy(o.end)}.` });
    } else if (overlaps.length > 1) {
      alerts.push({ icon: "alert", tone: "danger", text: `${overlaps.length} pares de solicitudes se traslapan en fechas — revisa antes de aprobar.` });
    }

    // 2) Cobertura baja del equipo — día (próximos 60) con más gente fuera a la vez.
    if (team.length >= 3) {
      const counts = Array.from({ length: TIMELINE_WINDOW }, () => 0);
      for (const v of approvedUpcoming) {
        for (let i = 0; i < TIMELINE_WINDOW; i++) {
          const day = addDays(todayIso, i);
          if (v.start_date <= day && day <= v.end_date) counts[i]++;
        }
      }
      for (let i = 0; i < TIMELINE_WINDOW; i++) {
        const available = team.length - counts[i];
        if (counts[i] > 0 && available <= 2) {
          alerts.push({ icon: "users", tone: "warn", text: `El ${dmy(addDays(todayIso, i))} solo estarían disponibles ${available} de ${team.length} personas.` });
          break;
        }
      }
    }

    // 3) Días en riesgo de perderse antes del próximo reinicio (≤30 días, saldo > 0).
    const atRisk = team
      .filter((t) => !!t.hire_date)
      .map((t) => {
        const next = nextAnniversary(t.hire_date as string, todayIso);
        const diff = Math.round((new Date(next).getTime() - new Date(todayIso).getTime()) / 86400000);
        return { t, next, diff };
      })
      .filter((x) => x.diff <= 30 && x.t.vacation_balance > 0)
      .sort((a, b) => a.diff - b.diff);
    if (atRisk.length === 1) {
      const x = atRisk[0];
      alerts.push({ icon: "alarm", tone: "warn", text: `${x.t.display_name} perdería ${x.t.vacation_balance} ${x.t.vacation_balance === 1 ? "día" : "días"} si no los usa antes del ${dmy(x.next)}.` });
    } else if (atRisk.length > 1) {
      alerts.push({ icon: "alarm", tone: "warn", text: `${atRisk.length} personas perderían días de vacaciones antes de su reinicio — revisa el detalle.` });
    }

    return alerts.slice(0, 3);
  }, [vacations, team, approvedUpcoming, todayIso]);

  // ── Timeline de ocupación (60 días) — una fila por persona con vacación vigente/futura. ──
  const timelineRows = useMemo(() => {
    const byUser = new Map<string, { name: string; color: string | null; avatarUrl: string | null; bars: { leftPct: number; widthPct: number; label: string }[] }>();
    for (const v of approvedUpcoming) {
      const clampStart = v.start_date < todayIso ? todayIso : v.start_date;
      const windowEnd = addDays(todayIso, TIMELINE_WINDOW - 1);
      const clampEnd = v.end_date > windowEnd ? windowEnd : v.end_date;
      if (clampStart > windowEnd || clampEnd < todayIso) continue;
      const leftPct = (daysBetween(todayIso, clampStart) / TIMELINE_WINDOW) * 100;
      const widthPct = Math.max(1.4, ((daysBetween(clampStart, clampEnd) + 1) / TIMELINE_WINDOW) * 100);
      const key = v.user_id;
      const entry = byUser.get(key) ?? { name: v.users?.display_name ?? "—", color: v.users?.nexus_color ?? null, avatarUrl: v.users?.avatar_url ?? null, bars: [] };
      entry.bars.push({ leftPct, widthPct, label: `${dmy(v.start_date)} → ${dmy(v.end_date)}` });
      byUser.set(key, entry);
    }
    return Array.from(byUser.values()).sort((a, b) => a.bars[0].leftPct - b.bars[0].leftPct);
  }, [approvedUpcoming, todayIso]);

  const occupancy = useMemo(() => {
    const counts = Array.from({ length: TIMELINE_WINDOW }, () => 0);
    for (const v of approvedUpcoming) {
      for (let i = 0; i < TIMELINE_WINDOW; i++) {
        const day = addDays(todayIso, i);
        if (v.start_date <= day && day <= v.end_date) counts[i]++;
      }
    }
    return counts;
  }, [approvedUpcoming, todayIso]);

  const occupancyColor = (count: number) => {
    if (count === 0) return "var(--surface-2)";
    const available = team.length - count;
    if (available <= 1) return "var(--danger)";
    if (available <= 2) return "var(--warn)";
    return "var(--accent)";
  };

  // ── Próximamente — quiénes salen pronto (no han empezado aún) ──
  const proximamente = useMemo(
    () => approvedUpcoming
      .filter((v) => v.start_date > todayIso)
      .slice(0, 5)
      .map((v) => ({ v, daysUntil: daysBetween(todayIso, v.start_date) })),
    [approvedUpcoming, todayIso]
  );

  const heroHeadline = pending.length > 0
    ? `Hay ${pending.length} ${pending.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"} de revisión.`
    : "Todo está al corriente.";
  const heroSub = pending.length > 0
    ? "Revísalas abajo antes de que se acumulen."
    : futuras > 0
    ? `${futuras} ${futuras === 1 ? "vacación ya está programada" : "vacaciones ya están programadas"}.`
    : "No hay vacaciones programadas por ahora.";

  const vacCsvHref = useMemo(() => {
    const rows = [
      ["Persona", "Inicio", "Fin", "Días", "Estado", "Nota admin"],
      ...vacations
        .slice()
        .sort((a, b) => b.start_date.localeCompare(a.start_date))
        .map((v) => [v.users?.full_name ?? v.users?.display_name ?? "—", v.start_date, v.end_date, String(v.days), v.status, v.admin_note ?? ""]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join(String.fromCharCode(10));
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [vacations]);

  /** Estado visual de una vacación aprobada: en curso / programada / pasada — solo para etiqueta, no toca el status real en BD. */
  const approvedPhaseLabel = (v: Vacation) => {
    if (v.status !== "Aprobada") return v.status;
    if (v.start_date <= todayIso && v.end_date >= todayIso) return "En curso";
    if (v.start_date > todayIso) return "Programada";
    return "Aprobada";
  };
  const approvedPhaseTone = (v: Vacation): "warn" | "ok" | "danger" | "muted" | "accent" => {
    if (v.status !== "Aprobada") return STATUS_TONE[v.status];
    if (v.start_date <= todayIso && v.end_date >= todayIso) return "accent";
    if (v.start_date > todayIso) return "muted";
    return "ok";
  };

  return (
    <>
      <header className="pt-8 pb-1 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Vacaciones</h1>
          <p className="text-[14.5px] mt-1.5 font-semibold" style={{ color: pending.length > 0 ? "var(--warn)" : "var(--ok)" }}>
            {heroHeadline}
          </p>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-3)" }}>{heroSub}</p>
        </div>
        <a href={vacCsvHref} download="vacaciones-registro.csv" className="btn-secondary px-4 py-2.5 text-[13px] flex items-center gap-1.5"
          onClick={() => { if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "vacaciones-registro.csv"); }}>
          <IconDownload className="w-3.5 h-3.5" /> Exportar CSV
        </a>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-5 mb-5">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--text-3)" }}><Icon name="plane" size={13} /><span className="text-[10.5px] font-semibold">Pendientes</span></div>
          <p className="text-[22px] font-bold tabular-nums" style={{ color: pending.length > 0 ? "var(--warn)" : undefined }}>{pending.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--text-3)" }}><Icon name="calendar" size={13} /><span className="text-[10.5px] font-semibold">Programadas</span></div>
          <p className="text-[22px] font-bold tabular-nums">{futuras}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--text-3)" }}><Icon name="alert" size={13} /><span className="text-[10.5px] font-semibold">Saldo bajo</span></div>
          <p className="text-[22px] font-bold tabular-nums" style={{ color: criticos > 0 ? "var(--danger)" : undefined }}>{criticos}</p>
          {criticos > 0 && (
            <p className="text-[10px] mt-1 truncate" style={{ color: "var(--text-3)" }} title={criticosTeam.map((t) => t.display_name).join(", ")}>
              {criticosTeam.slice(0, 2).map((t) => t.display_name).join(", ")}{criticos > 2 ? ` +${criticos - 2}` : ""}
            </p>
          )}
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--text-3)" }}><Icon name="alarm" size={13} /><span className="text-[10.5px] font-semibold">Próx. reinicio</span></div>
          <p className="text-[22px] font-bold tabular-nums">{diasParaReinicio ?? "—"}{diasParaReinicio !== null && <span className="text-[12px] font-semibold ml-1" style={{ color: "var(--text-3)" }}>días</span>}</p>
          {proximoReinicio && (
            <p className="text-[10px] mt-1 truncate" style={{ color: "var(--text-3)" }}>
              {proximoReinicio.t.display_name} · {shortDate(proximoReinicio.next)}
            </p>
          )}
        </div>
      </div>

      {/* Alertas inteligentes — filas delgadas, no tarjeta grande. */}
      {smartAlerts.length > 0 && (
        <div className="flex flex-col mb-5">
          {smartAlerts.map((a, i) => {
            const color = a.tone === "danger" ? "var(--danger)" : a.tone === "warn" ? "var(--warn)" : "var(--accent)";
            return (
              <div key={i} className="flex items-center gap-2.5 py-2 border-b border-border last:border-0">
                <span className="shrink-0" style={{ color }}><Icon name={a.icon} size={15} /></span>
                <p className="text-[13px] font-semibold flex-1 min-w-0 text-text-1">{a.text}</p>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-[15px] font-bold mb-3">Pendientes {pending.length > 0 && `(${pending.length})`}</h2>
      {pending.length === 0 && (
        <div className="mb-6 flex items-center gap-2.5 rounded-m px-4 py-3" style={{ background: "var(--ok-tint)" }}>
          <span style={{ color: "var(--ok)" }}><Icon name="check" size={16} /></span>
          <div>
            <p className="text-[13px] font-bold" style={{ color: "var(--ok)" }}>Todo al corriente</p>
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>No hay solicitudes pendientes.</p>
          </div>
        </div>
      )}
      {pending.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-6">
          {pending.map((v) => (
            <div key={v.id} className="card px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} size={34} avatarUrl={v.users?.avatar_url} birthday={isBirthdayToday(v.users?.birth_date, todayISO())} />
                <div>
                  <p className="text-[14px] font-bold">{v.users?.full_name}</p>
                  <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
                    {dmy(v.start_date)} → {dmy(v.end_date)} · {v.days} {v.days === 1 ? "día hábil" : "días hábiles"}
                  </p>
                </div>
              </div>
              <button className="btn-primary px-5 py-2.5 text-[13px]" onClick={() => { setSel(v); setNote(""); }}>
                Revisar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Registrar vacaciones — acción rápida compacta, tipo Stripe. */}
      <div className="card p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="plane" size={15} style={{ color: "var(--text-3)" }} />
          <p className="text-[13.5px] font-bold">Registrar vacaciones</p>
          <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>— salta el flujo de solicitud, queda Aprobada de inmediato.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <SelectField value={regUserId} onChange={setRegUserId} label="Empleado">
            <option value="">Seleccionar…</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.display_name} · {t.vacation_balance} días</option>)}
          </SelectField>
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Desde</label>
            <DatePicker value={regStart ?? ""}
              onChange={(v) => {
                setRegStart(v || null);
                if (v && regEnd && v > regEnd) setRegEnd(null);
              }} />
          </div>
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Hasta</label>
            <DatePicker value={regEnd ?? ""} minDate={regStart ?? undefined} disabled={!regStart}
              onChange={(v) => setRegEnd(v || null)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <p className="text-[12.5px] font-semibold" style={{
            color: !regStart || !regEnd ? "var(--text-3)" : regDays === 0 || regOverBalance ? "var(--danger)" : "var(--ok)",
          }}>
            {regMessage}
          </p>
          <button className="btn-primary btn-ok py-2.5 px-6 text-[13.5px]" disabled={registering || !regUserId || regDays === 0 || regOverBalance} onClick={registerDirect}>
            {registering ? "Registrando…" : "Registrar"}
          </button>
        </div>
      </div>

      {/* Configuración avanzada — colapsable, solo se toca una vez. */}
      <div className="card mb-7 overflow-hidden">
        <button className="w-full flex items-center justify-between gap-3 px-4 py-3" onClick={() => setAdvancedOpen((o) => !o)}>
          <p className="text-[13px] font-semibold">Configuración avanzada</p>
          <span className="shrink-0 transition-transform" style={{ color: "var(--text-3)", transform: advancedOpen ? "rotate(180deg)" : "none" }}>
            <Icon name="chevronDown" size={15} />
          </span>
        </button>
        {advancedOpen && (
          <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
            <p className="text-[13px] font-semibold whitespace-nowrap">Correo de autorización (dirección)</p>
            <input
              className="field-input flex-1 min-w-[220px] text-[13px]" placeholder="direccion@cert.edu.mx (opcional)"
              value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} onBlur={saveAuthEmail}
            />
            <p className="text-[11.5px] w-full" style={{ color: "var(--text-3)" }}>
              Cuando alguien solicite vacaciones, el correo de solicitud formal también llegará aquí para autorización externa — además de a Samuel, como siempre.
            </p>
          </div>
        )}
      </div>

      {/* Saldos del equipo — barra de progreso + semáforo de color. */}
      <h2 className="text-[15px] font-bold mb-3">Equipo — saldo de vacaciones</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 mb-7">
        {team.map((t) => {
          const total = t.vacation_days_per_year || 0;
          const used = Math.max(0, total - t.vacation_balance);
          const pctUsed = total > 0 ? Math.round((used / total) * 100) : 0;
          const pctAvailable = total > 0 ? Math.max(2, Math.round((t.vacation_balance / total) * 100)) : 0;
          const color = balanceColor(pctUsed);
          const seniority = seniorityLabel(t.hire_date);
          return (
            <div key={t.id} className="card p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <Avatar name={t.display_name} color={t.nexus_color} size={32} avatarUrl={t.avatar_url} birthday={isBirthdayToday(t.birth_date, todayISO())} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold truncate">{t.display_name}</p>
                  {seniority && <p className="text-[10.5px] truncate" style={{ color: "var(--text-3)" }}>{seniority}</p>}
                </div>
                <p className="text-[20px] font-bold tabular-nums shrink-0" style={{ color }}>{t.vacation_balance}</p>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${pctAvailable}%`, background: color, transition: "width .4s var(--ease)" }} />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[10.5px]" style={{ color: "var(--text-3)" }}>{used} usados de {total}</p>
                {t.lastReset && (
                  <p className="text-[9.5px]" style={{ color: "var(--text-3)" }}
                    title={`Ciclo anterior: ${t.lastReset.days_used} usados de ${t.lastReset.days_granted}${t.lastReset.days_forfeited > 0 ? ` · ${t.lastReset.days_forfeited} perdidos` : ""}`}>
                    Reinició {shortDate(t.lastReset.reset_at)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ocupación del equipo — timeline de 60 días, para detectar quién coincide/sale/regresa. */}
      <h2 className="text-[15px] font-bold mb-1">Ocupación del equipo</h2>
      <p className="text-[12px] mb-3" style={{ color: "var(--text-3)" }}>Próximos {TIMELINE_WINDOW} días · {shortDate(todayIso)} → {shortDate(addDays(todayIso, TIMELINE_WINDOW - 1))}</p>
      <div className="card p-4 mb-7">
        {timelineRows.length === 0 ? (
          <p className="text-[12.5px] py-4 text-center" style={{ color: "var(--text-3)" }}>Nadie tiene vacaciones programadas en este periodo.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-[140px] shrink-0" />
              <div className="flex-1 h-2 rounded-full overflow-hidden flex">
                {occupancy.map((c, i) => (
                  <div key={i} className="h-full" style={{ width: `${100 / TIMELINE_WINDOW}%`, background: occupancyColor(c) }} title={`${shortDate(addDays(todayIso, i))} · ${c} fuera`} />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {timelineRows.map((row, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-[140px] shrink-0 flex items-center gap-2">
                    <Avatar name={row.name} color={row.color} avatarUrl={row.avatarUrl} size={22} />
                    <p className="text-[12px] font-semibold truncate">{row.name}</p>
                  </div>
                  <div className="flex-1 h-6 rounded-sm relative" style={{ background: "var(--surface-2)" }}>
                    {row.bars.map((b, j) => (
                      <div key={j} className="absolute top-0.5 bottom-0.5 rounded-sm" title={b.label}
                        style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%`, background: row.color ?? "#8E8E93" }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pl-[152px]">
              <p className="text-[10.5px]" style={{ color: "var(--text-3)" }}>Hoy</p>
              <p className="text-[10.5px]" style={{ color: "var(--text-3)" }}>+{TIMELINE_WINDOW} días</p>
            </div>
          </>
        )}
      </div>

      {/* Próximamente — quiénes salen pronto. */}
      {proximamente.length > 0 && (
        <>
          <h2 className="text-[15px] font-bold mb-3">Próximamente</h2>
          <div className="card p-2 mb-7">
            {proximamente.map(({ v, daysUntil }, i) => (
              <div key={v.id} className={`flex items-center gap-3 px-3 py-2.5 ${i < proximamente.length - 1 ? "border-b border-border" : ""}`}>
                <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} avatarUrl={v.users?.avatar_url} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold truncate">{v.users?.display_name}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>{dmy(v.start_date)} → {dmy(v.end_date)} · {v.days} {v.days === 1 ? "día" : "días"}</p>
                </div>
                <p className="text-[12px] font-semibold shrink-0" style={{ color: daysUntil <= 3 ? "var(--accent)" : "var(--text-3)" }}>
                  {daysUntil === 0 ? "Hoy" : daysUntil === 1 ? "Mañana" : `en ${daysUntil} días`}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold">Historial ({rest.length})</h2>
            {rest.length > 5 && (
              <button className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}
                onClick={() => setHistoryOpen((o) => !o)}>
                {historyOpen ? "Ocultar ↑" : `Ver todo ↓`}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            {(historyOpen ? rest : rest.slice(0, 5)).map((v) => (
              <div key={v.id} className="card px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} avatarUrl={v.users?.avatar_url} size={28} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold truncate">{v.users?.display_name} · {dmy(v.start_date)} → {dmy(v.end_date)}</p>
                    <p className="text-[12px] truncate" style={{ color: "var(--text-2)" }}>
                      {v.days} {v.days === 1 ? "día" : "días"}{v.admin_note && ` · ${v.admin_note}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Pill tone={approvedPhaseTone(v)}>{approvedPhaseLabel(v)}</Pill>
                  {v.status === "Aprobada" && (
                    confirmCancelId === v.id ? (
                      <div className="flex items-center gap-1">
                        <button className="btn-tertiary px-2.5 py-1.5 text-[11.5px]" style={{ color: "var(--danger)" }}
                          disabled={cancelling} onClick={() => cancelVacation(v.id)}>
                          {cancelling ? "Cancelando…" : "Sí, cancelar"}
                        </button>
                        <button className="btn-tertiary px-2.5 py-1.5 text-[11.5px]" onClick={() => setConfirmCancelId(null)}>
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <button className="btn-tertiary px-2.5 py-1.5 text-[11.5px]" onClick={() => openEdit(v)}>
                          Editar
                        </button>
                        <button className="btn-tertiary px-2.5 py-1.5 text-[11.5px]" onClick={() => setConfirmCancelId(v.id)}>
                          Cancelar
                        </button>
                      </>
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
                {dmy(sel.start_date)} → {dmy(sel.end_date)} · {sel.days} {sel.days === 1 ? "día hábil" : "días hábiles"}
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

      <Sheet open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar vacación">
        {editTarget && (
          <div className="flex flex-col gap-3.5">
            <div className="rounded-sm px-4 py-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-[14px] font-bold">{editTarget.users?.full_name}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-3)" }}>
                Fechas originales: {dmy(editTarget.start_date)} → {dmy(editTarget.end_date)} · {editTarget.days} días
              </p>
            </div>
            <DateRangeCalendar
              start={editStart} end={editEnd}
              onSelect={(s, e) => { setEditStart(s); setEditEnd(e); }}
              holidays={holidaySet}
            />
            {editDays > 0 && (
              <div className="rounded-sm px-4 py-3 text-[13px] font-semibold" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                {editDays} {editDays === 1 ? "día hábil" : "días hábiles"}
              </div>
            )}
            <button className="btn-primary btn-ok py-3 text-[14px]" disabled={editing || editDays === 0} onClick={saveEdit}>
              {editing ? "Guardando…" : "Guardar cambios"}
            </button>
            <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
              El saldo del empleado se ajusta automáticamente según la diferencia de días.
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}
