"use client";
// ═══════════════════════════════════════════════════════════════
//  Mi Día · rediseño sobre el sistema Emet OS (Card/Badge/Button)
//  Misma lógica de siempre, solo cambia la piel visual:
//  Time tracking real: iniciar · pausar · reanudar · finalizar
//  (pausar = cerrar sesión de tiempo; reanudar = nueva sesión)
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast, Sheet } from "@/components/ui";
import type { ActivityType } from "@/lib/types";
import type { AssistantMessage } from "@/lib/assistant";
import { todayMerida, addDays } from "@/lib/tz";
import { fmtMin } from "@/lib/hours";
import { LiveJornadaHero } from "@/components/shared/live-jornada-hero";
import { Card, SectionTitle, Badge, Button, SegmentPill, EmptyState, Field, Input, Dialog } from "@/components/os/ui";
import { DatePicker } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { PausaActivaPopup } from "@/components/os/pausa-activa-popup";
import { ContextHeader } from "@/components/context-header";
import type { ContextHeaderInput } from "@/lib/context-header";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { getAttendanceStatus } from "@/lib/domain/attendance/status";
import { notifyUser, notifyAdmins } from "@/lib/notify";

interface Task {
  assignmentId: string; isLead: boolean; projectId: string;
  title: string; type: string; requester: string | null;
  status: string; priority: string; deadline: string | null;
  blockedBy: string[];
}
interface ChecklistItem { id: string; assignment_id: string; position: number; label: string; done: boolean }

const TYPE_ICON: Record<string, string> = {
  cobertura: "layers", diseno: "sparkle", video: "layers", lona: "layers", difusion: "chart",
};
const PRI_LABEL: Record<string, string> = { baja: "Baja", normal: "Normal", alta: "Alta", urgente: "Urgente" };
const PRI_TONE: Record<string, "neutral" | "warn" | "danger"> = {
  baja: "neutral", normal: "neutral", alta: "warn", urgente: "danger",
};

export default function MiDiaClient({ profile, context, day, week, assignments, activityTypes, assistantMessages, highlightProjectId }: {
  profile: { id: string; displayName: string; birthDate: string | null };
  context: {
    vacation: { today: boolean; soonDays: number | null; returnedRecently: boolean };
    isHoliday: boolean;
    incidentToday?: boolean;
    restDayToday?: boolean;
  };
  day: {
    totalMin: number; targetMin: number; isOpen: boolean; hasEntry: boolean;
    firstIn?: string | null; stateName: string | null; stateColor: string | null;
    openSegmentStartsAt?: string | null;
  };
  week: { monday: string; today: string; datesWithActivity: string[] };
  assignments: Task[];
  activityTypes: ActivityType[];
  assistantMessages: AssistantMessage[];
  highlightProjectId?: string | null;
}) {
  const toast = useToast();
  const typeLabel = Object.fromEntries(activityTypes.map((t) => [t.key, t.label]));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<Task | null>(null);
  const [evidenceFallback, setEvidenceFallback] = useState<Task | null>(null);
  const [evidenceLink, setEvidenceLink] = useState("");
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [commentTarget, setCommentTarget] = useState<Task | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const router = useRouter();
  const [activeLog, setActiveLog] = useState<{ id: string; assignmentId: string; startedAt: string } | null>(null);
  const [pausedAssignment, setPausedAssignment] = useState<string | null>(null);
  const [baseMin, setBaseMin] = useState<Record<string, number>>({}); // minutos ya registrados hoy por assignment
  const [elapsed, setElapsed] = useState(0);
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({});
  const [openSheet, setOpenSheet] = useState(false);
  const [actForm, setActForm] = useState({ type: activityTypes[0]?.key ?? "", title: "", date: todayMerida(), minutes: "", requester: "", note: "" });
  const [saving, setSaving] = useState(false);
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlighted, setHighlighted] = useState<string | null>(highlightProjectId ?? null);

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

  // Llegada desde una notificación ("Te asignaron un proyecto"): desplaza a la
  // tarjeta de esa tarea en Agenda de hoy y la resalta unos segundos, en vez de
  // dejar a la persona en el tope de la pantalla sin saber qué cambió.
  useEffect(() => {
    if (!highlightProjectId) return;
    const el = taskRefs.current[highlightProjectId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlighted(null), 3200);
    router.replace("/comunicacion");
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightProjectId]);

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
    const blocking = assignments.find((a) => a.assignmentId === assignmentId)?.blockedBy ?? [];
    if (blocking.length) { toast(`Bloqueada: depende de "${blocking[0]}"`); return; }
    const supabase = createClient();
    const { data, error } = await supabase.from("task_time_logs")
      .insert({ assignment_id: assignmentId, started_at: new Date().toISOString() })
      .select("id, started_at").single();
    if (error || !data) { toast(error?.message?.includes("activa") ? error.message : "No se pudo iniciar — intenta de nuevo", "danger"); return; }
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
    if (error) { toast("No se pudo guardar — intenta de nuevo", "danger"); return -1; }
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
    if (error) { toast("No se pudo actualizar", "danger"); return; }
    setChecklists((c) => ({
      ...c,
      [item.assignment_id]: c[item.assignment_id].map((i) => i.id === item.id ? { ...i, done: !i.done } : i),
    }));
    toast(!item.done ? "Completado" : "Desmarcado");
  };

  const markReview = async (t: Task) => {
    const supabase = createClient();
    const { error } = await supabase.from("projects").update({ status: "en_revision" }).eq("id", t.projectId);
    if (error) { toast("No se pudo actualizar", "danger"); return; }
    toast("Enviado a revisión");

    // Auditoría de notificaciones: esta era la brecha reportada — una
    // actividad podía quedar "en_revision" sin que absolutamente nadie se
    // enterara. Notifica a dos niveles, nunca solo uno: (1) al coordinador
    // que originó la solicitud, si tiene cuenta interna (requester_id no es
    // null solo cuando requester_type='interno' — ver requests.insert en
    // admin/solicitudes/client.tsx); (2) a todos los admins, siempre, como
    // red de seguridad para solicitudes externas/manuales sin requester_id.
    // Nunca bloquea la acción principal (notifyUser/notifyAdmins ya
    // atrapan sus propios errores).
    const { data: prj } = await supabase
      .from("projects")
      .select("requests(requester_id)")
      .eq("id", t.projectId)
      .maybeSingle();
    const requesterId = (prj?.requests as unknown as { requester_id: string | null } | null)?.requester_id ?? null;
    if (requesterId) {
      notifyUser(supabase, requesterId, "Actividad enviada a revisión", t.title, "request", `/admin/proyectos?task=${t.projectId}`);
    }
    notifyAdmins(supabase, `"${t.title}" está lista para revisión`, t.requester ? `Solicitado por ${t.requester}` : undefined, "request", `/admin/proyectos?task=${t.projectId}`);

    router.refresh();
  };

  const addEvidence = (t: Task) => {
    setEvidenceTarget(t);
    fileInputRef.current?.click();
  };

  // Sube el archivo elegido a Google Drive (real, vía Edge Function). Si la
  // persona todavía no dio permiso de Drive (o algo falla), caemos al enlace
  // manual de siempre para no bloquear el trabajo.
  const handleEvidenceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const t = evidenceTarget;
    e.target.value = "";
    if (!file || !t) return;

    const base64: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("drive-upload", {
      body: { fileName: file.name, mimeType: file.type || "application/octet-stream", base64 },
    });
    const url = (data as { ok?: boolean; url?: string } | null)?.url;
    if (error || !url) {
      setEvidenceLink("");
      setEvidenceFallback(t);
      return;
    }
    const { error: e2 } = await supabase.from("evidences").insert({ project_id: t.projectId, uploaded_by: profile.id, drive_url: url });
    toast(e2 ? "No se pudo guardar" : "Evidencia registrada", e2 ? "danger" : "ok");
    router.refresh();
  };

  const saveEvidenceFallback = async () => {
    const t = evidenceFallback;
    const url = evidenceLink.trim();
    if (!t || !url) return;
    setSavingEvidence(true);
    const supabase = createClient();
    const { error: e2 } = await supabase.from("evidences").insert({ project_id: t.projectId, uploaded_by: profile.id, drive_url: url });
    setSavingEvidence(false);
    setEvidenceFallback(null);
    toast(e2 ? "No se pudo guardar" : "Evidencia registrada", e2 ? "danger" : "ok");
    router.refresh();
  };

  const addComment = (t: Task) => {
    setCommentBody("");
    setCommentTarget(t);
  };

  const saveComment = async () => {
    const t = commentTarget;
    const body = commentBody.trim();
    if (!t || !body) return;
    setSavingComment(true);
    const supabase = createClient();
    const { error } = await supabase.from("comments").insert({ project_id: t.projectId, user_id: profile.id, body });
    setSavingComment(false);
    setCommentTarget(null);
    toast(error ? "No se pudo comentar" : "Comentario agregado", error ? "danger" : "ok");
    // Auditoría de notificaciones: un comentario se quedaba solo en la BD,
    // nadie se enteraba de que había uno nuevo salvo que reabriera la
    // actividad por su cuenta.
    if (!error) notifyAdmins(supabase, `Nuevo comentario en "${t.title}"`, body, "request", `/admin/proyectos?task=${t.projectId}`);
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
    if (e1 || !req) { setSaving(false); toast("No se pudo registrar", "danger"); return; }
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
    // Hueco de notificación cerrado (AIOS, 07 ago 2026): antes crear una
    // actividad manual dejaba la solicitud en "en_revision" sin avisar —
    // el admin solo la veía si entraba a revisar el pipeline por su cuenta.
    notifyAdmins(supabase, "Actividad manual para revisar", `${profile.displayName}: ${actForm.title}`, "request", `/admin/proyectos?task=${prj?.id ?? ""}`);
    setSaving(false);
    setOpenSheet(false);
    setActForm({ type: activityTypes[0]?.key ?? "", title: "", date: todayMerida(), minutes: "", requester: "", note: "" });
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

  const contextInput: ContextHeaderInput = useMemo(() => {
    const now = new Date();
    const hourStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", hour12: false, timeZone: "America/Merida" });
    const hour = Number(hourStr.split(":")[0]);
    const dow = new Date(week.today + "T12:00:00").getDay();
    return {
      role: "empleado",
      name: profile.displayName.split(" ")[0],
      hour,
      dow,
      todayISO: week.today,
      isBirthdayToday: isBirthdayToday(profile.birthDate, todayISO()),
      vacation: context.vacation,
      pendingCount,
      teamAllIn: null,
      othersBirthdayToday: [],
      allDone: pendingCount === 0 && assignments.length > 0,
      isHoliday: context.isHoliday,
    };
  }, [profile.displayName, profile.birthDate, week.today, context, pendingCount, assignments.length]);

  const weekDays = useMemo(() => {
    const labels = ["L", "M", "M", "J", "V", "S", "D"];
    return labels.map((l, i) => {
      const date = addDays(week.monday, i);
      return { l, n: Number(date.slice(8, 10)), date, today: date === week.today, has: week.datesWithActivity.includes(date) };
    });
  }, [week]);

  const statusBadge = (t: Task) => {
    if (activeLog?.assignmentId === t.assignmentId) return <Badge tone="accent" dot>En curso</Badge>;
    if (t.status === "en_revision") return <Badge tone="purple">Esperando</Badge>;
    if (t.status === "en_progreso") return <Badge tone="accent">En curso</Badge>;
    if (t.status === "completada") return <Badge tone="ok">Listo</Badge>;
    return <Badge tone="neutral">Pendiente</Badge>;
  };

  const agLine = (t: Task) => {
    const mins = baseMin[t.assignmentId] ?? 0;
    if (t.status === "en_revision") return <p className="text-[12.5px] font-semibold" style={{ color: "var(--warn)" }}>Actividad manual · Sin validar</p>;
    const parts: string[] = [];
    if (activeLog?.assignmentId === t.assignmentId) parts.push("En curso");
    else parts.push(t.status === "en_progreso" ? "En pausa" : "Sin iniciar");
    if (mins > 0) parts.push(fmtMin(mins) + " hoy");
    if (t.deadline) parts.push("Entrega " + new Date(t.deadline + "T12:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "short" }));
    return <p className="text-[12.5px] text-text-3">{parts.join(" · ")}</p>;
  };

  const current = activeTask ?? pausedTask;

  return (
    <div className="space-y-5 pb-10">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xlsx,.pptx"
        onChange={handleEvidenceFile}
      />
      {/* ── Hero — sin recuadro, igual que el saludo de admin ── */}
      <header className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <ContextHeader input={contextInput} />
          <div className="flex items-center gap-2.5 flex-wrap">
            {day.hasEntry && day.stateName && (
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-semibold"
                style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: day.stateColor ?? "var(--text-3)" }} />
                {day.stateName}
              </span>
            )}
          </div>
          <p className="text-[13.5px] text-text-3">
            {assignments.length} tarea{assignments.length !== 1 ? "s" : ""} · {inProgress} en curso · {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-m px-4 py-3 text-center sm:text-right bg-surface-2">
          <p className="text-[12px] font-semibold text-text-3">Tiempo activo</p>
          <p className={`text-[24px] font-bold tabular-nums ${activeLog ? "text-accent" : pausedAssignment ? "" : "text-text-3"}`}
            style={pausedAssignment && !activeLog ? { color: "var(--warn)" } : undefined}>
            {timerStr}
          </p>
        </div>
      </header>

      {/* ── Mi jornada — misma métrica héroe que el Dashboard admin (FASE A):
          tiempo trabajado grande, objetivo, barra de progreso, hora de entrada. ── */}
      <Card>
        {(() => {
          // Mismo criterio que el Dashboard admin (FASE S): pasa por el
          // Attendance Status Resolver en vez de un ternario propio, para que vacaciones
          // o una incidencia aprobada hoy nunca se vean como "Sin iniciar".
          const myFirstIn = day.hasEntry ? (day.firstIn ?? "00:00") : null;
          const myPresence = getAttendanceStatus({
            date: week.today, today: week.today, firstIn: myFirstIn, isOpen: day.isOpen, noRegistroSalida: false,
            vacation: context.vacation.today ? { start: week.today, end: week.today } : null,
            // Mismo placeholder de kind que el resto de call sites migrados —
            // esta pantalla solo sabe "hay incidencia hoy" (booleano), no cuál.
            incident: context.incidentToday && !myFirstIn ? { kind: "permiso" } : null,
            restDay: context.restDayToday && !myFirstIn ? { note: "Descanso asignado" } : null,
            isHoliday: context.isHoliday, isBusinessDay: true,
          });
          const dotColor = myPresence.key === "trabajando" ? "var(--ok)" : myPresence.color;
          const statusLabel = myPresence.label;
          return (
            <LiveJornadaHero
              firstIn={day.firstIn ?? null} totalMin={day.totalMin} targetMin={day.targetMin}
              openSegmentStartsAt={day.openSegmentStartsAt ?? null}
              statusLabel={statusLabel} dotColor={dotColor}
            />
          );
        })()}
      </Card>

      {/* ── Pausa activa: pop-up aparte, no se pierde en la lista ── */}
      <PausaActivaPopup messages={assistantMessages} />

      {/* ── Asistente Contextual (Plano Maestro §11) ── */}
      {(() => {
        const inlineMessages = assistantMessages.filter((m) => !m.id.startsWith("pausa-activa-") && m.id !== "cumpleanos");
        return inlineMessages.length > 0 && (
          <Card>
            <SectionTitle>Asistente</SectionTitle>
            <div className="space-y-1.5">
              {inlineMessages.map((m) => (
                <div key={m.id} className="nx-pop flex items-center gap-2.5 px-2.5 py-2 rounded-sm"
                  style={{
                    background: m.tone === "danger" ? "var(--danger-tint)" : m.tone === "warn" ? "var(--warn-tint)" : "var(--surface-2)",
                  }}>
                  <span className={`shrink-0 ${m.animated ? "nx-msg-icon-bounce" : ""}`} style={{ color: m.tone === "danger" ? "var(--danger)" : m.tone === "warn" ? "var(--warn)" : "var(--text-2)" }}>
                    <Icon name={m.icon} size={16} />
                  </span>
                  <p className="text-[13.5px] font-semibold flex-1"
                    style={{ color: m.tone === "danger" ? "var(--danger)" : m.tone === "warn" ? "var(--warn)" : "var(--text-1)" }}>
                    {m.text}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* ── Tira semanal — clicable: lleva al Calendario centrado en ese día ── */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((d, i) => (
          <Link key={i} href={`/comunicacion/calendario?m=${d.date.slice(0, 7)}&d=${d.date}`}
            className="rounded-sm py-3 text-center transition-transform active:scale-95 hover:brightness-95"
            style={{
              background: d.today ? "var(--accent)" : "var(--surface-2)",
              color: d.today ? "#fff" : "var(--text-2)",
            }}>
            <p className="text-[12px] font-semibold opacity-80">{d.l}</p>
            <p className="text-[16px] font-bold tabular-nums mt-1">{d.n}</p>
            {d.has && !d.today && <span className="block mx-auto mt-1.5 h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />}
          </Link>
        ))}
      </div>

      {/* ── Tarea activa / pausada ── */}
      {current && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: activeTask ? "var(--ok)" : "var(--warn)" }} />
            <p className="text-[12.5px] font-bold" style={{ color: activeTask ? "var(--ok)" : "var(--warn)" }}>
              {activeTask ? "En curso ahora" : "En pausa"}
            </p>
          </div>
          <h3 className="text-[16px] font-bold text-text-1">{current.title}</h3>
          <p className="text-[13.5px] text-text-3 mt-0.5">
            {typeLabel[current.type] ?? current.type}
            {current.requester ? ` · ${current.requester}` : ""}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {activeTask ? (
              <Button variant="subtle" icon="clock" onClick={pauseTask}>Pausar</Button>
            ) : (
              <Button variant="primary" icon="plus" onClick={() => startTask(pausedTask!.assignmentId)}>Reanudar</Button>
            )}
            {activeTask && <Button variant="danger" icon="check" onClick={stopTask}>Finalizar</Button>}
            <Button variant="subtle" icon="sparkle" onClick={() => addEvidence(current)}>Evidencia</Button>
            <Button variant="subtle" icon="inbox" onClick={() => addComment(current)}>Comentar</Button>
            {current.isLead && current.status === "en_progreso" && (
              <Button variant="subtle" icon="check" onClick={() => markReview(current)}>Pasar a revisión</Button>
            )}
          </div>
        </Card>
      )}

      {/* ── Agenda de hoy ── */}
      <Card>
        <SectionTitle>Agenda de hoy</SectionTitle>
        {assignments.length === 0 ? (
          <EmptyState icon="layers" title="Sin tareas asignadas" hint="Cuando el admin te asigne un proyecto aparecerá aquí." />
        ) : (
          <div className="space-y-1">
            {assignments.map((t) => {
              const isActive = activeLog?.assignmentId === t.assignmentId;
              const blocked = t.blockedBy.length > 0;
              const canStart = !isActive && !activeLog && !blocked && ["aprobada", "en_progreso"].includes(t.status);
              const isHighlighted = highlighted === t.projectId;
              return (
                <div key={t.assignmentId}
                  ref={(el) => { taskRefs.current[t.projectId] = el; }}
                  className="flex items-center gap-3 p-2.5 rounded-sm hover:bg-hover transition-colors"
                  style={isHighlighted ? { background: "var(--accent-tint)", outline: "1.5px solid var(--accent)", outlineOffset: "-1.5px" } : undefined}>
                  <span className="grid place-items-center h-9 w-9 rounded-sm shrink-0"
                    style={{
                      background: isActive ? "var(--accent-tint)" : t.status === "en_revision" ? "var(--warn-tint)" : "var(--surface-2)",
                      color: isActive ? "var(--accent)" : t.status === "en_revision" ? "var(--warn)" : "var(--text-2)",
                    }}>
                    <Icon name={TYPE_ICON[t.type] ?? "layers"} size={17} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-text-1 truncate">{t.title}</p>
                    {blocked
                      ? <p className="text-[12.5px] font-semibold flex items-center gap-1" style={{ color: "var(--danger)" }} title={`Depende de: ${t.blockedBy.join(", ")}`}>
                          <Icon name="lock" size={11} /> Depende de "{t.blockedBy[0]}"{t.blockedBy.length > 1 ? ` +${t.blockedBy.length - 1}` : ""}
                        </p>
                      : agLine(t)}
                  </div>
                  {canStart && <Button variant="primary" size="sm" icon="plus" onClick={() => startTask(t.assignmentId)}>Iniciar</Button>}
                  {statusBadge(t)}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Pendientes (checklists) ── */}
      {Object.values(checklists).some((c) => c.length) && (
        <Card>
          <SectionTitle>Pendientes</SectionTitle>
          <div className="space-y-1">
            {assignments.flatMap((t) => (checklists[t.assignmentId] ?? []).map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-sm hover:bg-hover transition-colors">
                <button
                  onClick={() => toggleCheck(item)} aria-label="Completar"
                  className="grid place-items-center h-6 w-6 rounded-full shrink-0 border transition-colors"
                  style={item.done
                    ? { background: "var(--ok)", borderColor: "var(--ok)", color: "#fff" }
                    : { borderColor: "var(--border-2)", color: "transparent" }}>
                  <Icon name="check" size={13} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13.5px] font-semibold truncate ${item.done ? "line-through text-text-3" : "text-text-1"}`}>{item.label}</p>
                  <p className="text-[12px] text-text-3 truncate">{t.title}</p>
                </div>
                {!item.done && <Badge tone={PRI_TONE[t.priority] ?? "neutral"}>{PRI_LABEL[t.priority] ?? ""}</Badge>}
              </div>
            )))}
          </div>
        </Card>
      )}

      {/* Comenzar jornada rápido si aún no hay entrada hoy */}
      {!day.hasEntry && (
        <Link href="/fichar"
          className="btn-primary inline-flex items-center gap-1.5 h-9 px-4 text-[13.5px]">
          <Icon name="clock" size={15} /> Comenzar jornada
        </Link>
      )}

      {/* Agregar actividad */}
      <div className="flex justify-center">
        <Button variant="subtle" icon="plus" onClick={() => setOpenSheet(true)}>Agregar actividad</Button>
      </div>
      <button
        onClick={() => setOpenSheet(true)} aria-label="Agregar actividad"
        className="sm:hidden fixed z-40 grid place-items-center h-14 w-14 rounded-full text-white shadow-nx active:scale-95 transition-transform"
        style={{ right: "18px", bottom: "max(18px, env(safe-area-inset-bottom))", background: "var(--accent)" }}>
        <Icon name="plus" size={22} />
      </button>

      {/* ── Sheet Agregar actividad ── */}
      <Sheet open={openSheet} onClose={() => setOpenSheet(false)} title="Agregar actividad"
        subtitle="Para trabajo que realizaste y no estaba asignado en el sistema">
        <div className="flex items-start gap-2.5 p-3 rounded-sm mb-4" style={{ background: "var(--warn-tint)" }}>
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" style={{ color: "var(--warn)" }} />
          <span className="text-[12.5px]" style={{ color: "var(--warn)" }}>
            Esta actividad quedará marcada como <strong>sin validar</strong> hasta que el administrador la revise.
          </span>
        </div>
        <p className="text-[12px] font-bold mb-2.5 text-text-3">Tipo de actividad</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {activityTypes.map((t) => (
            <SegmentPill key={t.key} active={actForm.type === t.key} onClick={() => setActForm((f) => ({ ...f, type: t.key }))}>
              {t.label}
            </SegmentPill>
          ))}
        </div>
        <div className="space-y-3 mb-4">
          <Field label="¿Qué hiciste?">
            <Input placeholder="Ej. Cubrí reunión de padres sin solicitud formal"
              value={actForm.title} onChange={(e) => setActForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Fecha">
              <DatePicker value={actForm.date} maxDate={todayMerida()}
                onChange={(v) => setActForm((f) => ({ ...f, date: v }))} />
            </Field>
            <Field label="Tiempo invertido (min)">
              <Input type="number" min="1" placeholder="90"
                value={actForm.minutes} onChange={(e) => setActForm((f) => ({ ...f, minutes: e.target.value }))} />
            </Field>
          </div>
          <Field label="¿Quién lo solicitó? (opcional)">
            <Input placeholder="Nombre o área"
              value={actForm.requester} onChange={(e) => setActForm((f) => ({ ...f, requester: e.target.value }))} />
          </Field>
          <Field label="Notas (opcional)">
            <textarea rows={2} placeholder="Contexto adicional…"
              className="w-full rounded-sm px-3 py-2 text-[14px] bg-input border border-border text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)] resize-none"
              value={actForm.note} onChange={(e) => setActForm((f) => ({ ...f, note: e.target.value }))} />
          </Field>
        </div>
        <div className="flex gap-2.5">
          <Button variant="subtle" className="flex-1" onClick={() => setOpenSheet(false)}>Cancelar</Button>
          <Button variant="primary" className="flex-[2]" disabled={saving} onClick={submitActivity}>
            {saving ? "Guardando…" : "Registrar actividad"}
          </Button>
        </div>
      </Sheet>

      <Dialog
        open={!!evidenceFallback}
        onClose={() => !savingEvidence && setEvidenceFallback(null)}
        onConfirm={saveEvidenceFallback}
        busy={savingEvidence}
        title="No se pudo subir a Drive"
        description="Pega el enlace de la evidencia para registrarla manualmente."
        confirmLabel={savingEvidence ? "Guardando…" : "Guardar evidencia"}
      >
        <Input
          placeholder="https://drive.google.com/…"
          value={evidenceLink}
          onChange={(e) => setEvidenceLink(e.target.value)}
        />
      </Dialog>

      <Dialog
        open={!!commentTarget}
        onClose={() => !savingComment && setCommentTarget(null)}
        onConfirm={saveComment}
        busy={savingComment}
        title={`Comentar en "${commentTarget?.title ?? ""}"`}
        confirmLabel={savingComment ? "Enviando…" : "Enviar comentario"}
      >
        <textarea
          rows={3}
          placeholder="Escribe tu comentario…"
          className="w-full rounded-sm px-3 py-2 text-[14px] bg-input border border-border text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)] resize-none"
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
        />
      </Dialog>
    </div>
  );
}
