import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { summarizeDay, fmtMin, fmtTime } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { Pill } from "@/components/ui";
import { todayMerida, nowMeridaMinutes } from "@/lib/tz";

/* ═══════════════════════════════════════════════════════════════
   Resumen admin — fusión del legado cert_nexus:
   · L1  Banda de alertas inteligentes (sin fichar, urgentes, vacaciones)
   · L3  Pulso en vivo (presentes/fuera/completaron/vacaciones) + feed
   Todo derivado de Supabase en el server; sin datos inventados.
   ═══════════════════════════════════════════════════════════════ */

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const meridaClock = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Merida" });

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
      : "Sin fichar";
    return { ...u, status };
  });

  const pulse = {
    presentes: presence.filter((p) => p.status === "Presente").length,
    fuera: presence.filter((p) => p.status === "Fuera").length,
    completaron: presence.filter((p) => p.status === "Terminó").length,
    vacaciones: presence.filter((p) => p.status === "Vacaciones").length,
  };

  /* ── L1 · Alertas inteligentes ── */
  const nowMin = nowMeridaMinutes();
  const dow = new Date(`${today}T12:00:00`).getDay(); // 0=dom, 6=sáb
  const isWorkday = dow !== 0 && dow !== 6 && !holidayToday;
  const alerts: { icon: string; text: string; tone: "warn" | "danger" | "accent" }[] = [];

  if (holidayToday) {
    alerts.push({ icon: "🎉", text: `Hoy es día inhábil: ${holidayToday.name}`, tone: "accent" });
  }
  if (isWorkday) {
    for (const p of presence) {
      if (p.status !== "Sin fichar") continue;
      const s = (allScheds ?? []).find((x) => x.user_id === p.id);
      const start = toMin((s?.start_time ?? "09:00:00").slice(0, 5));
      const expected = start + (s?.tolerance_min ?? 15);
      if (nowMin > expected) {
        alerts.push({ icon: "⏰", text: `${p.display_name} aún no ficha (se esperaba a las ${hhmm(start)})`, tone: "warn" });
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

  /* ── L3 · Feed de actividad de hoy ── */
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
      text: `${r.requester?.display_name ?? "—"} creó la solicitud “${r.title}”`,
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

  const KPIS = [
    { label: "Solicitudes por aprobar", value: pendingReqs ?? 0, href: "/admin/solicitudes", tone: "var(--warn)" },
    { label: "Vacaciones pendientes", value: pendingVacs ?? 0, href: "/admin/vacaciones", tone: "var(--ok)" },
    { label: "Incidencias pendientes", value: pendingIncs ?? 0, href: "/admin/incidencias", tone: "var(--danger)" },
    { label: "Proyectos activos", value: activeProjects ?? 0, href: "/admin/proyectos", tone: "var(--accent)" },
  ];

  const PULSE = [
    { label: "Presentes", value: pulse.presentes, dot: "var(--ok)" },
    { label: "Fuera / comida", value: pulse.fuera, dot: "var(--warn)" },
    { label: "Completaron", value: pulse.completaron, dot: "var(--text-3)" },
    { label: "De vacaciones", value: pulse.vacaciones, dot: "#8E5CF7" },
  ];

  const dateLabel = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Merida",
  });

  return (
    <>
      <header className="pt-8 pb-5">
        <p className="text-[13px] capitalize" style={{ color: "var(--text-3)" }}>{dateLabel}</p>
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">{me!.display_name} 👋</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Centro de operaciones · CERT Comunicación
        </p>
      </header>

      {/* ── L1 · Alertas inteligentes ── */}
      <section className="mb-5">
        {alerts.length === 0 ? (
          <div className="card px-4 py-3 flex items-center gap-2.5"
            style={{ borderColor: "color-mix(in srgb, var(--ok) 35%, transparent)" }}>
            <span className="text-[15px]">✅</span>
            <p className="text-[13px] font-semibold" style={{ color: "var(--ok)" }}>
              Todo en orden — sin alertas por ahora
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {alerts.map((a, i) => (
              <div key={i} className="card px-4 py-3 flex items-center gap-2.5"
                style={{
                  borderColor: `color-mix(in srgb, var(--${a.tone}) 40%, transparent)`,
                  background: `color-mix(in srgb, var(--${a.tone}) 7%, var(--surface-1))`,
                }}>
                <span className="text-[15px]">{a.icon}</span>
                <p className="text-[13px] font-semibold">{a.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── L3 · Pulso en vivo del equipo ── */}
      <section className="card px-5 py-3.5 mb-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        {PULSE.map((p) => (
          <div key={p.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.dot }} />
            <span className="text-[17px] font-bold tabular-nums">{p.value}</span>
            <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>{p.label}</span>
          </div>
        ))}
        <Link href="/admin/nexus" className="ml-auto text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
          Ver Gantt del día →
        </Link>
      </section>

      {/* KPIs de pendientes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {KPIS.map((k) => (
          <Link key={k.label} href={k.href} className="card card-hover p-5">
            <p className="text-[30px] font-bold tabular-nums" style={{ color: k.tone }}>{k.value}</p>
            <p className="text-[12px] font-semibold mt-1" style={{ color: "var(--text-2)" }}>{k.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Mi Día — admin es superset de empleado */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold">Mi jornada de hoy</h2>
            {myDay.isOpen && myDay.firstIn ? <Pill tone="ok">En curso</Pill>
              : myDay.firstIn ? <Pill tone="muted">Cerrada</Pill> : <Pill tone="muted">Sin iniciar</Pill>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div className="rounded-s py-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-[15px] font-bold tabular-nums">{fmtTime(myDay.firstIn)}</p>
              <p className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>Entrada</p>
            </div>
            <div className="rounded-s py-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-[15px] font-bold tabular-nums">{fmtMin(myDay.totalMin)}</p>
              <p className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>Laborado</p>
            </div>
            <div className="rounded-s py-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-[15px] font-bold tabular-nums" style={{ color: myDay.extraMin > 0 ? "var(--ok)" : undefined }}>
                {myDay.extraMin > 0 ? `+${fmtMin(myDay.extraMin)}` : "—"}
              </p>
              <p className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>Extra</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/fichar" className="btn-primary flex-1 text-center py-2.5 text-[13px]">Fichar</Link>
            <Link href="/empleado" className="btn-secondary flex-1 text-center py-2.5 text-[13px]">Mis tareas</Link>
          </div>
        </section>

        {/* Presencia del equipo */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold">Equipo hoy</h2>
            <Link href="/admin/nexus" className="text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
              Ver asistencia →
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {presence.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full"
                    style={{
                      background: p.status === "Presente" ? "var(--ok)" :
                                  p.status === "Fuera" ? "var(--warn)" :
                                  p.status === "Vacaciones" ? "#8E5CF7" :
                                  p.status === "Terminó" ? "var(--text-3)" : "var(--danger)",
                    }} />
                  <span className="text-[13.5px] font-semibold">{p.display_name}</span>
                </div>
                <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>{p.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── L3 · Actividad de hoy (feed) ── */}
      <section className="card p-5 mb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold">Actividad de hoy</h2>
          <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-3)" }}>
            fichajes · solicitudes · vacaciones
          </span>
        </div>
        {feed.length === 0 ? (
          <p className="text-[13px] py-4 text-center" style={{ color: "var(--text-3)" }}>
            Aún no hay actividad registrada hoy
          </p>
        ) : (
          <div className="flex flex-col">
            {feed.map((f) => (
              <div key={f.key} className="flex items-center gap-3 py-2"
                style={{ borderBottom: "0.5px solid var(--border)" }}>
                <span className="text-[14px] w-5 text-center shrink-0">{f.icon}</span>
                <p className="text-[13px] flex-1 min-w-0 truncate">{f.text}</p>
                <span className="text-[12px] font-semibold tabular-nums shrink-0" style={{ color: "var(--text-3)" }}>
                  {f.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
