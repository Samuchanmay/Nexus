"use client";
// ═══════════════════════════════════════════════════════════════
//  Mi Día · diseño v6 fiel al mockup del cliente (U2)
//  hero + tira semanal + tarea activa + agenda + pendientes + sheet
//  Time tracking real: iniciar · pausar · reanudar · finalizar
//  (pausar = cerrar sesión de tiempo; reanudar = nueva sesión)
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast, Sheet } from "@/components/ui";
import { TYPE_LABELS } from "@/lib/types";
import { todayMerida, addDays } from "@/lib/tz";
import { fmtMin } from "@/lib/hours";

interface Task {
  assignmentId: string; isLead: boolean; projectId: string;
  title: string; type: string; requester: string | null;
  status: string; priority: string; deadline: string | null;
}
interface ChecklistItem { id: string; assignment_id: string; position: number; label: string; done: boolean }

const TYPE_ICONS: Record<string, React.ReactNode> = {
  cobertura: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></>,
  diseno: <><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z"/></>,
  video: <><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-4v12l-6-4"/></>,
  lona: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 12h18"/></>,
  difusion: <><path d="M4 11v2a1 1 0 001 1h2l4 4V6L7 10H5a1 1 0 00-1 1z"/><path d="M16 8a5 5 0 010 8"/></>,
};
const PRI_LABEL: Record<string, string> = { baja: "Baja", normal: "Normal", alta: "Alta", urgente: "Urgente" };

export default function MiDiaClient({ profile, day, week, assignments }: {
  profile: { id: string; displayName: string };
  day: { totalMin: number; targetMin: number; isOpen: boolean; hasEntry: boolean };
  week: { monday: string; today: string; datesWithActivity: string[] };
  assignments: Task[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [activeLog, setActiveLog] = useState<{ id: string; assignmentId: string; startedAt: string } | null>(null);
  const [pausedAssignment, setPausedAssignment] = useState<string | null>(null);
  const [baseMin, setBaseMin] = useState<Record<string, number>>({}); // minutos ya registrados hoy por assignment
  const [elapsed, setElapsed] = useState(0);
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({});
  const [openSheet, setOpenSheet] = useState(false);
  const [actForm, setActForm] = useState({ type: "cobertura", title: "", date: todayMerida(), minutes: "", requester: "", note: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const ids = assignments.map((a) => a.assignmentId);
    if (!ids.length) return;
    const [{ data: open }, { data: items }, { data: todayLogs }] = await Promise.all([
      supabase.from("task_time_logs").select("id, assignment_id, started_at")
        .in("assignment_id", ids).is("ended_at", null).limit(1).maybeSingle(),
      supabase.from("project_checklist").select("id, assignment_id, position, label, done")
        .in("assignment_id", ids).order("position"),
      supabase.from("task_time_logs").select("assignment_id, minutes")
        .in("assignment_id", ids).gte("started_at", week.today + "T00:00:00").not("minutes", "is", null),
    ]);
    setActiveLog(open ? { id: open.id, assignmentId: open.assignment_id, startedAt: open.started_at } : null);
    const grouped: Record<string, ChecklistItem[]> = {};
    (items ?? []).forEach((i) => { (grouped[i.assignment_id] ??= []).push(i as ChecklistItem); });
    setChecklists(grouped);
    const base: Record<string, number> = {};
    (todayLogs ?? []).forEach((l) => { base[l.assignment_id] = (base[l.assignment_id] ?? 0) + (l.minutes ?? 0); });
    setBaseMin(base);
  }, [assignments, week.today]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeLog) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(activeLog.startedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeLog]);

  // ── Tracking ──
  const startTask = async (assignmentId: string) => {
    if (activeLog) { toast("Ya tienes una tarea activa — finalízala primero"); return; }
    const supabase = createClient();
    const { data, error } = await supabase.from("task_time_logs")
      .insert({ assignment_id: assignmentId, started_at: new Date().toISOString() })
      .select("id, started_at").single();
    if (error || !data) { toast(error?.message?.includes("activa") ? error.message : "No se pudo iniciar — intenta de nuevo"); return; }
    setActiveLog({ id: data.id, assignmentId, startedAt: data.started_at });
    setPausedAssignment(null);
    toast("Tarea iniciada");
    router.refresh(); // B3: el trigger BD promueve aprobada→en_progreso
  };

  const closeLog = async () => {
    if (!activeLog) return 0;
    const supabase = createClient();
    const minutes = Math.max(1, Math.floor((Date.now() - new Date(activeLog.startedAt).getTime()) / 60000));
    const { error } = await supabase.from("task_time_logs")
      .update({ ended_at: new Date().toISOString(), minutes }).eq("id", activeLog.id);
    if (error) { toast("No se pudo guardar — intenta de nuevo"); return -1; }
    setBaseMin((b) => ({ ...b, [activeLog.assignmentId]: (b[activeLog.assignmentId] ?? 0) + minutes }));
    return minutes;
  };

  const pauseTask = async () => {
    if (!activeLog) return;
    const aid = activeLog.assignmentId;
    const m = await closeLog();
    if (m < 0) return;
    setPausedAssignment(aid);
    setActiveLog(null);
    toast("Tarea pausada");
  };

  const stopTask = async () => {
    if (!activeLog) return;
    const m = await closeLog();
    if (m < 0) return;
    setActiveLog(null);
    setPausedAssignment(null);
    toast(`Tarea finalizada · ${fmtMin(m)} registrados`);
  };

  const toggleCheck = async (item: ChecklistItem) => {
    const supabase = createClient();
    const { error } = await supabase.from("project_checklist").update({ done: !item.done }).eq("id", item.id);
    if (error) { toast("No se pudo actualizar"); return; }
    setChecklists((c) => ({
      ...c,
      [item.assignment_id]: c[item.assignment_id].map((i) => i.id === item.id ? { ...i, done: !i.done } : i),
    }));
    toast(!item.done ? "Completado" : "Desmarcado");
  };

  const markReview = async (t: Task) => {
    const supabase = createClient();
    const { error } = await supabase.from("projects").update({ status: "en_revision" }).eq("id", t.projectId);
    if (error) { toast("No se pudo actualizar"); return; }
    toast("Enviado a revisión");
    router.refresh();
  };

  const addEvidence = async (t: Task) => {
    const url = window.prompt("Pega el enlace de la evidencia (Drive, foto, archivo):");
    if (!url) return;
    const supabase = createClient();
    const { error } = await supabase.from("evidences").insert({ project_id: t.projectId, user_id: profile.id, url });
    toast(error ? "No se pudo subir" : "Evidencia registrada");
  };

  const addComment = async (t: Task) => {
    const body = window.prompt("Escribe tu comentario:");
    if (!body) return;
    const supabase = createClient();
    const { error } = await supabase.from("comments").insert({ project_id: t.projectId, user_id: profile.id, body });
    toast(error ? "No se pudo comentar" : "Comentario agregado");
  };

  // ── Agregar actividad (manual, queda en_revision) ──
  const submitActivity = async () => {
    if (!actForm.title.trim() || !actForm.minutes) { toast("Completa qué hiciste y el tiempo"); return; }
    setSaving(true);
    const supabase = createClient();
    const { data: req, error: e1 } = await supabase.from("requests").insert({
      requester_id: profile.id, requester_type: "externo",
      requester_name: actForm.requester || profile.displayName,
      type: actForm.type, title: actForm.title,
      event_date: actForm.date, notes: actForm.note || null,
      status: "en_revision", min_hours_required: 0,
    }).select("id").single();
    if (e1 || !req) { setSaving(false); toast("No se pudo registrar"); return; }
    const { data: prj, error: e2 } = await supabase.from("projects").insert({
      request_id: req.id, status: "en_revision", priority: "normal",
    }).select("id").single();
    if (!e2 && prj) {
      const { data: asg } = await supabase.from("project_assignments")
        .insert({ project_id: prj.id, user_id: profile.id, is_lead: true }).select("id").single();
      if (asg) {
        await supabase.from("task_time_logs").insert({
          assignment_id: asg.id,
          started_at: `${actForm.date}T09:00:00-06:00`,
          ended_at: `${actForm.date}T09:00:00-06:00`,
          minutes: parseInt(actForm.minutes) || 0,
        });
      }
    }
    setSaving(false);
    setOpenSheet(false);
    setActForm({ type: "cobertura", title: "", date: todayMerida(), minutes: "", requester: "", note: "" });
    toast("Actividad registrada — pendiente de validar por admin");
    router.refresh();
  };

  // ── Derivados ──
  const activeTask = activeLog ? assignments.find((a) => a.assignmentId === activeLog.assignmentId) : null;
  const pausedTask = pausedAssignment ? assignments.find((a) => a.assignmentId === pausedAssignment) : null;
  const inProgress = assignments.filter((a) => a.status === "en_progreso").length;
  const pendingCount = assignments.filter((a) => ["aprobada", "solicitada"].includes(a.status)).length;

  const pad = (n: number) => String(n).padStart(2, "0");
  const totalActiveSec = (baseMin[activeLog?.assignmentId ?? ""] ?? 0) * 60 + elapsed;
  const timerStr = activeLog
    ? `${pad(Math.floor(totalActiveSec / 3600))}:${pad(Math.floor((totalActiveSec % 3600) / 60))}:${pad(totalActiveSec % 60)}`
    : "00:00:00";

  const dateLabel = useMemo(() => {
    const n = new Date();
    return n.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  }, []);
  const weekNum = useMemo(() => {
    const d = new Date(week.today + "T12:00:00Z");
    const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7);
  }, [week.today]);

  const weekDays = useMemo(() => {
    const labels = ["L", "M", "M", "J", "V", "S", "D"];
    return labels.map((l, i) => {
      const date = addDays(week.monday, i);
      return { l, n: Number(date.slice(8, 10)), date, today: date === week.today, has: week.datesWithActivity.includes(date) };
    });
  }, [week]);

  const statusPill = (t: Task) => {
    if (activeLog?.assignmentId === t.assignmentId) return <span className="v6-status v6-s-blue">En curso</span>;
    if (t.status === "en_revision") return <span className="v6-status v6-s-purple">Esperando</span>;
    if (t.status === "en_progreso") return <span className="v6-status v6-s-blue">En curso</span>;
    if (t.status === "completada") return <span className="v6-status v6-s-green">Listo</span>;
    return <span className="v6-status v6-s-muted">Pendiente</span>;
  };

  const agLine = (t: Task) => {
    const mins = baseMin[t.assignmentId] ?? 0;
    if (t.status === "en_revision") return <p style={{ color: "var(--warn)", fontWeight: 600 }}>Actividad manual · Sin validar</p>;
    const parts: string[] = [];
    if (activeLog?.assignmentId === t.assignmentId) parts.push("En curso");
    else parts.push(t.status === "en_progreso" ? "En pausa" : "Sin iniciar");
    if (mins > 0) parts.push(fmtMin(mins) + " hoy");
    if (t.deadline) parts.push("Entrega " + new Date(t.deadline + "T12:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "short" }));
    return <p>{parts.join(" · ")}</p>;
  };

  return (
    <>
      {/* ── HERO v6 ── */}
      <div className="v6-hero">
        <div>
          <div className="v6-hero-eyebrow">{dateLabel} · Semana {weekNum}</div>
          <h1 className="v6-hero-h1">{profile.displayName} 👋</h1>
          <div className="v6-hero-sub">
            {assignments.length} tarea{assignments.length !== 1 ? "s" : ""} · {inProgress} en curso · {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="v6-timer-box">
          <div className="v6-timer-lbl">Tiempo activo</div>
          <div className={`v6-timer-val ${activeLog ? "" : pausedAssignment ? "paused" : "idle"}`}>{timerStr}</div>
        </div>
      </div>

      {/* ── Tira semanal v6 ── */}
      <div className="v6-week">
        {weekDays.map((d, i) => (
          <div key={i} className={`v6-wd ${d.today ? "today" : ""} ${d.has ? "whas" : ""}`}>
            <div className="v6-wl">{d.l}</div>
            <div className="v6-wn">{d.n}</div>
          </div>
        ))}
      </div>

      {/* ── Tarea activa / pausada ── */}
      {(activeTask || pausedTask) && (
        <>
          <div className="v6-sec-title">Tarea activa</div>
          <div className="v6-active-card">
            <div className={`v6-live ${activeTask ? "" : "paused"}`}>
              <div className="v6-live-dot" />{activeTask ? "En curso ahora" : "En pausa"}
            </div>
            <h3>{(activeTask ?? pausedTask)!.title}</h3>
            <div className="v6-meta">
              {TYPE_LABELS[(activeTask ?? pausedTask)!.type as keyof typeof TYPE_LABELS] ?? (activeTask ?? pausedTask)!.type}
              {(activeTask ?? pausedTask)!.requester ? ` · ${(activeTask ?? pausedTask)!.requester}` : ""}
            </div>
            <div className="v6-btn-row">
              {activeTask ? (
                <button className="v6-ac-btn pause" onClick={pauseTask}>
                  <svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>Pausar
                </button>
              ) : (
                <button className="v6-ac-btn play" onClick={() => startTask(pausedTask!.assignmentId)}>
                  <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>Reanudar
                </button>
              )}
              {activeTask && (
                <button className="v6-ac-btn stop" onClick={stopTask}>
                  <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>Finalizar
                </button>
              )}
              <button className="v6-ac-btn" onClick={() => addEvidence((activeTask ?? pausedTask)!)}>
                <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>Evidencia
              </button>
              <button className="v6-ac-btn" onClick={() => addComment((activeTask ?? pausedTask)!)}>
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>Comentar
              </button>
              {(activeTask ?? pausedTask)!.isLead && (activeTask ?? pausedTask)!.status === "en_progreso" && (
                <button className="v6-ac-btn" onClick={() => markReview((activeTask ?? pausedTask)!)}>
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Pasar a revisión
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Agenda de hoy ── */}
      <div className="v6-sec-title">Agenda de hoy</div>
      <div className="v6-agenda">
        {assignments.length === 0 && (
          <div className="v6-ag" style={{ cursor: "default" }}>
            <div className="v6-ag-stripe" style={{ background: "var(--border-2)" }} />
            <div className="v6-ag-info"><h4>Sin tareas asignadas</h4><p>Cuando el admin te asigne un proyecto aparecerá aquí</p></div>
          </div>
        )}
        {assignments.map((t) => {
          const isActive = activeLog?.assignmentId === t.assignmentId;
          const isWaiting = t.status === "en_revision";
          const stripe = isWaiting ? "var(--warn)" : isActive ? "var(--blue)" : t.status === "completada" ? "var(--accent)" : "var(--border-2)";
          const icBg = isWaiting ? "var(--warn-tint)" : isActive ? "var(--blue-tint)" : "var(--surface-2)";
          const icSt = isWaiting ? "var(--warn)" : isActive ? "var(--blue)" : "var(--text-2)";
          return (
            <div className="v6-ag" key={t.assignmentId} style={isWaiting ? { borderColor: "var(--warn-tint)" } : undefined}>
              <div className="v6-ag-stripe" style={{ background: stripe }} />
              <div className="v6-ag-time">{t.deadline ? new Date(t.deadline + "T12:00:00Z").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }).replace(".", "") : "—"}</div>
              <div className="v6-ag-ic" style={{ background: icBg }}>
                <svg viewBox="0 0 24 24" style={{ stroke: icSt, fill: "none", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }}>
                  {TYPE_ICONS[t.type] ?? TYPE_ICONS.diseno}
                </svg>
              </div>
              <div className="v6-ag-info">
                <h4>{t.title}</h4>
                {agLine(t)}
              </div>
              {!isActive && !activeLog && ["aprobada", "en_progreso"].includes(t.status) && (
                <button className="v6-ac-btn play" style={{ padding: "8px 13px" }} onClick={() => startTask(t.assignmentId)}>
                  <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>Iniciar
                </button>
              )}
              {statusPill(t)}
            </div>
          );
        })}
      </div>

      {/* ── Pendientes (checklists) ── */}
      {Object.values(checklists).some((c) => c.length) && (
        <>
          <div className="v6-sec-title">Pendientes</div>
          <div className="v6-pending">
            {assignments.flatMap((t) => (checklists[t.assignmentId] ?? []).map((item) => (
              <div className="v6-pend" key={item.id}>
                <button className={`v6-pchk ${item.done ? "done" : ""}`} onClick={() => toggleCheck(item)} aria-label="Completar">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
                <div className={`v6-pinfo ${item.done ? "done" : ""}`}>
                  <h5>{item.label}</h5>
                  <p>{t.title}</p>
                </div>
                <span className="v6-pri">{item.done ? "" : PRI_LABEL[t.priority] ?? ""}</span>
              </div>
            )))}
          </div>
        </>
      )}

      {/* Ficha rápida si aún no hay entrada hoy */}
      {!day.hasEntry && (
        <Link href="/fichar" className="v6-ac-btn play" style={{ display: "inline-flex", marginBottom: 30 }}>
          <svg viewBox="0 0 24 24"><path d="M12 2a8 8 0 00-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 00-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
          Fichar entrada
        </Link>
      )}

      {/* Botón / FAB Agregar actividad (v6) */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <button className="v6-add-act-btn" onClick={() => setOpenSheet(true)}>
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agregar actividad
        </button>
      </div>
      <button className="v6-fab" onClick={() => setOpenSheet(true)} aria-label="Agregar actividad">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>

      {/* ── Sheet Agregar actividad (v6) ── */}
      <Sheet open={openSheet} onClose={() => setOpenSheet(false)} title="Agregar actividad"
        subtitle="Para trabajo que realizaste y no estaba asignado en el sistema">
        <div className="v6-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>Esta actividad quedará marcada como <strong>sin validar</strong> hasta que el administrador la revise.</span>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-3)" }}>Tipo de actividad</p>
        <div className="v6-act-grid">
          {(Object.keys(TYPE_LABELS) as (keyof typeof TYPE_LABELS)[]).map((k) => (
            <button key={k} className={`v6-act-opt ${actForm.type === k ? "sel" : ""}`} onClick={() => setActForm((f) => ({ ...f, type: k }))}>
              <svg viewBox="0 0 24 24">{TYPE_ICONS[k]}</svg>
              <span>{TYPE_LABELS[k]}</span>
            </button>
          ))}
        </div>
        <div className="mb-3">
          <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>¿Qué hiciste?</p>
          <input className="input" placeholder="Ej. Cubrí reunión de padres sin solicitud formal"
            value={actForm.title} onChange={(e) => setActForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div>
            <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>Fecha</p>
            <input className="input" type="date" value={actForm.date} max={todayMerida()}
              onChange={(e) => setActForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>Tiempo invertido (min)</p>
            <input className="input" type="number" min="1" placeholder="90"
              value={actForm.minutes} onChange={(e) => setActForm((f) => ({ ...f, minutes: e.target.value }))} />
          </div>
        </div>
        <div className="mb-3">
          <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>¿Quién lo solicitó? <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span></p>
          <input className="input" placeholder="Nombre o área"
            value={actForm.requester} onChange={(e) => setActForm((f) => ({ ...f, requester: e.target.value }))} />
        </div>
        <div className="mb-4">
          <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>Notas <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span></p>
          <textarea className="input resize-none" rows={2} placeholder="Contexto adicional…"
            value={actForm.note} onChange={(e) => setActForm((f) => ({ ...f, note: e.target.value }))} />
        </div>
        <div className="flex gap-2.5">
          <button className="btn-secondary flex-1" onClick={() => setOpenSheet(false)}>Cancelar</button>
          <button className="btn-primary btn-ok flex-[2]" disabled={saving} onClick={submitActivity}>
            {saving ? "Guardando…" : "Registrar actividad"}
          </button>
        </div>
      </Sheet>
    </>
  );
}
