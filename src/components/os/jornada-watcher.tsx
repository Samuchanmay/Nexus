"use client";
// ══════════════════════════════════════════════════════════
//  NEXUS · Vigía de jornada — montado en el layout de admin/
//  empleado (los únicos roles que fichan). Tres responsabilidades
//  totalmente independientes entre sí (Samu, corrección de lógica
//  de jornada — cronómetro / estado / recordatorios / heartbeat NO
//  se mezclan):
//   1. Heartbeat: si la persona sigue usando Emet, sin afectar el
//      cálculo de horas — solo referencia para RH si luego olvida
//      registrar su salida.
//   2. Recordatorios a los 30/60/120 min de pasar el objetivo,
//      mientras la jornada sigue abierta (nunca se auto-cierra).
//   3. Diálogo de "jornada pendiente": si un día pasado quedó
//      abierto sin salida, se pregunta al iniciar sesión — nunca se
//      etiqueta directamente "No registró salida".
//   4. FASE 7 (auditoría 4 ago 2026) — Cobertura de eventos del día:
//      si la persona está confirmada como participante de un evento
//      institucional que cae hoy, se le avisa aquí mismo con botón
//      "Iniciar cobertura" — antes el check-in de eventos (RPC ya
//      existente desde 0030) solo era alcanzable a mano desde
//      /admin/calendario, nadie se enteraba de que tenía cobertura.
// ══════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { summarizeDay, scheduleFor } from "@/lib/hours";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { todayMerida } from "@/lib/tz";
import { getOldestPendingExit, resolvePendingExit, type PendingExit } from "@/lib/pending-exits";
import { Field, Input, Button } from "./ui";
import { TimePicker, useToast } from "@/components/ui";
import { Icon } from "./icons";

const HEARTBEAT_MS = 3 * 60 * 1000;
const HEARTBEAT_ACTIVITY_COOLDOWN_MS = 60 * 1000;
const POLL_MS = 60 * 1000;
const REMINDER_STEPS = [30, 60, 120] as const;

export function JornadaWatcher({ userId }: { userId: string }) {
  const router = useRouter();

  // ── 1. Heartbeat — última actividad, nunca afecta el cálculo de horas ──
  useEffect(() => {
    const supabase = createClient();
    let lastSent = 0;
    const beat = () => {
      lastSent = Date.now();
      supabase.from("user_heartbeats").upsert({ user_id: userId, last_seen_at: new Date().toISOString() }).then(() => {});
    };
    beat();
    const onActivity = () => { if (Date.now() - lastSent > HEARTBEAT_ACTIVITY_COOLDOWN_MS) beat(); };
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    const id = setInterval(beat, HEARTBEAT_MS);
    window.addEventListener("click", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  // ── 2. Recordatorios inteligentes (30/60/120 min pasado el objetivo) ──
  const [reminderLevel, setReminderLevel] = useState<number | null>(null);
  const shownLevelsRef = useRef<Set<number>>(new Set());
  const dayKeyRef = useRef<string>("");

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const poll = async () => {
      const today = todayMerida();
      const [{ data: att }, { data: sched }, { data: states }] = await Promise.all([
        supabase.from("attendance").select("*").eq("user_id", userId).eq("date", today),
        supabase.from("schedules").select("*").eq("user_id", userId),
        supabase.from("jornada_states").select("*").eq("activo", true),
      ]);
      if (cancelled) return;
      const schedule = scheduleFor((sched ?? []) as Schedule[], userId, today) ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" };
      const day = summarizeDay(today, (att ?? []) as AttendanceRow[], schedule, (states ?? []) as JornadaState[]);

      // Si cambiamos de día (o cerró la jornada), reiniciar qué niveles ya se mostraron.
      const dayKey = `${today}:${day.isOpen}`;
      if (dayKeyRef.current && dayKeyRef.current.split(":")[0] !== today) shownLevelsRef.current = new Set();
      dayKeyRef.current = dayKey;

      if (!day.isOpen || !day.firstIn) {
        setReminderLevel(null);
        return;
      }
      const overMin = day.totalMin - day.targetMin;
      for (const step of REMINDER_STEPS) {
        if (overMin >= step && !shownLevelsRef.current.has(step)) {
          shownLevelsRef.current.add(step);
          setReminderLevel(step);
          if (step === 120 && typeof window !== "undefined") {
            try {
              const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.frequency.value = 660;
              gain.gain.value = 0.05;
              osc.connect(gain).connect(ctx.destination);
              osc.start();
              setTimeout(() => { osc.stop(); ctx.close(); }, 220);
            } catch { /* audio no disponible — no bloquea el recordatorio */ }
          }
          break;
        }
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── 3. Jornada pendiente (día anterior sin salida) ──
  const [pending, setPending] = useState<PendingExit | null | undefined>(undefined);
  const [hora, setHora] = useState("18:00");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    getOldestPendingExit(supabase, userId).then((pe) => {
      const dismissed = sessionStorage.getItem("nexus_pending_dismissed");
      if (pe && dismissed === pe.date) return setPending(null);
      setPending(pe);
    });
  }, [userId]);

  const guardarPendiente = async () => {
    if (!pending) return;
    setBusy(true);
    const supabase = createClient();
    const r = await resolvePendingExit(supabase, userId, pending.date, `${hora}:00`, motivo);
    setBusy(false);
    if (r.ok) setPending(null);
  };
  const dismissPendiente = () => {
    if (pending) sessionStorage.setItem("nexus_pending_dismissed", pending.date);
    setPending(null);
  };

  // ── 4. Cobertura de eventos del día (FASE 7) ──
  type TodayCoverage = {
    eventId: string; title: string; locationType: string; locationName: string | null;
    allowAnyLocation: boolean;
    coverageStatus: "not_checked_in" | "in_coverage" | "coverage_completed";
    checkInAt: string | null;
  };
  const toast = useToast();
  const [todayEvents, setTodayEvents] = useState<TodayCoverage[]>([]);
  const [eventBusyId, setEventBusyId] = useState<string | null>(null);
  const dismissedEventsRef = useRef<Set<string>>(new Set());

  const loadTodayEvents = async () => {
    const supabase = createClient();
    const today = todayMerida();
    const { data: parts } = await supabase
      .from("event_participants")
      .select("event_id, status, institutional_events!inner(id, title, start_date, end_date, status, location_type, location_name, allow_any_location)")
      .eq("user_id", userId).eq("status", "confirmado")
      .eq("institutional_events.status", "confirmado")
      .lte("institutional_events.start_date", today).gte("institutional_events.end_date", today);
    if (!parts || parts.length === 0) { setTodayEvents([]); return; }

    const rows = await Promise.all(parts.map(async (p) => {
      const ev = Array.isArray(p.institutional_events) ? p.institutional_events[0] : p.institutional_events;
      if (!ev) return null;
      const { data: status } = await supabase.rpc("get_event_coverage_status", { p_event_id: ev.id, p_user_id: userId });
      return {
        eventId: ev.id, title: ev.title, locationType: ev.location_type, locationName: ev.location_name,
        allowAnyLocation: ev.allow_any_location,
        coverageStatus: (status?.coverage_status ?? "not_checked_in") as TodayCoverage["coverageStatus"],
        checkInAt: status?.check_in_at ?? null,
      } satisfies TodayCoverage;
    }));
    setTodayEvents(rows.filter((r): r is TodayCoverage => r !== null && !dismissedEventsRef.current.has(r.eventId)));
  };

  useEffect(() => { loadTodayEvents(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCoverage = async (ev: TodayCoverage) => {
    setEventBusyId(ev.eventId);
    const supabase = createClient();
    let coords: string | null = null;
    if (ev.locationType === "externo" && !ev.allowAnyLocation && navigator.geolocation) {
      coords = await new Promise<string | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      });
    }
    const { data, error } = await supabase.rpc("event_check_in", {
      p_event_id: ev.eventId, p_user_id: userId, p_coords: coords,
      p_location_type: ev.locationType === "externo" ? "evento" : "oficina",
    });
    setEventBusyId(null);
    if (error || !data?.ok) { toast(data?.error || "No se pudo iniciar cobertura", "danger"); return; }
    toast(`Cobertura iniciada: ${ev.title}`, "ok");
    await loadTodayEvents();
  };
  const finishCoverage = async (ev: TodayCoverage) => {
    setEventBusyId(ev.eventId);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("event_check_out", { p_event_id: ev.eventId, p_user_id: userId });
    setEventBusyId(null);
    if (error || !data?.ok) { toast(data?.error || "No se pudo finalizar cobertura", "danger"); return; }
    toast(`Cobertura finalizada · ${Math.floor(data.duration_min / 60)}h ${data.duration_min % 60}m`, "ok");
    await loadTodayEvents();
  };
  const dismissEvent = (eventId: string) => {
    dismissedEventsRef.current.add(eventId);
    setTodayEvents((evs) => evs.filter((e) => e.eventId !== eventId));
  };

  const dateLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  const REMINDER_COPY: Record<number, { title: string; body: string }> = {
    30: { title: "¿Sigues trabajando?", body: "Ya pasaste tu hora objetivo — solo confirmando que sigues en jornada." },
    60: { title: "Todavía no registras tu salida", body: "¿Sigues en la oficina? Si ya terminaste, registra tu salida para dejarlo al día." },
    120: { title: "Llevas mucho tiempo sin registrar salida", body: "Han pasado más de 2 horas desde tu objetivo. Registra tu salida cuando termines." },
  };

  return (
    <>
      {(todayEvents.length > 0 || reminderLevel !== null) && (
        <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-3 items-end">
          {todayEvents.map((ev) => (
            <div key={ev.eventId} className="max-w-[340px] w-[340px] card p-4 shadow-lg" style={{ animation: "nx-pop .2s ease-out" }}>
              <div className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }}><Icon name="pin" size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold">Tienes cobertura de evento hoy</p>
                  <p className="text-[12.5px] mt-0.5 truncate" style={{ color: "var(--text-2)" }}>
                    {ev.title}{ev.locationName ? ` · ${ev.locationName}` : ""}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-3)" }}>
                    {ev.coverageStatus === "in_coverage" && ev.checkInAt
                      ? `En cobertura desde ${new Date(ev.checkInAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`
                      : ev.coverageStatus === "coverage_completed" ? "Cobertura completa" : "Aún no inicias"}
                  </p>
                </div>
                <button onClick={() => dismissEvent(ev.eventId)} className="shrink-0" style={{ color: "var(--text-3)" }} aria-label="Ocultar">
                  <Icon name="close" size={14} />
                </button>
              </div>
              {ev.coverageStatus !== "coverage_completed" && (
                <div className="flex gap-2 mt-3">
                  {ev.coverageStatus === "not_checked_in" && (
                    <Button variant="primary" size="sm" className="flex-1" disabled={eventBusyId === ev.eventId} onClick={() => startCoverage(ev)}>
                      Iniciar cobertura
                    </Button>
                  )}
                  {ev.coverageStatus === "in_coverage" && (
                    <Button variant="primary" size="sm" className="flex-1" disabled={eventBusyId === ev.eventId} onClick={() => finishCoverage(ev)}>
                      Finalizar cobertura
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}

      {reminderLevel !== null && (
        <div className="max-w-[340px] card p-4 shadow-lg" style={{ animation: "nx-pop .2s ease-out" }}>
          <div className="flex items-start gap-3">
            <span className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }}><Icon name="alarm" size={18} /></span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold">{REMINDER_COPY[reminderLevel]?.title}</p>
              <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-2)" }}>{REMINDER_COPY[reminderLevel]?.body}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="subtle" size="sm" className="flex-1" onClick={() => setReminderLevel(null)}>Sigo trabajando</Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={() => { setReminderLevel(null); router.push("/fichar"); }}>Registrar salida</Button>
          </div>
        </div>
      )}
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }}>
          <div className="card p-5 w-full max-w-sm">
            <p className="text-[15px] font-bold mb-1">Jornada pendiente</p>
            <p className="text-[13.5px] mb-4" style={{ color: "var(--text-2)" }}>
              El <span className="font-semibold capitalize">{dateLabel(pending.date)}</span> olvidaste registrar tu salida. ¿A qué hora saliste?
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Field label="Hora de salida">
                <TimePicker value={hora} onChange={setHora} />
              </Field>
              <Field label="Motivo (opcional)">
                <Input placeholder="Olvidé registrar" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="sm" onClick={guardarPendiente} disabled={busy}>Guardar</Button>
              <Button variant="ghost" size="sm" onClick={dismissPendiente} disabled={busy}>Ahora no</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
