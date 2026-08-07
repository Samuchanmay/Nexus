"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Vacation } from "@/lib/types";
import { useToast, Pill, Avatar, Sheet, DateRangeCalendar, DateRangeField, Select, CheckBox } from "@/components/ui";
import { IconDownload } from "@/components/icons";
import { Icon } from "@/components/os/icons";
import { useSupabaseMutation, Field } from "@/components/shared";
import { Button, StatCard } from "@/components/os/ui";
import { VACATION_TONE as STATUS_TONE } from "@/lib/ui-maps";
import { vacationCalendarUrl as calendarUrl } from "@/lib/gcal";
import { seniorityLabel, addDays, shortDate, dmy, nextAnniversary, todayMerida } from "@/lib/tz";
import { MONTHS, DOW, monthBounds, buildMonthGrid } from "@/lib/calendar-grid";
import { businessDaysBetween } from "@/lib/hours";
import { logAdminAction } from "@/lib/admin-log";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { notifyUser } from "@/lib/notify";
import { fetchVacationReportRows, VACATION_COLUMNS, type VacationReportRow } from "@/lib/reports/vacations";
import { buildGeneratedAtLabel, downloadReportXlsx } from "@/lib/reports/xlsx-builder";
import type { ReportHeaderInfo, ReportWorkbookConfig } from "@/lib/reports/types";

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
  // FASE P — "Cobertura del equipo": antes la única vista de ocupación
  // cubría 60 días, insuficiente para planear temporada (ej. diciembre)
  // con meses de anticipación. Colapsada por default: es una vista densa
  // de apoyo, no algo que se consulte en cada visita a la página.
  const [coverageOpen, setCoverageOpen] = useState(false);
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
      // Auditoría de notificaciones: cancelar reembolsaba el saldo pero
      // nunca avisaba al empleado — se enteraba solo si volvía a mirar la
      // pantalla de Vacaciones por su cuenta.
      if (target?.user_id) {
        notifyUser(createClient(), target.user_id, "Se canceló tu periodo de vacaciones",
          `${dmy(target.start_date)} al ${dmy(target.end_date)} — saldo reembolsado`, "vacation", "/comunicacion/vacaciones");
      }
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
              details: `${target.days} días hábiles aprobados en Emet.`,
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
      // Rechazo (7 ago 2026, Reporte de Vacaciones): a diferencia de la
      // aprobación (RPC approve_vacation, que ya guarda resolved_by con
      // my_user_id()), el rechazo es un update directo — hay que mandar
      // resolved_by/resolved_at explícitos aquí para que "Quién autorizó"
      // también quede registrado cuando la decisión fue un rechazo.
      return supabase.from("vacations")
        .update({ status, admin_note: note || null, resolved_by: adminId || null, resolved_at: new Date().toISOString() })
        .eq("id", target.id);
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

  const occupancyColor = (count: number) => {
    if (count === 0) return "var(--surface-2)";
    const available = team.length - count;
    if (available <= 1) return "var(--danger)";
    if (available <= 2) return "var(--warn)";
    return "var(--accent)";
  };

  // ── Cobertura del equipo (vista anual) — mismo cálculo de disponibilidad
  //    que el heatmap de 60 días, pero extendido a 12 meses hacia adelante,
  //    para detectar temporadas apretadas (diciembre, Semana Santa) con
  //    meses de anticipación en vez de solo verlas venir a 2 meses. ──
  const coverageByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of approvedUpcoming) {
      let d = v.start_date < todayIso ? todayIso : v.start_date;
      const yearEnd = addDays(todayIso, 364);
      const end = v.end_date > yearEnd ? yearEnd : v.end_date;
      while (d <= end) { map.set(d, (map.get(d) ?? 0) + 1); d = addDays(d, 1); }
    }
    return map;
  }, [approvedUpcoming, todayIso]);

  const coverageMonths = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const base = new Date(`${todayIso.slice(0, 7)}-01T12:00:00Z`);
    base.setUTCMonth(base.getUTCMonth() + i);
    const ymI = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
    const b = monthBounds(ymI);
    return { ...b, cells: buildMonthGrid(b.first, b.last, b.daysInMonth) };
  }), [todayIso]);

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

  const [exporting, setExporting] = useState(false);
  const exportRegistro = async () => {
    setExporting(true);
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();
      const range = { from: `${year}-01-01`, to: `${year}-12-31` };
      const { rows, summary } = await fetchVacationReportRows(supabase, { range });
      const header: ReportHeaderInfo = {
        title: "Vacaciones",
        periodLabel: `Año ${year}`,
        generatedAtLabel: buildGeneratedAtLabel(),
        appliedFilters: [
          { label: "Empleado", value: "Todos" },
          { label: "Departamento", value: "Todos" },
          { label: "Estatus", value: "Todos" },
          { label: "Periodo", value: `Año ${year}` },
        ],
      };
      const config: ReportWorkbookConfig<VacationReportRow> = {
        header,
        columns: VACATION_COLUMNS,
        rows,
        filenameBase: "vacaciones-registro",
        summary: summary ? [
          { label: "Tomadas este año", value: summary.tomadasEsteAnio },
          { label: "Próximos reinicios", value: summary.proximosReinicios },
          { label: "Saldo bajo (<5 días)", value: summary.saldoBajo },
        ] : undefined,
      };
      await downloadReportXlsx(config);
      if (adminId) logAdminAction(supabase, adminId, "Exportó reporte", "vacaciones-registro.xlsx");
    } finally {
      setExporting(false);
    }
  };

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
      {/* Header compacto */}
      <header className="pt-6 pb-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-text-1 leading-none">Vacaciones</h1>
            <p className="text-[15px] mt-2" style={{ color: pending.length > 0 ? "var(--warn)" : "var(--text-2)" }}>
              {heroHeadline}
            </p>
          </div>
          <button onClick={exportRegistro} disabled={exporting}
            className="h-10 px-4 rounded-lg text-[13.5px] font-semibold transition-all duration-200 hover:bg-hover flex items-center gap-2"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
            <IconDownload className="w-4 h-4" /> {exporting ? "Generando…" : "Exportar Excel"}
          </button>
        </div>
      </header>

      {/* Indicadores con más jerarquía */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="clock" tone="warn" value={String(pending.length)} label="Pendientes" />
        <StatCard icon="check" tone="ok" value={String(futuras)} label="Programadas" />
        <StatCard icon="alert" tone="danger" value={String(criticos)} label="Saldo bajo">
          {criticos > 0 && (
            <p className="text-[12px] truncate" title={criticosTeam.map((t) => t.display_name).join(", ")}>
              {criticosTeam.slice(0, 2).map((t) => t.display_name).join(", ")}{criticos > 2 ? ` +${criticos - 2}` : ""}
            </p>
          )}
        </StatCard>
        <StatCard icon="calendar" tone="accent" value={String(diasParaReinicio ?? "—")} label="Próx. reinicio">
          {proximoReinicio && (
            <p className="text-[12px] truncate">
              {proximoReinicio.t.display_name} · {shortDate(proximoReinicio.next)}
            </p>
          )}
        </StatCard>
      </div>

      {/* Alertas de traslape - más visibles */}
      {smartAlerts.length > 0 && (
        <div className="mb-6">
          {smartAlerts.map((a, i) => {
            const bgColor = a.tone === "danger" ? "var(--danger-tint)" : a.tone === "warn" ? "var(--warn-tint)" : "var(--accent-tint)";
            const color = a.tone === "danger" ? "var(--danger)" : a.tone === "warn" ? "var(--warn)" : "var(--accent)";
            return (
              <div key={i} className="flex items-start gap-3 p-4 rounded-2xl mb-2" style={{ background: bgColor }}>
                <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: color }}>
                  <Icon name={a.icon} size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold" style={{ color }}>{a.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pendientes */}
      <div className="mb-8">
        <h2 className="text-[19px] font-bold text-text-1 mb-4">
          Pendientes
          {pending.length > 0 && <span className="ml-2 text-[14px] font-semibold" style={{ color: "var(--text-3)" }}>({pending.length})</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="flex items-center gap-3 p-5 rounded-2xl" style={{ background: "var(--ok-tint)" }}>
            <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: "var(--ok)" }}>
              <Icon name="check" size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[15px] font-semibold" style={{ color: "var(--ok)" }}>Todo al corriente</p>
              <p className="text-[13.5px]" style={{ color: "var(--text-3)" }}>No hay solicitudes pendientes.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((v) => (
              <div key={v.id} className="group flex items-center justify-between gap-4 p-5 rounded-2xl border border-border hover:border-border-2 hover:shadow-2 hover:-translate-y-[2px] transition-all duration-200" style={{ background: "var(--surface)" }}>
                <div className="flex items-center gap-4">
                  <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} size={48} avatarUrl={v.users?.avatar_url} birthday={isBirthdayToday(v.users?.birth_date, todayISO())} />
                  <div>
                    <p className="text-[16px] font-bold text-text-1">{v.users?.full_name}</p>
                    <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
                      {dmy(v.start_date)} → {dmy(v.end_date)} · {v.days} {v.days === 1 ? "día hábil" : "días hábiles"}
                    </p>
                  </div>
                </div>
                <Button variant="primary" onClick={() => { setSel(v); setNote(""); }}>
                  Revisar
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Registrar vacaciones — acción rápida compacta, tipo Stripe. */}
      <div className="card p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="plane" size={15} style={{ color: "var(--text-3)" }} />
          <p className="text-[13.5px] font-bold">Registrar vacaciones</p>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>— salta el flujo de solicitud, queda Aprobada de inmediato.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Field label="Empleado">
            <Select
              value={regUserId} onChange={setRegUserId} title="Seleccionar empleado"
              options={team.map((t) => ({
                value: t.id, label: t.display_name, sublabel: `${t.vacation_balance} días disponibles`,
                avatar: { name: t.display_name, color: t.nexus_color, avatarUrl: t.avatar_url },
              }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Rango de vacaciones</label>
            <DateRangeField start={regStart} end={regEnd} onSelect={(s, e) => { setRegStart(s); setRegEnd(e); }} />
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
          <p className="text-[13.5px] font-semibold">Configuración avanzada</p>
          <span className="shrink-0 transition-transform" style={{ color: "var(--text-3)", transform: advancedOpen ? "rotate(180deg)" : "none" }}>
            <Icon name="chevronDown" size={15} />
          </span>
        </button>
        {advancedOpen && (
          <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
            <p className="text-[13.5px] font-semibold whitespace-nowrap">Correo de autorización (dirección)</p>
            <input
              className="field-input flex-1 min-w-[220px] text-[13.5px]" placeholder="direccion@cert.edu.mx (opcional)"
              value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} onBlur={saveAuthEmail}
            />
            <p className="text-[12px] w-full" style={{ color: "var(--text-3)" }}>
              Cuando alguien solicite vacaciones, el correo de solicitud formal también llegará aquí para autorización externa — además de a Samuel, como siempre.
            </p>
          </div>
        )}
      </div>

      {/* Saldos del equipo — con más contexto */}
      <div className="mb-8">
        <h2 className="text-[19px] font-bold text-text-1 mb-4">Equipo — saldo de vacaciones</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {team.map((t) => {
            const total = t.vacation_days_per_year || 0;
            const used = Math.max(0, total - t.vacation_balance);
            const pctUsed = total > 0 ? Math.round((used / total) * 100) : 0;
            const pctAvailable = total > 0 ? Math.max(2, Math.round((t.vacation_balance / total) * 100)) : 0;
            const color = balanceColor(pctUsed);
            const seniority = seniorityLabel(t.hire_date);
            const nextReset = t.hire_date ? nextAnniversary(t.hire_date) : null;
            return (
              <div key={t.id} className="group p-5 rounded-2xl border border-border hover:border-border-2 hover:shadow-2 hover:-translate-y-[2px] transition-all duration-200" style={{ background: "var(--surface)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar name={t.display_name} color={t.nexus_color} size={40} avatarUrl={t.avatar_url} birthday={isBirthdayToday(t.birth_date, todayISO())} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold truncate text-text-1">{t.display_name}</p>
                    {seniority && <p className="text-[12px] truncate" style={{ color: "var(--text-3)" }}>{seniority}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[24px] font-bold tabular-nums leading-none" style={{ color }}>{t.vacation_balance}</p>
                    <p className="text-[12px] mt-1" style={{ color: "var(--text-3)" }}>disponibles</p>
                  </div>
                </div>
                
                {/* Barra de progreso */}
                <div className="mb-3">
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pctAvailable}%`, background: color, transition: "width .4s var(--ease)" }} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>
                      {used} usados de {total}
                    </p>
                    <p className="text-[12px] font-semibold" style={{ color }}>
                      {pctUsed}% usado
                    </p>
                  </div>
                </div>

                {/* Información adicional */}
                <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-3)" }}>
                    <Icon name="calendar" size={12} />
                    <span>Reinicia {nextReset ? shortDate(nextReset) : "—"}</span>
                  </div>
                  {t.lastReset && (
                    <p className="text-[12px] mt-1" style={{ color: "var(--text-3)" }}
                      title={`Ciclo anterior: ${t.lastReset.days_used} usados de ${t.lastReset.days_granted}${t.lastReset.days_forfeited > 0 ? ` · ${t.lastReset.days_forfeited} perdidos` : ""}`}>
                      Último ciclo: {shortDate(t.lastReset.reset_at)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cobertura del equipo — vista anual, colapsada por default (FASE P). */}
      <div className="card mb-7 overflow-hidden">
        <button className="w-full flex items-center justify-between gap-3 px-4 py-3" onClick={() => setCoverageOpen((o) => !o)}>
          <div className="text-left">
            <p className="text-[13.5px] font-bold">Cobertura del equipo</p>
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Vista anual — para detectar temporadas apretadas con meses de anticipación</p>
          </div>
          <span className="shrink-0 transition-transform" style={{ color: "var(--text-3)", transform: coverageOpen ? "rotate(180deg)" : "none" }}>
            <Icon name="chevronDown" size={15} />
          </span>
        </button>
        {coverageOpen && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-4 mb-3 flex-wrap text-[12px]" style={{ color: "var(--text-3)" }}>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--surface-2)" }} /> Todo el equipo disponible</span>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--accent)" }} /> Alguien fuera</span>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--warn)" }} /> Cobertura ajustada</span>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--danger)" }} /> Cobertura crítica</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {coverageMonths.map((m) => (
                <div key={`${m.year}-${m.month}`} className="rounded-sm p-3" style={{ background: "var(--surface-2)" }}>
                  <p className="text-[12px] font-bold capitalize mb-2">{MONTHS[m.month - 1]} {m.year}</p>
                  <div className="grid grid-cols-7 gap-[3px] mb-1">
                    {DOW.map((d) => <p key={d} className="text-center text-[8px] font-bold" style={{ color: "var(--text-3)" }}>{d[0]}</p>)}
                  </div>
                  <div className="grid grid-cols-7 gap-[3px]">
                    {m.cells.map((c) => {
                      const count = coverageByDate.get(c.date) ?? 0;
                      const past = c.date < todayIso;
                      return (
                        <div key={c.date}
                          title={past ? undefined : `${dmy(c.date)} · ${count} fuera de ${team.length}`}
                          className="aspect-square rounded-[3px] flex items-center justify-center text-[7.5px] font-semibold tabular-nums"
                          style={{
                            opacity: c.inMonth ? (past ? 0.25 : 1) : 0.15,
                            background: past ? "transparent" : occupancyColor(count),
                            color: count > 0 && !past ? "#fff" : "var(--text-3)",
                          }}>
                          {c.day}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Próximamente — quiénes salen pronto */}
      {proximamente.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[19px] font-bold text-text-1 mb-4">Próximamente</h2>
          <div className="flex flex-col gap-2">
            {proximamente.map(({ v, daysUntil }, i) => (
              <div key={v.id} className="group flex items-center gap-4 p-4 rounded-2xl border border-border hover:border-border-2 hover:shadow-2 transition-all duration-200" style={{ background: "var(--surface)" }}>
                <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} avatarUrl={v.users?.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold truncate text-text-1">{v.users?.display_name}</p>
                  <p className="text-[13.5px]" style={{ color: "var(--text-2)" }}>
                    {dmy(v.start_date)} → {dmy(v.end_date)} · {v.days} {v.days === 1 ? "día" : "días"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-semibold" style={{ color: daysUntil <= 3 ? "var(--accent)" : "var(--text-2)" }}>
                    {daysUntil === 0 ? "Hoy" : daysUntil === 1 ? "Mañana" : `En ${daysUntil} días`}
                  </p>
                  {daysUntil <= 3 && (
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--accent)" }}>¡Pronto!</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial */}
      {rest.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[19px] font-bold text-text-1">
              Historial
              <span className="ml-2 text-[14px] font-semibold" style={{ color: "var(--text-3)" }}>({rest.length})</span>
            </h2>
            {rest.length > 5 && (
              <button 
                className="h-9 px-4 rounded-lg text-[13.5px] font-semibold transition-all duration-200 hover:bg-hover flex items-center gap-2"
                style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
                onClick={() => setHistoryOpen((o) => !o)}>
                {historyOpen ? "Ocultar" : `Ver todo`}
                <Icon name={historyOpen ? "chevronUp" : "chevronDown"} size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {(historyOpen ? rest : rest.slice(0, 5)).map((v) => (
              <div key={v.id} className="group flex items-center justify-between gap-4 p-4 rounded-2xl border border-border hover:border-border-2 hover:shadow-2 transition-all duration-200" style={{ background: "var(--surface)" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={v.users?.display_name ?? "?"} color={v.users?.nexus_color} avatarUrl={v.users?.avatar_url} size={36} />
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold truncate text-text-1">{v.users?.display_name}</p>
                    <p className="text-[12px] truncate" style={{ color: "var(--text-2)" }}>
                      {dmy(v.start_date)} → {dmy(v.end_date)} · {v.days} {v.days === 1 ? "día" : "días"}
                      {v.admin_note && ` · ${v.admin_note}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span 
                    className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ 
                      background: v.status === "Aprobada" ? "var(--ok-tint)" : v.status === "Pendiente" ? "var(--warn-tint)" : "var(--danger-tint)",
                      color: v.status === "Aprobada" ? "var(--ok)" : v.status === "Pendiente" ? "var(--warn)" : "var(--danger)"
                    }}>
                    {v.status}
                  </span>
                  {v.status === "Aprobada" && (
                    confirmCancelId === v.id ? (
                      <div className="flex items-center gap-1">
                        <button 
                          className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-all duration-200"
                          style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
                          disabled={cancelling} onClick={() => cancelVacation(v.id)}>
                          {cancelling ? "Cancelando…" : "Sí"}
                        </button>
                        <button 
                          className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-all duration-200 hover:bg-hover"
                          style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
                          onClick={() => setConfirmCancelId(null)}>
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-all duration-200 hover:bg-hover"
                          style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
                          onClick={() => openEdit(v)}>
                          Editar
                        </button>
                        <button 
                          className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-all duration-200 hover:bg-hover"
                          style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
                          onClick={() => setConfirmCancelId(v.id)}>
                          Cancelar
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
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
            <Field label="Nota (opcional, visible para el empleado)">
              <input className="field-input" placeholder="Ej. Aprobado con VoBo de dirección"
                value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2.5 text-[13.5px] font-semibold cursor-pointer">
              <input type="checkbox" className="hidden" checked={addToCalendar} onChange={(e) => setAddToCalendar(e.target.checked)} />
              <CheckBox checked={addToCalendar} />
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
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
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
              <div className="rounded-sm px-4 py-3 text-[13.5px] font-semibold" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                {editDays} {editDays === 1 ? "día hábil" : "días hábiles"}
              </div>
            )}
            <button className="btn-primary btn-ok py-3 text-[14px]" disabled={editing || editDays === 0} onClick={saveEdit}>
              {editing ? "Guardando…" : "Guardar cambios"}
            </button>
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
              El saldo del empleado se ajusta automáticamente según la diferencia de días.
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}
