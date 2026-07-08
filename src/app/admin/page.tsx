import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { summarizeDay, fmtMin, fmtTime } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { todayMerida, nowMeridaMinutes } from "@/lib/tz";
import { Card, SectionTitle, Badge, StatCard, Avatar, EmptyState } from "@/components/os/ui";

/* ═══════════════════════════════════════════════════════════════
   Hoy · Centro de Operaciones (admin)
   Rediseño sobre el sistema de diseño Nexus OS (Card/Badge/StatCard),
   con el mismo contenido real de siempre — nada inventado — más dos
   bloques nuevos: Actividades activas y Solicitudes por revisar,
   que reemplazan a los KPIs sueltos por listas accionables reales.
   ═══════════════════════════════════════════════════════════════ */

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const meridaClock = (iso: string) =>
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
    users: { display_name: string; nexus_color: string | null } | null;
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
    { count: activeProjects }, { data: myAtt }, { data: mySched },
    { data: team }, { data: teamAtt }, { data: allScheds },
    { data: vacsToday }, { data: urgentReqs }, { data: holidayToday },
    { data: reqsToday }, { data: vacsCreatedToday },
    { data: activeProjectsList }, { data: pendingRequestsList },
  ] = await Promise.all([
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "solicitada"),
    supabase.from("vacations").select("id", { count: "exact", head: true }).eq("status", "Pendiente"),
    supabase.from("incidents").select("id", { count: "exact", head: true }).eq("status", "Pendiente"),
    supabase.from("projects").select("id", { count: "exact", head: true }).in("status", ["aprobada", "en_progreso", "en_revision"]),
    supabase.from("attendance").select("*").eq("user_id", me!.id).eq("date", today).order("time"),
    supabase.from("schedules").select("*").eq("user_id", me!.id).is("valid_until", null).limit(1).single(),
    supabase.from("users").select("id, display_name, nexus_color").eq("active", true).in("role", ["admin", "empleado"]),
    supabase.from("attendance").select("id, user_id, type, reason, time").eq("date", today).order("time"),
    supabase.from("schedules").select("user_id, start_time, tolerance_min").is("valid_until", null),
    supabase.from("vacations").select("user_id, start_date, end_date").eq("status", "Aprobada").lte("start_date", today).gte("end_date", today),
    supabase.from("requests").select("id, title, priority").eq("status", "solicitada").in("priority", ["alta", "urgente"]),
    supabase.from("holidays").select("date, name").eq("date", today).maybeSingle(),
    supabase.from("requests").select("id, title, created_at, requester:requester_id(display_name)").gte("created_at", utcDayStart).order("created_at", { ascending: false }).limit(8),
    supabase.from("vacations").select("id, start_date, end_date, created_at, users:user_id(display_name)").gte("created_at", utcDayStart).order("created_at", { ascending: false }).limit(8),
    supabase.from("projects").select(`
      id, status, deadline, priority,
      requests(title, type, requester_name),
      project_assignments(is_lead, users(display_name, nexus_color), project_checklist(done))
    `).in("status", ["aprobada", "en_progreso", "en_revision"]),
    supabase.from("requests").select("id, title, type, requester_name, priority, created_at").eq("status", "solicitada").order("created_at", { ascending: false }),
  ]);

  const sched = (mySched ?? { target_min: 480, tolerance_min: 15 }) as Schedule;
  const myDay = summarizeDay(today, (myAtt ?? []) as AttendanceRow[], sched);

  const nameOf = new Map((team ?? []).map((u) => [u.id, u.display_name]));
  const onVacation = new Set((vacsToday ?? []).map((v) => v.user_id));

  /* ── Presencia por persona (estado en vivo) ── */
  const presence = (team ?? []).map((u) => {
    const rows = (teamAtt ?? []).filter((a) => a.user_id === u.id);
    const hasIn = rows.some((r) => r.reason === "Entrada a trabajo");
    const done = rows.some((r) => r.reason === "Fin de jornada");
    const last = rows.at(-1);
    const status = onVacation.has(u.id) ? "Vacaciones"
      : done ? "Terminó"
      : hasIn ? (last?.type === "Salida" ? "Fuera" : "Presente")
      : "Sin iniciar";
    return { ...u, status };
  });

  const pulse = {
    presentes: presence.filter((p) => p.status === "Presente").length,
    fuera: presence.filter((p) => p.status === "Fuera").length,
    completaron: presence.filter((p) => p.status === "Terminó").length,
    vacaciones: presence.filter((p) => p.status === "Vacaciones").length,
  };

  /* ── Alertas inteligentes ── */
  const nowMin = nowMeridaMinutes();
  const dow = new Date(`${today}T12:00:00`).getDay(); // 0=dom, 6=sáb
  const isWorkday = dow !== 0 && dow !== 6 && !holidayToday;
  const alerts: { icon: string; text: string; tone: "warn" | "danger" | "accent" }[] = [];

  if (holidayToday) {
    alerts.push({ icon: "🎉", text: `Hoy es día inhábil: ${holidayToday.name}`, tone: "accent" });
  }
  if (isWorkday) {
    for (const p of presence) {
      if (p.status !== "Sin iniciar") continue;
      const s = (allScheds ?? []).find((x) => x.user_id === p.id);
      const start = toMin((s?.start_time ?? "09:00:00").slice(0, 5));
      const expected = start + (s?.tolerance_min ?? 15);
      if (nowMin > expected) {
        alerts.push({ icon: "⏰", text: `${p.display_name} aún no inicia jornada (se esperaba a las ${hhmm(start)})`, tone: "warn" });
      }
    }
  }
  if ((urgentReqs ?? []).length > 0) {
    alerts.push({
      icon: "🔥",
      text: `${urgentReqs!.length} solicitud${urgentReqs!.length > 1 ? "es" : ""} de prioridad alta/urgente sin aprobar`,
      tone: "danger",
    });
  }
  for (const v of vacsToday ?? []) {
    if (v.start_date === today) {
      alerts.push({ icon: "🌴", text: `${nameOf.get(v.user_id) ?? "Alguien"} inicia vacaciones hoy (hasta ${v.end_date})`, tone: "accent" });
    }
  }

  /* ── Feed de actividad de hoy ── */
  type FeedItem = { key: string; icon: string; text: string; time: string; sort: string };
  const feed: FeedItem[] = [
    ...((teamAtt ?? []) as { id: string; user_id: string; reason: string; time: string }[]).map((a) => ({
      key: `att-${a.id}`,
      icon: a.reason === "Entrada a trabajo" ? "🟢" : a.reason === "Fin de jornada" ? "🔵" : a.reason.startsWith("Salida") ? "🟠" : "🟡",
      text: `${nameOf.get(a.user_id) ?? "—"} · ${a.reason}`,
      time: a.time.slice(0, 5),
      sort: a.time.slice(0, 5),
    })),
    ...((reqsToday ?? []) as unknown as { id: string; title: string; created_at: string; requester: { display_name: string } | null }[]).map((r) => ({
      key: `req-${r.id}`,
      icon: "📝",
      text: `${r.requester?.display_name ?? "—"} creó la solicitud "${r.title}"`,
      time: meridaClock(r.created_at),
      sort: meridaClock(r.created_at),
    })),
    ...((vacsCreatedToday ?? []) as unknown as { id: string; start_date: string; end_date: string; created_at: string; users: { display_name: string } | null }[]).map((v) => ({
      key: `vac-${v.id}`,
      icon: "🏖️",
      text: `${v.users?.display_name ?? "—"} solicitó vacaciones (${v.start_date} → ${v.end_date})`,
      time: meridaClock(v.created_at),
      sort: meridaClock(v.created_at),
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

  const dateLabel = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Merida",
  });
  const hour = Number(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", hour12: false, timeZone: "America/Merida" }));
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = me!.display_name.split(" ")[0];

  return (
    <div className="space-y-6 pb-10">
      <header className="pt-2">
        <p className="text-[13px] capitalize text-text-3">{dateLabel}</p>
        <h1 className="text-[26px] md:text-[30px] font-bold tracking-tight text-text-1">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-[13.5px] mt-1 text-text-3">
          {alerts.length === 0
            ? "Todo en orden — sin alertas por ahora."
            : `${alerts.length} cosa${alerts.length > 1 ? "s" : ""} necesita${alerts.length > 1 ? "n" : ""} tu atención hoy.`}
        </p>
      </header>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((a, i) => (
            <Card key={i} pad={false} className="px-4 py-3 flex items-center gap-2.5">
              <span className="text-[15px]">{a.icon}</span>
              <p className="text-[13px] font-semibold text-text-1 flex-1">{a.text}</p>
              <Badge tone={a.tone === "accent" ? "accent" : a.tone}>{a.tone === "danger" ? "Urgente" : a.tone === "warn" ? "Atención" : "Aviso"}</Badge>
            </Card>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/admin/solicitudes"><StatCard label="Solicitudes por revisar" value={String(pendingReqs ?? 0)} icon="inbox" tone="warn" /></Link>
        <Link href="/admin/proyectos"><StatCard label="Actividades activas" value={String(activeProjects ?? 0)} icon="layers" tone="accent" /></Link>
        <Link href="/admin/vacaciones"><StatCard label="Vacaciones pendientes" value={String(pendingVacs ?? 0)} icon="sun" tone="purple" /></Link>
        <Link href="/admin/incidencias"><StatCard label="Incidencias pendientes" value={String(pendingIncs ?? 0)} icon="alert" tone="danger" /></Link>
      </div>

      {/* Dos columnas: actividades activas + solicitudes por revisar */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <SectionTitle hint={`${activeProjects ?? 0} en total`}>Actividades activas</SectionTitle>
          {activities.length === 0 ? (
            <EmptyState icon="layers" title="Sin actividades activas" hint="Cuando se apruebe una solicitud, aparecerá aquí con su avance." />
          ) : (
            <div className="space-y-1">
              {activities.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-s hover:bg-hover transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-text-1 truncate">{a.title}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: "var(--accent)" }} />
                    </div>
                  </div>
                  <Badge tone="neutral">{TYPE_LABEL[a.type] ?? a.type}</Badge>
                  {a.lead && <Avatar name={a.lead.display_name} color={a.lead.nexus_color ?? undefined} size={28} />}
                </div>
              ))}
            </div>
          )}
          <Link href="/admin/proyectos" className="mt-3 w-full h-9 flex items-center justify-center rounded-s text-[13px] font-semibold text-accent hover:bg-hover transition-colors">
            Ver todas las actividades →
          </Link>
        </Card>

        <Card>
          <SectionTitle hint={`${pendingReqs ?? 0} en total`}>Solicitudes por revisar</SectionTitle>
          {pendingList.length === 0 ? (
            <EmptyState icon="inbox" title="Bandeja en cero" hint="No hay solicitudes esperando revisión." />
          ) : (
            <div className="space-y-1">
              {pendingList.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-s hover:bg-hover transition-colors">
                  <span className="grid place-items-center h-8 w-8 rounded-s bg-surface-2 text-text-3 shrink-0">📝</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-text-1 truncate">{r.title}</p>
                    <p className="text-[12px] text-text-3 truncate">{r.requester_name ?? "—"}</p>
                  </div>
                  <Badge tone={PRIORITY_TONE[r.priority] ?? "neutral"}>{r.priority}</Badge>
                </div>
              ))}
            </div>
          )}
          <Link href="/admin/solicitudes" className="mt-3 w-full h-9 flex items-center justify-center rounded-s text-[13px] font-semibold text-accent hover:bg-hover transition-colors">
            Revisar bandeja →
          </Link>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Mi jornada de hoy */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Mi jornada de hoy</SectionTitle>
            {myDay.isOpen && myDay.firstIn ? <Badge tone="ok" dot>En curso</Badge>
              : myDay.firstIn ? <Badge tone="neutral">Cerrada</Badge> : <Badge tone="neutral">Sin iniciar</Badge>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div className="rounded-s py-3 bg-surface-2">
              <p className="text-[15px] font-bold tabular-nums text-text-1">{fmtTime(myDay.firstIn)}</p>
              <p className="text-[10px] font-semibold text-text-3">Entrada</p>
            </div>
            <div className="rounded-s py-3 bg-surface-2">
              <p className="text-[15px] font-bold tabular-nums text-text-1">{fmtMin(myDay.totalMin)}</p>
              <p className="text-[10px] font-semibold text-text-3">Laborado</p>
            </div>
            <div className="rounded-s py-3 bg-surface-2">
              <p className="text-[15px] font-bold tabular-nums" style={{ color: myDay.extraMin > 0 ? "var(--ok)" : undefined }}>
                {myDay.extraMin > 0 ? `+${fmtMin(myDay.extraMin)}` : "—"}
              </p>
              <p className="text-[10px] font-semibold text-text-3">Extra</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/fichar" className="flex-1 inline-flex items-center justify-center h-10 px-4 rounded-s text-[14px] font-semibold bg-accent text-white hover:brightness-110 shadow-sm transition-all duration-150">
              Comenzar jornada
            </Link>
            <Link href="/empleado" className="flex-1 inline-flex items-center justify-center h-10 px-4 rounded-s text-[14px] font-semibold bg-surface-2 text-text-1 border border-border hover:bg-hover transition-all duration-150">
              Mis actividades
            </Link>
          </div>
        </Card>

        {/* Equipo hoy */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Equipo hoy</SectionTitle>
            <Link href="/admin/nexus" className="text-[12.5px] font-semibold text-accent">Ver asistencia →</Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3.5 pb-3.5 border-b border-border">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-2"><Badge tone="ok" dot>{pulse.presentes}</Badge> presentes</span>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-2"><Badge tone="warn" dot>{pulse.fuera}</Badge> fuera</span>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-2"><Badge tone="neutral" dot>{pulse.completaron}</Badge> terminaron</span>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-2"><Badge tone="purple" dot>{pulse.vacaciones}</Badge> vacaciones</span>
          </div>
          <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto nx-scroll">
            {presence.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar name={p.display_name} color={p.nexus_color ?? undefined} size={24} />
                  <span className="text-[13px] font-semibold text-text-1">{p.display_name}</span>
                </div>
                <span className="text-[12px] font-semibold text-text-3">{p.status}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Actividad de hoy (feed) */}
      <Card>
        <SectionTitle hint="fichajes · solicitudes · vacaciones">Actividad de hoy</SectionTitle>
        {feed.length === 0 ? (
          <p className="text-[13px] py-4 text-center text-text-3">Aún no hay actividad registrada hoy</p>
        ) : (
          <div className="flex flex-col">
            {feed.map((f) => (
              <div key={f.key} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="text-[14px] w-5 text-center shrink-0">{f.icon}</span>
                <p className="text-[13px] flex-1 min-w-0 truncate text-text-1">{f.text}</p>
                <span className="text-[12px] font-semibold tabular-nums shrink-0 text-text-3">{f.time}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
