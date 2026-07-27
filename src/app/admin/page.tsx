import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { summarizeDay, fmtTime, stateAfter, TRABAJANDO, scheduleFor } from "@/lib/hours";
import { resolvePresence, WORK_STATUS_LABEL } from "@/lib/status";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { todayMerida, nowMeridaMinutes, shortDate, addDays } from "@/lib/tz";
import { Card, SectionTitle, Badge, Avatar, EmptyState } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { contextualMessages } from "@/lib/assistant";
import type { AssistantTask } from "@/lib/assistant";
import { PausaActivaPopup } from "@/components/os/pausa-activa-popup";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { ContextHeader } from "@/components/context-header";
import type { ContextHeaderInput } from "@/lib/context-header";
import { LiveJornadaHero } from "@/components/shared/live-jornada-hero";

/* ═══════════════════════════════════════════════════════════════
   Hoy · Centro de Operaciones (admin)
   Rediseño sobre el sistema de diseño Nexus OS (Card/Badge/StatCard),
   con el mismo contenido real de siempre — nada inventado — más dos
   bloques nuevos: Actividades activas y Solicitudes por revisar,
   que reemplazan a los KPIs sueltos por listas accionables reales.
   ═══════════════════════════════════════════════════════════════ */

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
// Para mostrar: 12h con am/pm. Para ordenar cronológicamente: 24h (no usar el 12h para sort).
const meridaClock = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Merida" });
const meridaSortKey = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Merida" });

const TYPE_LABEL: Record<string, string> = {
  cobertura: "Cobertura", diseno: "Diseño", lona: "Lona", video: "Video", difusion: "Difusión",
};
const PRIORITY_TONE: Record<string, "danger" | "warn" | "neutral"> = {
  urgente: "danger", alta: "danger", normal: "neutral", baja: "neutral",
};

type ProjRow = {
  id: string; status: string; deadline: string | null; priority: string;
  requests: { title: string; type: string; requester_name: string | null } | null;
  project_assignments: {
    is_lead: boolean;
    users: { display_name: string; nexus_color: string | null; avatar_url?: string | null; birth_date?: string | null } | null;
    project_checklist: { done: boolean }[];
  }[];
};

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("users").select("*").eq("auth_id", user!.id).single();

  const today = todayMerida();
  const utcDayStart = `${today}T06:00:00Z`; // medianoche Mérida (UTC-6)
  const [
    { count: pendingReqs }, { count: pendingVacs }, { count: pendingIncs },
    { count: activeProjects }, { data: myAtt }, { data: myScheds },
    { data: team }, { data: teamAtt }, { data: allScheds },
    { data: vacsToday }, { data: urgentReqs }, { data: holidayToday },
    { data: reqsToday }, { data: vacsCreatedToday },
    { data: activeProjectsList }, { data: pendingRequestsList },
    { data: jornadaStates }, { data: myActionsToday },
    { data: vacsSoon },
  ] = await Promise.all([
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "solicitada"),
    supabase.from("vacations").select("id", { count: "exact", head: true }).eq("status", "Pendiente").is("archived_at", null),
    supabase.from("incidents").select("id", { count: "exact", head: true }).eq("status", "Pendiente"),
    supabase.from("projects").select("id", { count: "exact", head: true }).in("status", ["aprobada", "en_progreso", "en_revision"]),
    supabase.from("attendance").select("*").eq("user_id", me!.id).eq("date", today).order("time"),
    supabase.from("schedules").select("*").eq("user_id", me!.id),
    supabase.from("users").select("id, display_name, nexus_color, avatar_url, birth_date").eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("attendance").select("id, user_id, type, reason, time").eq("date", today).order("time"),
    supabase.from("schedules").select("user_id, start_time, end_time, tolerance_min, valid_from, valid_until"),
    supabase.from("vacations").select("user_id, start_date, end_date").eq("status", "Aprobada").is("archived_at", null).lte("start_date", today).gte("end_date", today),
    supabase.from("requests").select("id, title, priority").eq("status", "solicitada").in("priority", ["alta", "urgente"]),
    supabase.from("holidays").select("date, name").eq("date", today).maybeSingle(),
    supabase.from("requests").select("id, title, created_at, requester:requester_id(display_name)").gte("created_at", utcDayStart).order("created_at", { ascending: false }).limit(8),
    supabase.from("vacations").select("id, start_date, end_date, created_at, users:user_id(display_name)").gte("created_at", utcDayStart).order("created_at", { ascending: false }).limit(8),
    supabase.from("projects").select(`
      id, status, deadline, priority,
      requests(title, type, requester_name),
      project_assignments(is_lead, users(display_name, nexus_color, avatar_url, birth_date), project_checklist(done))
    `).in("status", ["aprobada", "en_progreso", "en_revision"]),
    supabase.from("requests").select("id, title, type, requester_name, priority, created_at").eq("status", "solicitada").order("created_at", { ascending: false }),
    supabase.from("jornada_states").select("*").eq("activo", true),
    supabase.from("admin_activity_log").select("id, action, detail, created_at")
      .eq("user_id", me!.id).gte("created_at", utcDayStart).order("created_at", { ascending: false }),
    // "Próximo a vacaciones" — arranca en los próximos 3 días (mismo umbral
    // que "Saldo bajo" en Vacaciones admin). Solo Aprobadas: una Pendiente
    // todavía puede no pasar.
    supabase.from("vacations").select("user_id, start_date").eq("status", "Aprobada").is("archived_at", null)
      .gt("start_date", today).lte("start_date", addDays(today, 3)),
  ]);

  // Regreso de vacaciones: propias, que hayan terminado en los últimos 2
  // días (no hoy — hoy todavía cuenta como "de vacaciones"). Consulta aparte
  // y ligera, solo para el Context Header — no afecta el resto del panel.
  const { data: myRecentVac } = await supabase.from("vacations").select("end_date")
    .eq("user_id", me!.id).eq("status", "Aprobada").is("archived_at", null)
    .gte("end_date", addDays(today, -2)).lt("end_date", today).limit(1);
  const returnedRecently = (myRecentVac ?? []).length > 0;

  const states = (jornadaStates ?? []) as JornadaState[];
  const stateColor = new Map(states.map((s) => [s.nombre, s.color]));

  const sched = scheduleFor((myScheds ?? []) as Schedule[], me!.id, today) ?? ({ target_min: 480, tolerance_min: 15, end_time: "18:00:00" } as Schedule);
  const myDay = summarizeDay(today, (myAtt ?? []) as AttendanceRow[], sched, states);
  // Igual que en Mi Día del equipo: inicio del tramo de trabajo continuo
  // actual (última "Entrada", del arranque o de retomar tras un descanso).
  const myLastResume = [...myDay.movements].reverse().find((m) => m.type === "Entrada");
  const myWorkStartTime = myLastResume?.time ?? myDay.firstIn ?? null;

  // Asistente Contextual (Plano Maestro §11): antes solo se armaba en Mi Día
  // del colaborador — el admin nunca lo veía porque su "Hoy" es otra página
  // y nunca se conectó aquí. El admin también lleva actividades propias
  // (cobertura, diseño, etc. — la bitácora de productividad ya lo asume),
  // así que le aplican las mismas reglas: reunión por empezar, actividad
  // por vencer, evidencia faltante, cumpleaños, pausa activa.
  const { data: myAssignments } = await supabase
    .from("project_assignments")
    .select("id, is_lead, projects(id, status, priority, deadline, requests(title, type, event_date, event_time))")
    .eq("user_id", me!.id);
  const myProjectIds = [...new Set((myAssignments ?? [])
    .map((a) => (a.projects as unknown as { id: string } | null)?.id)
    .filter((id): id is string => !!id))];
  const { data: myEvidenceRows } = myProjectIds.length
    ? await supabase.from("evidences").select("project_id").in("project_id", myProjectIds)
    : { data: [] as { project_id: string }[] };
  const myProjectsWithEvidence = new Set((myEvidenceRows ?? []).map((e) => e.project_id as string));
  const myAssistantTasks: AssistantTask[] = (myAssignments ?? [])
    .map((a) => {
      const p = a.projects as unknown as {
        id: string; status: string; deadline: string | null;
        requests: { title: string; event_date: string | null; event_time: string | null } | null;
      } | null;
      if (!p) return null;
      return {
        projectId: p.id, title: p.requests?.title ?? "Actividad", status: p.status, deadline: p.deadline,
        eventDate: p.requests?.event_date ?? null, eventTime: p.requests?.event_time ?? null,
        isLead: a.is_lead as boolean, hasEvidence: myProjectsWithEvidence.has(p.id),
      };
    })
    .filter((t): t is AssistantTask => t !== null && !["completada", "cancelada"].includes(t.status));
  const [{ data: pausaFrases }, { data: pausaSettings }] = await Promise.all([
    supabase.from("pausa_activa_frases").select("texto").eq("activo", true).order("orden"),
    supabase.from("app_settings").select("key, value").in("key", ["pausa_activa_interval_min", "pausa_activa_window_min", "pausa_activa_modo"]),
  ]);
  const pausaSettingsMap = new Map((pausaSettings ?? []).map((s) => [s.key, s.value]));
  const assistantMessages = contextualMessages({
    today, nowMin: nowMeridaMinutes(), tasks: myAssistantTasks,
    birthDate: me!.birth_date ?? null, working: myDay.isOpen, workStartTime: myWorkStartTime,
    pausaActivaFrases: (pausaFrases ?? []).map((f) => f.texto as string),
    pausaActivaIntervalMin: Number(pausaSettingsMap.get("pausa_activa_interval_min")) || undefined,
    pausaActivaWindowMin: Number(pausaSettingsMap.get("pausa_activa_window_min")) || undefined,
    pausaActivaModo: (pausaSettingsMap.get("pausa_activa_modo") as "secuencial" | "aleatorio" | undefined) ?? undefined,
  });

  const nameOf = new Map((team ?? []).map((u) => [u.id, u.display_name]));
  const onVacation = new Set((vacsToday ?? []).map((v) => v.user_id));
  const soonDaysOf = new Map((vacsSoon ?? []).map((v) => {
    const days = Math.round((new Date(v.start_date + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime()) / 86400000);
    return [v.user_id, days];
  }));

  /* ── Presencia por persona (estado en vivo, Plano Maestro §10) ──
     `status`/`color` alimentan las alertas y los conteos de abajo — no se
     tocan por "próximo a vacaciones" para no silenciar una alerta real
     (si a alguien le toca hoy, sigue debiendo iniciar su jornada). El
     matiz de "próximo" se agrega aparte, solo para el punto+etiqueta que
     se muestra en el widget "Equipo hoy". */
  const nowMin = nowMeridaMinutes();
  const presence = (team ?? []).map((u) => {
    const rows = (teamAtt ?? []).filter((a) => a.user_id === u.id);
    const hasIn = rows.some((r) => r.reason === "Entrada a trabajo");
    const done = rows.some((r) => r.reason === "Fin de jornada");
    const last = rows.at(-1);
    const liveState = last ? stateAfter(last) : null;
    // "Equipo hoy" es SIEMPRE de hoy — nunca puede mostrar "No registró
    // salida" (eso solo aplica a días pasados sin resolver, vía pending_exits).
    const presenceStatus = resolvePresence({
      firstIn: hasIn ? "00:00" : null, isOpen: !done, noRegistroSalida: false,
      liveStateName: liveState, liveStateColor: liveState ? (stateColor.get(liveState) ?? null) : null,
      onVacationToday: onVacation.has(u.id),
    });
    const status = done ? "Terminó" : presenceStatus.label;
    const color = presenceStatus.color;
    const soonDays = soonDaysOf.get(u.id);
    const display = status === WORK_STATUS_LABEL.sin_iniciar && soonDays != null
      ? { label: soonDays === 0 ? "Vacaciones hoy" : `Vacaciones en ${soonDays} día${soonDays === 1 ? "" : "s"}`, color: "var(--purple)" }
      : { label: status, color };
    return { ...u, status, color, display };
  });

  const pulse = {
    presentes: presence.filter((p) => p.status === TRABAJANDO).length,
    fuera: presence.filter((p) => !["Vacaciones", "Terminó", "Sin iniciar", TRABAJANDO].includes(p.status)).length,
    completaron: presence.filter((p) => p.status === "Terminó").length,
    vacaciones: presence.filter((p) => p.status === "Vacaciones").length,
  };

  /* ── Alertas inteligentes ── */
  const dow = new Date(`${today}T12:00:00`).getDay(); // 0=dom, 6=sáb
  const isWorkday = dow !== 0 && dow !== 6 && !holidayToday;
  const alerts: { icon: string; text: string; tone: "warn" | "danger" | "accent"; href?: string }[] = [];

  if (holidayToday) {
    alerts.push({ icon: "sparkle", text: `Hoy es día inhábil: ${holidayToday.name}`, tone: "accent" });
  }
  if (isWorkday) {
    for (const p of presence) {
      if (p.status !== "Sin iniciar") continue;
      const s = scheduleFor((allScheds ?? []) as { user_id: string; start_time: string; tolerance_min: number; valid_from: string; valid_until: string | null }[], p.id, today);
      const start = toMin((s?.start_time ?? "09:00:00").slice(0, 5));
      const expected = start + (s?.tolerance_min ?? 15);
      if (nowMin > expected) {
        alerts.push({ icon: "alarm", text: `${p.display_name} aún no inicia jornada (se esperaba a las ${hhmm(start)})`, tone: "warn", href: "/admin/nexus" });
      }
    }
  }
  if ((urgentReqs ?? []).length > 0) {
    alerts.push({
      icon: "flame",
      text: `${urgentReqs!.length} solicitud${urgentReqs!.length > 1 ? "es" : ""} de prioridad alta/urgente sin aprobar`,
      tone: "danger",
      href: "/admin/solicitudes",
    });
  }
  for (const v of vacsToday ?? []) {
    if (v.start_date === today) {
      alerts.push({ icon: "plane", text: `${nameOf.get(v.user_id) ?? "Alguien"} inicia vacaciones hoy (hasta ${shortDate(v.end_date)})`, tone: "accent", href: "/admin/vacaciones" });
    }
  }

  /* ── Feed de actividad de hoy ── */
  type FeedItem = { key: string; icon: string; iconColor?: string; text: string; time: string; sort: string };
  const feed: FeedItem[] = [
    ...((teamAtt ?? []) as { id: string; user_id: string; reason: string; time: string }[]).map((a) => ({
      key: `att-${a.id}`,
      icon: "dot",
      iconColor: a.reason === "Entrada a trabajo" ? "var(--ok)" : a.reason === "Fin de jornada" ? "var(--accent)" : a.reason.startsWith("Salida") ? "var(--warn)" : "var(--text-3)",
      text: `${nameOf.get(a.user_id) ?? "—"} · ${a.reason}`,
      time: fmtTime(a.time),
      sort: a.time.slice(0, 5),
    })),
    ...((reqsToday ?? []) as unknown as { id: string; title: string; created_at: string; requester: { display_name: string } | null }[]).map((r) => ({
      key: `req-${r.id}`,
      icon: "inbox",
      iconColor: "var(--text-2)",
      text: `${r.requester?.display_name ?? "—"} creó la solicitud "${r.title}"`,
      time: meridaClock(r.created_at),
      sort: meridaSortKey(r.created_at),
    })),
    ...((vacsCreatedToday ?? []) as unknown as { id: string; start_date: string; end_date: string; created_at: string; users: { display_name: string } | null }[]).map((v) => ({
      key: `vac-${v.id}`,
      icon: "plane",
      iconColor: "var(--accent)",
      text: `${v.users?.display_name ?? "—"} solicitó vacaciones (${shortDate(v.start_date)} → ${shortDate(v.end_date)})`,
      time: meridaClock(v.created_at),
      sort: meridaSortKey(v.created_at),
    })),
  ].sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 12);

  /* ── Actividades activas (progreso real por checklist) ── */
  const activities = ((activeProjectsList ?? []) as unknown as ProjRow[]).map((p) => {
    const lead = p.project_assignments.find((a) => a.is_lead)?.users ?? p.project_assignments[0]?.users ?? null;
    const items = p.project_assignments.flatMap((a) => a.project_checklist ?? []);
    const done = items.filter((i) => i.done).length;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    return {
      id: p.id,
      title: p.requests?.title ?? "Actividad",
      type: p.requests?.type ?? "",
      deadline: p.deadline,
      lead,
      pct,
    };
  }).sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")).slice(0, 6);

  /* ── Solicitudes por revisar ── */
  const pendingList = (pendingRequestsList ?? []).slice(0, 6);

  const hour = Number(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", hour12: false, timeZone: "America/Merida" }));
  const firstName = me!.display_name.split(" ")[0];

  /* ── Context Header — señales reales para el motor de saludo/subtítulo ── */
  const myBirthdayToday = isBirthdayToday(me!.birth_date, todayISO());
  const othersBirthdayToday = (team ?? [])
    .filter((u) => u.id !== me!.id && isBirthdayToday(u.birth_date, todayISO()))
    .map((u) => u.display_name.split(" ")[0]);
  const roleContextPendingCount = (pendingReqs ?? 0) + (pendingVacs ?? 0) + (pendingIncs ?? 0);
  const activeTeam = presence.filter((p) => p.status !== "Vacaciones");
  const teamAllIn = isWorkday && activeTeam.length > 0 && activeTeam.every((p) => p.status !== "Sin iniciar");
  const contextInput: ContextHeaderInput = {
    role: "admin",
    name: firstName,
    hour, dow,
    todayISO: todayISO(),
    isBirthdayToday: myBirthdayToday,
    vacation: { today: onVacation.has(me!.id), soonDays: soonDaysOf.get(me!.id) ?? null, returnedRecently },
    pendingCount: roleContextPendingCount,
    teamAllIn,
    othersBirthdayToday,
    allDone: alerts.length === 0 && roleContextPendingCount === 0,
    isHoliday: !!holidayToday,
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="space-y-0.5">
        <ContextHeader input={contextInput} />
        {alerts.length > 0 && (
          <p className="text-[13px] text-text-3">
            {alerts.length} alerta{alerts.length > 1 ? "s" : ""} de equipo requiere{alerts.length > 1 ? "n" : ""} tu atención.
          </p>
        )}
      </div>

      {/* Atención — filas delgadas (no tarjeta grande): ícono, texto, "Ver →". Sin badge, sin caja. */}
      {alerts.length > 0 && (
        <div className="flex flex-col">
          {alerts.map((a, i) => {
            const color = a.tone === "danger" ? "var(--danger)" : a.tone === "warn" ? "var(--warn)" : "var(--accent)";
            return (
              <div key={i} className="flex items-center gap-2.5 py-2 border-b border-border last:border-0">
                <span className="shrink-0" style={{ color }}><Icon name={a.icon} size={15} /></span>
                <p className="text-[13px] font-semibold flex-1 min-w-0 truncate text-text-1">{a.text}</p>
                {a.href && (
                  <Link href={a.href} className="shrink-0 text-[12.5px] font-semibold" style={{ color }}>
                    Ver →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pausa activa: pop-up aparte, no se pierde en la lista */}
      <PausaActivaPopup messages={assistantMessages} />

      {/* Asistente Contextual (Plano Maestro §11) */}
      {assistantMessages.filter((m) => !m.id.startsWith("pausa-activa-") && m.id !== "cumpleanos").length > 0 && (
        <Card>
          <SectionTitle>Asistente</SectionTitle>
          <div className="space-y-1.5">
            {assistantMessages.filter((m) => !m.id.startsWith("pausa-activa-") && m.id !== "cumpleanos").map((m) => (
              <div key={m.id} className="nx-pop flex items-center gap-2.5 px-2.5 py-2 rounded-sm"
                style={{
                  background: m.tone === "danger" ? "var(--danger-tint)" : m.tone === "warn" ? "var(--warn-tint)" : "var(--surface-2)",
                }}>
                <span className={`shrink-0 ${m.animated ? "nx-msg-icon-bounce" : ""}`} style={{ color: m.tone === "danger" ? "var(--danger)" : m.tone === "warn" ? "var(--warn)" : "var(--text-2)" }}>
                  <Icon name={m.icon} size={16} />
                </span>
                <p className="text-[13px] font-semibold flex-1"
                  style={{ color: m.tone === "danger" ? "var(--danger)" : m.tone === "warn" ? "var(--warn)" : "var(--text-1)" }}>
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Mi jornada — la métrica protagonista del dashboard — y Equipo hoy comparten
          una sola superficie: son la misma historia (mi día + el día del equipo),
          no dos tarjetas independientes que compiten entre sí (punto 9). */}
      <Card>
        {(() => {
          const dotColor = !myDay.firstIn ? "var(--text-3)" : myDay.isOpen ? "var(--ok)" : "var(--text-3)";
          const statusLabel = !myDay.firstIn ? "Sin iniciar" : myDay.isOpen ? "Trabajando" : "Jornada terminada";
          return (
            <>
              <LiveJornadaHero
                firstIn={myDay.firstIn} totalMin={myDay.totalMin} targetMin={myDay.targetMin}
                openSegmentStartsAt={myDay.openSegmentStartsAt}
                statusLabel={statusLabel} dotColor={dotColor} barClassName="mb-4"
              />
              {/* Botones secundarios — la protagonista es la jornada de arriba, no el CTA (punto 14) */}
              <div className="flex gap-2 mb-5">
                <Link href="/fichar" className="btn-secondary flex-1 inline-flex items-center justify-center h-9 px-4 text-[13.5px]">
                  Comenzar jornada
                </Link>
                <Link href="/comunicacion" className="btn-tertiary flex-1 inline-flex items-center justify-center h-9 px-4 text-[13.5px]">
                  Mis actividades
                </Link>
              </div>
            </>
          );
        })()}

        <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12.5px] font-bold" style={{ color: "var(--text-3)" }}>Equipo</span>
            <Link href="/admin/nexus" className="text-[12.5px] font-semibold text-accent">Ver asistencia →</Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3.5 pb-3.5 border-b border-border">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-2"><Badge tone="ok" dot>{pulse.presentes}</Badge> presentes</span>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-2"><Badge tone="warn" dot>{pulse.fuera}</Badge> fuera</span>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-2"><Badge tone="neutral" dot>{pulse.completaron}</Badge> terminaron</span>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-2"><Badge tone="purple" dot>{pulse.vacaciones}</Badge> vacaciones</span>
          </div>
          <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto nx-scroll p-1 -m-1">
            {presence.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar name={p.display_name} color={p.nexus_color ?? undefined} size={24} avatarUrl={p.avatar_url} birthday={isBirthdayToday(p.birth_date, todayISO())} status={p.display.color ?? undefined} statusLabel={p.display.label} />
                  <span className="text-[13px] font-semibold text-text-1">{p.display_name}</span>
                </div>
                <span className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
                  {p.display.color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.display.color }} />}
                  {p.display.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Actividad de hoy — timeline (punto 10): línea vertical + puntos, no filas de tabla */}
      <Card>
        <SectionTitle hint="registros · solicitudes · vacaciones">Actividad de hoy</SectionTitle>
        {feed.length === 0 ? (
          <p className="text-[13px] py-4 text-center text-text-3">Aún no hay actividad registrada hoy</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[9px] top-2 bottom-2 w-px" style={{ background: "var(--border-2)" }} />
            {feed.map((f) => (
              <div key={f.key} className="relative flex items-center gap-3 py-2.5 pl-5">
                <span className="absolute left-[5px] w-[9px] h-[9px] rounded-full" style={{ background: f.iconColor ?? "var(--text-3)" }} />
                <p className="text-[13px] flex-1 min-w-0 truncate text-text-1">{f.text}</p>
                <span className="text-[12px] font-semibold tabular-nums shrink-0 text-text-3">{f.time}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Todo lo demás — una sola banda de métricas, no cuatro cajas (punto 3) */}
      <Card pad={false} className="flex items-stretch overflow-hidden">
        {[
          { label: "Pendientes", value: pendingReqs ?? 0, href: "/admin/solicitudes" },
          { label: "Actividades", value: activeProjects ?? 0, href: "/admin/proyectos" },
          { label: "Vacaciones", value: pendingVacs ?? 0, href: "/admin/vacaciones" },
          { label: "Incidencias", value: pendingIncs ?? 0, href: "/admin/incidencias" },
        ].map((m, i) => (
          <Link key={m.label} href={m.href}
            className="flex-1 px-4 py-3.5 hover:bg-hover transition-colors"
            style={i > 0 ? { borderLeft: "1px solid var(--border)" } : undefined}>
            <p className="text-[21px] font-bold tabular-nums leading-none text-text-1">{m.value}</p>
            <p className="text-[12px] font-semibold mt-1.5" style={{ color: "var(--text-3)" }}>{m.label}</p>
          </Link>
        ))}
      </Card>

      {/* Dos columnas: actividades activas + solicitudes por revisar */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 md:gap-4">
        <Card>
          <SectionTitle hint={`${activeProjects ?? 0} en total`}>Actividades</SectionTitle>
          {activities.length === 0 ? (
            <EmptyState icon="layers" title="Sin actividades activas" hint="Cuando se apruebe una solicitud, aparecerá aquí con su avance." />
          ) : (
            <div className="space-y-1.5 md:space-y-1">
              {activities.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 p-2 md:p-2.5 rounded-sm hover:bg-hover transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] md:text-[14px] font-bold md:font-semibold text-text-1 truncate">{a.title}</p>
                    <div className="flex items-center gap-2 mt-1 md:mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: "var(--accent)" }} />
                      </div>
                      <span className="md:hidden text-[11px] font-bold tabular-nums shrink-0" style={{ color: "var(--text-3)" }}>{a.pct}%</span>
                    </div>
                  </div>
                  <Badge tone="neutral">{TYPE_LABEL[a.type] ?? a.type}</Badge>
                  {a.lead && <Avatar name={a.lead.display_name} color={a.lead.nexus_color ?? undefined} size={28} avatarUrl={a.lead.avatar_url} birthday={isBirthdayToday(a.lead.birth_date, todayISO())} />}
                </div>
              ))}
            </div>
          )}
          <Link href="/admin/proyectos" className="mt-3 w-full h-9 flex items-center justify-center rounded-sm text-[13px] font-semibold text-accent hover:bg-hover transition-colors">
            Ver todas las actividades →
          </Link>
        </Card>

        <Card>
          <SectionTitle hint={`${pendingReqs ?? 0} en total`}>Pendientes</SectionTitle>
          {pendingList.length === 0 ? (
            <div className="flex items-center gap-3 py-3">
              <span className="grid place-items-center h-9 w-9 rounded-full shrink-0" style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>
                <Icon name="check" size={16} />
              </span>
              <div>
                <p className="text-[13.5px] font-bold text-text-1">Todo al día</p>
                <p className="text-[12px] text-text-3">No hay solicitudes esperando revisión.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 md:space-y-1">
              {pendingList.map((r) => (
                <div key={r.id} className="flex items-center gap-2.5 p-2 md:p-2.5 rounded-sm hover:bg-hover transition-colors">
                  <span className="grid place-items-center h-7 w-7 md:h-8 md:w-8 rounded-sm bg-surface-2 text-text-3 shrink-0"><Icon name="inbox" size={14} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] md:text-[14px] font-bold md:font-semibold text-text-1 truncate">{r.title}</p>
                    <p className="text-[12px] text-text-3 truncate">{r.requester_name ?? "—"}</p>
                  </div>
                  <Badge tone={PRIORITY_TONE[r.priority] ?? "neutral"}>{r.priority}</Badge>
                </div>
              ))}
            </div>
          )}
          <Link href="/admin/solicitudes" className="mt-3 w-full h-9 flex items-center justify-center rounded-sm text-[13px] font-semibold text-accent hover:bg-hover transition-colors">
            Revisar bandeja →
          </Link>
        </Card>
      </div>

      {/* Mi productividad hoy — todo lo que hice como admin también es trabajo:
          aprobar, rechazar, asignar, exportar. Cuenta para "Mi día". */}
      <Card>
        <SectionTitle hint={`${(myActionsToday ?? []).length} acción${(myActionsToday ?? []).length === 1 ? "" : "es"} hoy`}>
          Mi productividad hoy
        </SectionTitle>
        {(myActionsToday ?? []).length === 0 ? (
          <div className="flex items-center gap-3 py-3">
            <span className="grid place-items-center h-9 w-9 rounded-full shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
              <Icon name="check" size={16} />
            </span>
            <div>
              <p className="text-[13.5px] font-bold text-text-1">Sin acciones registradas hoy</p>
              <p className="text-[12px] text-text-3">Aprobar solicitudes, revisar vacaciones o exportar un reporte aparecerá aquí.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {(myActionsToday ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="w-5 text-center shrink-0 flex justify-center" style={{ color: "var(--ok)" }}><Icon name="check" size={13} /></span>
                <p className="text-[13px] flex-1 min-w-0 truncate text-text-1">
                  {a.action}{a.detail ? ` — ${a.detail}` : ""}
                </p>
                <span className="text-[12px] font-semibold tabular-nums shrink-0 text-text-3">{meridaClock(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
