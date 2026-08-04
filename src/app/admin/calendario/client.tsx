"use client";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Avatar, SlidingSegments, Sheet, DateRangeField, Select, useToast } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { MONTHS, dayLongLabel, weekRangeLabel, weekStartOf, daysInRange } from "@/lib/calendar-core";
import { shiftMonth } from "@/lib/calendar-grid";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { dmy, addDays } from "@/lib/tz";
import { holidayStyle, INSTITUTIONAL_KIND_LABEL, type InstitutionalKind } from "@/lib/ui-maps";
import { usePersistedView } from "@/lib/persisted-view";
import { useSupabaseMutation, Field } from "@/components/shared";
import { IconTrash } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction } from "@/lib/admin-log";
import { CalendarEngine, CalendarHeader, MonthView, WeekView, DayView, AgendaView, YearView, CalendarLegend, CalendarRightPanel, CalendarFilterBar } from "@/components/calendar";
import type { CalendarEvent, CalendarLayer } from "@/components/calendar";

const GRANULARITIES = ["Agenda", "Día", "Semana", "Mes", "Año"] as const;
type Granularity = (typeof GRANULARITIES)[number];

export type TeamMember = { id: string; display_name: string; nexus_color: string | null; avatar_url?: string | null; birth_date?: string | null };
export type VacationRange = { user_id: string; start_date: string; end_date: string };
export type ProjectDeadline = {
  id: string; deadline: string; status: string;
  requests: { title: string; type: string } | null;
  project_assignments: { is_lead: boolean; users: { display_name: string; nexus_color: string | null } }[];
};

export type GcalEvent = { id: string; title: string; start: string; end: string; allDay: boolean };
export type InstitutionalEvent = {
  id: string; title: string; kind: string; start_date: string; end_date: string; notes: string | null;
  // Campos nuevos (Fase 1 — migración 0028)
  start_time?: string | null; end_time?: string | null;
  client_name?: string | null; department_id?: string | null;
  location_type?: string; location_name?: string | null; location_address?: string | null;
  location_coords?: string | null; location_radius?: number; allow_any_location?: boolean;
  owner_id?: string | null; status?: string; priority?: string; description?: string | null;
  // Campos Fase 3 — Sincronización con Google Calendar (migración 0031)
  sync_to_google?: boolean; google_calendar_id?: string | null;
};

export default function CalendarioClient({
  ym, year, month, daysInMonth, today, prevHref, nextHref,
  team, attendance, vacations, holidays, deadlines, efemerides, gcalEvents, gcalError,
  initialFocusDate, institutionalEvents, adminId,
}: {
  ym: string; year: number; month: number; daysInMonth: number; today: string;
  prevHref: string; nextHref: string;
  team: TeamMember[]; attendance: { user_id: string; date: string }[];
  vacations: VacationRange[]; holidays: { date: string; name: string; kind: string }[];
  deadlines: ProjectDeadline[]; efemerides?: string[]; gcalEvents?: GcalEvent[];
  gcalError?: string | null;
  initialFocusDate?: string;
  institutionalEvents?: InstitutionalEvent[];
  adminId?: string;
}) {
  const router = useRouter();
  const [view, setView] = usePersistedView<"Equipo" | "Asistencia">(
    "calendario.admin.view", ["Equipo", "Asistencia"], "Equipo"
  );
  // Granularidad Agenda/Día/Semana/Mes/Año (Plano Maestro + Fase B del motor
  // — EMET-CALENDAR-ENGINE.md §14). Persistida: no debe reiniciar a "Mes" al
  // salir y volver a entrar (punto 1 del pulido UX).
  const [granularity, setGranularity] = usePersistedView<Granularity>(
    "calendario.admin.granularity", GRANULARITIES, "Mes"
  );
  const [focusDate, setFocusDate] = useState(initialFocusDate ?? today);

  // ── Calendarios institucionales (FASE U) — CRUD directo desde el mismo
  //    Calendario general, mismo patrón de Sheet que Días inhábiles. ──
  const toast = useToast();
  const { run: runSaveEvent, saving: savingEvent } = useSupabaseMutation();
  const { run: runDeleteEvent, saving: deletingEvent } = useSupabaseMutation();
  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<InstitutionalEvent | null>(null);
  const [eventForm, setEventForm] = useState<{
    title: string; kind: InstitutionalKind; start: string | null; end: string | null; notes: string;
    // Campos nuevos (Fase 1)
    startTime: string; endTime: string; clientName: string; departmentId: string;
    locationType: "interno" | "externo"; locationName: string; locationAddress: string;
    locationCoords: string; locationRadius: number; allowAnyLocation: boolean;
    ownerId: string; status: "pendiente" | "confirmado" | "cancelado";
    priority: "alta" | "media" | "baja"; description: string;
    // Campos Fase 3: Sincronización con Google Calendar
    syncToGoogle: boolean; googleCalendarId: string;
  }>({
    title: "", kind: "evento", start: null, end: null, notes: "",
    startTime: "", endTime: "", clientName: "", departmentId: "",
    locationType: "interno", locationName: "", locationAddress: "",
    locationCoords: "", locationRadius: 150, allowAnyLocation: false,
    ownerId: "", status: "pendiente", priority: "media", description: "",
    syncToGoogle: false, googleCalendarId: "",
  });
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false);

  // ── Check-in/out de eventos (Fase 2) ──
  const [checkinSheetOpen, setCheckinSheetOpen] = useState(false);
  const [checkinEvent, setCheckinEvent] = useState<InstitutionalEvent | null>(null);
  const [checkinStatus, setCheckinStatus] = useState<{
    is_participant: boolean;
    participant_role?: string;
    participant_status?: string;
    coverage_status?: string;
    check_in_at?: string;
    check_out_at?: string;
    duration_min?: number;
  } | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Solicitar GPS al abrir el sheet de check-in
  useEffect(() => {
    if (!checkinSheetOpen || !checkinEvent) return;
    if (checkinEvent.location_type !== "externo" || checkinEvent.allow_any_location) return;

    if (!navigator.geolocation) {
      setGpsError("GPS no disponible en este dispositivo");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError(null);
      },
      (err) => {
        setGpsError("No se pudo obtener tu ubicación");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [checkinSheetOpen, checkinEvent]);

  const loadCoverageStatus = async (eventId: string, userId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_event_coverage_status", {
      p_event_id: eventId,
      p_user_id: userId,
    });
    if (!error && data) {
      setCheckinStatus(data);
    }
  };

  const handleCheckIn = async () => {
    if (!checkinEvent || !adminId) return;
    setCheckinLoading(true);

    const supabase = createClient();
    const coords = gpsCoords ? `${gpsCoords.lat},${gpsCoords.lng}` : null;

    const { data, error } = await supabase.rpc("event_check_in", {
      p_event_id: checkinEvent.id,
      p_user_id: adminId,
      p_coords: coords,
      p_location_type: checkinEvent.location_type === "externo" ? "evento" : "oficina",
    });

    setCheckinLoading(false);

    if (error || !data?.ok) {
      toast(data?.error || "Error al hacer check-in", "danger");
      return;
    }

    toast("Check-in registrado", "ok");
    await loadCoverageStatus(checkinEvent.id, adminId);
  };

  const handleCheckOut = async () => {
    if (!checkinEvent || !adminId) return;
    setCheckinLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("event_check_out", {
      p_event_id: checkinEvent.id,
      p_user_id: adminId,
    });

    setCheckinLoading(false);

    if (error || !data?.ok) {
      toast(data?.error || "Error al hacer check-out", "danger");
      return;
    }

    toast(`Check-out registrado · Duración: ${Math.floor(data.duration_min / 60)}h ${data.duration_min % 60}m`, "ok");
    await loadCoverageStatus(checkinEvent.id, adminId);
  };

  const openCheckinSheet = async (ev: InstitutionalEvent) => {
    setCheckinEvent(ev);
    setCheckinSheetOpen(true);
    setGpsCoords(null);
    setGpsError(null);
    setCheckinStatus(null);
    if (adminId) {
      await loadCoverageStatus(ev.id, adminId);
    }
  };

  const openAddEvent = () => {
    setEditingEvent(null);
    setEventForm({
      title: "", kind: "evento", start: focusDate, end: focusDate, notes: "",
      startTime: "", endTime: "", clientName: "", departmentId: "",
      locationType: "interno", locationName: "", locationAddress: "",
      locationCoords: "", locationRadius: 150, allowAnyLocation: false,
      ownerId: "", status: "pendiente", priority: "media", description: "",
      syncToGoogle: false, googleCalendarId: "",
    });
    setConfirmDeleteEvent(false);
    setEventSheetOpen(true);
  };
  const openEditEvent = (ev: InstitutionalEvent) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title, kind: (ev.kind as InstitutionalKind) ?? "evento",
      start: ev.start_date, end: ev.end_date, notes: ev.notes ?? "",
      startTime: ev.start_time ?? "", endTime: ev.end_time ?? "",
      clientName: ev.client_name ?? "", departmentId: ev.department_id ?? "",
      locationType: (ev.location_type as "interno" | "externo") ?? "interno",
      locationName: ev.location_name ?? "", locationAddress: ev.location_address ?? "",
      locationCoords: ev.location_coords ?? "", locationRadius: ev.location_radius ?? 150,
      allowAnyLocation: ev.allow_any_location ?? false,
      ownerId: ev.owner_id ?? "", status: (ev.status as "pendiente" | "confirmado" | "cancelado") ?? "pendiente",
      priority: (ev.priority as "alta" | "media" | "baja") ?? "media", description: ev.description ?? "",
      syncToGoogle: ev.sync_to_google ?? false, googleCalendarId: ev.google_calendar_id ?? "",
    });
    setConfirmDeleteEvent(false);
    setEventSheetOpen(true);
  };
  const saveEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.start || !eventForm.end) { toast("Título y rango de fechas son obligatorios", "warn"); return; }
    const payload = {
      title: eventForm.title.trim(), kind: eventForm.kind,
      start_date: eventForm.start, end_date: eventForm.end,
      notes: eventForm.notes.trim() || null,
      // Campos nuevos (Fase 1)
      start_time: eventForm.startTime || null,
      end_time: eventForm.endTime || null,
      client_name: eventForm.clientName.trim() || null,
      department_id: eventForm.departmentId || null,
      location_type: eventForm.locationType,
      location_name: eventForm.locationName.trim() || null,
      location_address: eventForm.locationAddress.trim() || null,
      location_coords: eventForm.locationCoords.trim() || null,
      location_radius: eventForm.locationRadius,
      allow_any_location: eventForm.allowAnyLocation,
      owner_id: eventForm.ownerId || null,
      status: eventForm.status,
      priority: eventForm.priority,
      description: eventForm.description.trim() || null,
      // Campos Fase 3: Sincronización con Google Calendar
      sync_to_google: eventForm.syncToGoogle,
      google_calendar_id: eventForm.googleCalendarId || null,
    };
    const ok = await runSaveEvent(async () => {
      const sb = createClient();
      const { error } = editingEvent
        ? await sb.from("institutional_events").update(payload).eq("id", editingEvent.id)
        : await sb.from("institutional_events").insert(payload);
      if (error) return { error: { message: "No se pudo guardar el evento institucional" } };
      return { error: null };
    }, { ok: editingEvent ? "Evento institucional actualizado" : "Evento institucional agregado" });
    if (ok) {
      // Si está activada la sincronización con Google, sincronizar el evento
      if (eventForm.syncToGoogle) {
        const sb = createClient();
        const { data: eventId } = editingEvent
          ? { data: editingEvent.id }
          : await sb.from("institutional_events").select("id").order("created_at", { ascending: false }).limit(1).single();
        
        if (eventId) {
          const { data: syncResult, error: syncError } = await sb.functions.invoke("gcal-sync-event", {
            body: { eventId, action: editingEvent ? "update" : "create" },
          });
          if (syncError || !syncResult?.ok) {
            toast("Evento guardado, pero no se pudo sincronizar con Google Calendar", "warn");
          } else {
            toast(`Evento guardado y sincronizado con Google Calendar`, "ok");
          }
        }
      }
      
      setEventSheetOpen(false);
      if (adminId) logAdminAction(createClient(), adminId, editingEvent ? "Editó evento institucional" : "Agregó evento institucional", eventForm.title.trim());
      router.refresh();
    }
  };
  const deleteEvent = async () => {
    if (!editingEvent) return;
    const ok = await runDeleteEvent(() => createClient().from("institutional_events").delete().eq("id", editingEvent.id),
      { ok: "Evento institucional eliminado", err: "No se pudo eliminar" });
    if (ok) {
      setEventSheetOpen(false);
      if (adminId) logAdminAction(createClient(), adminId, "Eliminó evento institucional", editingEvent.title);
      router.refresh();
    }
  };

  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth).padStart(2, "0")}`;
  const holidayOf = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const holidayKindOf = useMemo(() => new Map(holidays.map((h) => [h.date, h.kind])), [holidays]);
  // `holidays` ahora llega con el AÑO completo (para la vista Año del motor)
  // — esta lista se acota de vuelta al mes en pantalla para el resumen de abajo.
  const monthHolidays = useMemo(() => holidays.filter((h) => h.date >= first && h.date <= last), [holidays, first, last]);
  const attSet = useMemo(() => new Set(attendance.map((a) => `${a.user_id}|${a.date}`)), [attendance]);

  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    const date = `${ym}-${d}`;
    const dow = new Date(`${date}T12:00:00`).getDay();
    return { n: i + 1, date, isWeekend: dow === 0 || dow === 6, holiday: holidayOf.get(date) ?? null };
  }), [daysInMonth, ym, holidayOf]);

  // Semana enfocada (Lun–Dom) que contiene focusDate — ya no depende de la
  // rejilla del mes (antes buscaba el bloque dentro de monthCells), así que
  // funciona igual aunque la semana cruce a otro mes.
  const weekStart = useMemo(() => weekStartOf(focusDate), [focusDate]);
  const weekCells = useMemo(() => daysInRange(weekStart, addDays(weekStart, 6)).map((date) => ({ date })), [weekStart]);

  // Días visibles en el heatmap de Asistencia según granularidad — los de
  // Semana/Día que caen fuera del mes actual no tienen datos (el fetch del
  // servidor es por mes), así que se recortan a los que sí están dentro.
  const attendanceDays = useMemo(() => {
    if (granularity === "Día") return days.filter((d) => d.date === focusDate);
    if (granularity === "Semana") {
      const weekDates = new Set(weekCells.map((c) => c.date));
      return days.filter((d) => weekDates.has(d.date));
    }
    // Mes/Agenda/Año: el heatmap de Asistencia solo existe por mes — Agenda
    // y Año son vistas del motor genérico, no tienen equivalente propio ahí.
    return days;
  }, [granularity, days, focusDate, weekCells]);

  /** Navega Prev/Hoy/Next respetando la granularidad — si la nueva fecha cae
      en otro mes, recarga la página con ?m=&d= (el fetch del server es por
      mes); si sigue en el mismo mes, solo mueve el estado local. */
  const shiftFocus = (dir: 1 | -1) => {
    const delta = granularity === "Día" ? 1 : 7;
    const newDate = addDays(focusDate, dir * delta);
    const newYm = newDate.slice(0, 7);
    if (newYm !== ym) router.push(`/admin/calendario?m=${newYm}&d=${newDate}`);
    else setFocusDate(newDate);
  };
  const goToday = () => {
    const newYm = today.slice(0, 7);
    if (newYm !== ym) router.push(`/admin/calendario?m=${newYm}&d=${today}`);
    else setFocusDate(today);
  };
  /** Navegación de la vista Año — mueve el mes en pantalla ±12 (mismo año
      completo ya viene cargado del server, ver page.tsx §yearRange). */
  const shiftYear = (dir: 1 | -1) => router.push(`/admin/calendario?m=${shiftMonth(ym, dir * 12)}`);
  /** Salta a un día concreto (desde Semana/Año/Agenda) y cambia a vista Día. */
  const goToDate = (date: string) => {
    setGranularity("Día");
    const newYm = date.slice(0, 7);
    if (newYm !== ym) router.push(`/admin/calendario?m=${newYm}&d=${date}`);
    else setFocusDate(date);
  };
  /** Salta a un mes concreto (desde Año) y cambia a vista Mes. */
  const goToMonth = (newYm: string) => {
    setGranularity("Mes");
    if (newYm !== ym) router.push(`/admin/calendario?m=${newYm}`);
  };

  type Cell = { kind: "fichaje" | "vacacion" | "inhabil" | "sin" | "off" | "futuro"; tip: string };
  const grid = useMemo(() => team.map((u) => {
    const cells: Cell[] = attendanceDays.map((d) => {
      const onVac = vacations.some((v) => v.user_id === u.id && v.start_date <= d.date && v.end_date >= d.date);
      if (onVac) return { kind: "vacacion", tip: `${dmy(d.date)} · Vacaciones` };
      if (d.holiday) return { kind: "inhabil", tip: `${dmy(d.date)} · ${d.holiday}` };
      if (d.isWeekend) return { kind: "off", tip: `${dmy(d.date)} · Fin de semana` };
      if (attSet.has(`${u.id}|${d.date}`)) return { kind: "fichaje", tip: `${dmy(d.date)} · Con registro` };
      if (d.date > today) return { kind: "futuro", tip: dmy(d.date) };
      return { kind: "sin", tip: `${dmy(d.date)} · Sin registro (informativo)` };
    });
    const habiles = cells.filter((c) => c.kind === "fichaje" || c.kind === "sin").length;
    const conRegistro = cells.filter((c) => c.kind === "fichaje").length;
    return { user: u, cells, habiles, conRegistro };
  }), [team, attendanceDays, vacations, attSet, today]);

  const CELL: Record<Cell["kind"], { bg: string; border?: string }> = {
    fichaje:  { bg: "linear-gradient(155deg,#34D058,#2FB344)" },
    vacacion: { bg: "linear-gradient(155deg,#A78BFA,#8E5CF7)" },
    inhabil:  { bg: "var(--accent-tint)", border: "1px solid var(--accent)" },
    sin:      { bg: "var(--warn-tint)", border: "1px dashed var(--warn)" },
    off:      { bg: "var(--surface-2)" },
    futuro:   { bg: "transparent", border: "1px dashed var(--border)" },
  };

  // (deadlinesByDate/vacationsByDate/instByDate/gcalByDate del render viejo
  // de Semana/Día se retiraron — Fase B migra esas dos vistas al motor
  // genérico, que ya recibe TODO normalizado en `events` más abajo.)

  // ── Calendar Engine (EMET-CALENDAR-ENGINE.md §3.2): TODAS las fuentes se
  //    normalizan a CalendarEvent[] ANTES de entrar al motor. La vista Mes
  //    usa MonthView (puntos indicadores + "+n" + DayPopover). Semana/Día y
  //    el heatmap de Asistencia conservan su render actual. ──
  const events = useMemo<CalendarEvent[]>(() => {
    const out: CalendarEvent[] = [];
    for (const p of deadlines) {
      if (p.status === "cancelada") continue;
      const lead = p.project_assignments.find((a) => a.is_lead) ?? p.project_assignments[0];
      out.push({
        id: `act-${p.id}`, kind: "actividad",
        title: p.requests?.title ?? "Actividad",
        start: p.deadline, end: p.deadline, allDay: true,
        user: lead?.users ? { id: "", display_name: lead.users.display_name, nexus_color: lead.users.nexus_color } : undefined,
        source: "db",
      });
    }
    for (const v of vacations) {
      const u = team.find((t) => t.id === v.user_id);
      out.push({
        id: `vac-${v.user_id}-${v.start_date}`, kind: "vacacion",
        title: u?.display_name ?? "Vacaciones",
        start: v.start_date, end: v.end_date, allDay: true,
        user: u ? { id: u.id, display_name: u.display_name, nexus_color: u.nexus_color, avatar_url: u.avatar_url } : undefined,
        source: "db",
      });
    }
    for (const ev of institutionalEvents ?? []) {
      out.push({
        id: `inst-${ev.id}`, kind: "evento_institucional",
        title: ev.title, start: ev.start_date, end: ev.end_date, allDay: true,
        source: "db", meta: { institutionalId: ev.id },
      });
    }
    for (const ev of gcalEvents ?? []) {
      out.push({
        id: `g-${ev.id}`, kind: "google",
        title: ev.title,
        start: ev.start,
        end: ev.allDay && ev.end.length === 10 ? addDays(ev.end, -1) : ev.end, // Google: "end" exclusivo en todo el día
        allDay: ev.allDay,
        source: "google",
      });
    }
    for (const h of holidays) {
      out.push({ id: `hol-${h.date}`, kind: "inhabil", title: h.name, start: h.date, end: h.date, allDay: true, source: "db" });
    }
    return out;
  }, [deadlines, vacations, team, institutionalEvents, gcalEvents, holidays]);

  const layers = useMemo<CalendarLayer[]>(() => [
    { key: "actividad", label: "Actividades", color: "var(--ev-blue)", active: true },
    { key: "vacacion", label: "Vacaciones", color: "var(--ev-purple)", active: true },
    { key: "evento_institucional", label: "Institucional", color: "var(--ev-blue)", active: true },
    { key: "google", label: "Google Calendar", color: "var(--ev-blue)", active: true },
    { key: "inhabil", label: "Días inhábiles", color: "var(--ev-gray)", active: true },
  ], []);

  // La leyenda refleja el color que PINTAN los puntos (la paleta agrupa
  // actividad/institucional/google en el azul de "trabajo").
  const legendItems = [
    { color: "var(--ev-blue)", label: "Actividades · Institucional · Google" },
    { color: "var(--ev-purple)", label: "Vacaciones" },
    { color: "var(--ev-gray)", label: "Días inhábiles" },
  ];

  const handleEventClick = (ev: CalendarEvent) => {
    if (ev.kind !== "evento_institucional") return;
    const inst = (institutionalEvents ?? []).find((i) => i.id === ev.meta?.institutionalId);
    if (!inst) return;

    // Si el evento es de hoy y está confirmado, abrir sheet de check-in
    const isToday = inst.start_date <= today && inst.end_date >= today;
    if (isToday && inst.status === "confirmado") {
      openCheckinSheet(inst);
    } else {
      openEditEvent(inst);
    }
  };

  // Fondo morado suave en días donde alguien está de vacaciones (paridad con
  // el render anterior; los puntos del motor aportan el detalle).
  const cellTint = (date: string) =>
    vacations.some((v) => v.start_date <= date && v.end_date >= date) ? "var(--purple-tint)" : undefined;

  const title = granularity === "Mes" ? `${MONTHS[month - 1]} ${year}`
    : granularity === "Semana" ? weekRangeLabel(weekCells)
    : granularity === "Día" ? dayLongLabel(focusDate)
    : granularity === "Año" ? `${year}`
    : "Agenda";

  return (
    <>
      <CalendarHeader
        title={title}
        subtitle="Calendario del equipo · asistencia, actividades y vacaciones"
        prevHref={granularity === "Mes" ? prevHref : undefined}
        nextHref={granularity === "Mes" ? nextHref : undefined}
        onPrev={granularity === "Mes" || granularity === "Agenda" ? undefined : granularity === "Año" ? () => shiftYear(-1) : () => shiftFocus(-1)}
        onNext={granularity === "Mes" || granularity === "Agenda" ? undefined : granularity === "Año" ? () => shiftYear(1) : () => shiftFocus(1)}
        todayHref={granularity === "Mes" ? "/admin/calendario" : undefined}
        onToday={granularity === "Mes" || granularity === "Agenda" ? undefined : goToday}
      >
        <SlidingSegments options={["Equipo", "Asistencia"]} value={view} onChange={(v) => setView(v as typeof view)} />
        <SlidingSegments options={[...GRANULARITIES]} value={granularity}
          onChange={(v) => setGranularity(v as Granularity)} />
        <button onClick={openAddEvent} className="btn-primary h-8 px-3.5 text-[12.5px] flex items-center gap-1.5">
          <Icon name="plus" size={13} /> Crear
        </button>
      </CalendarHeader>

      {efemerides && efemerides.length > 0 && (
        <div className="card px-4 py-2.5 mb-4 flex items-center gap-2 text-[12.5px]" style={{ color: "var(--text-2)" }}>
          <Icon name="calendar" size={14} aria-hidden />
          <span>Hoy también es: <strong>{efemerides.join(" · ")}</strong></span>
        </div>
      )}

      {gcalError && (
        <div className="card px-4 py-2.5 mb-4 flex items-center gap-2 text-[12.5px]"
          style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
          <Icon name="alert" size={14} aria-hidden />
          <span>No se pudieron cargar los eventos de Google Calendar — {gcalError}</span>
        </div>
      )}

      {view === "Asistencia" && (
        <div className="card p-5 overflow-x-auto">
          <div className={granularity === "Mes" ? "min-w-[720px]" : "min-w-0"}>
            <div className="flex items-center gap-3 pb-2" style={{ borderBottom: "0.5px solid var(--border)" }}>
              <div className="w-[150px] shrink-0" />
              <div className="flex-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${attendanceDays.length}, minmax(0,1fr))` }}>
                {attendanceDays.map((d) => (
                  <span key={d.n}
                    className="text-center text-[12px] font-bold tabular-nums"
                    style={{ color: d.date === today ? "var(--accent)" : d.isWeekend ? "var(--text-3)" : "var(--text-2)" }}>
                    {d.n}
                  </span>
                ))}
              </div>
              <div className="w-[70px] shrink-0" />
            </div>

            {grid.map(({ user: u, cells, habiles, conRegistro }) => (
              <div key={u.id} className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: "0.5px solid var(--border)" }}>
                <div className="flex items-center gap-2.5 w-[150px] shrink-0">
                  <Avatar name={u.display_name} color={u.nexus_color} size={28} avatarUrl={u.avatar_url} birthday={isBirthdayToday(u.birth_date, todayISO())} />
                  <p className="text-[12.5px] font-bold truncate">{u.display_name}</p>
                </div>
                <div className="flex-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${attendanceDays.length}, minmax(0,1fr))` }}>
                  {cells.map((c, i) => (
                    <div key={i} title={c.tip}
                      className="h-5 rounded-[4px]"
                      style={{
                        background: CELL[c.kind].bg,
                        border: CELL[c.kind].border,
                        outline: attendanceDays[i].date === today ? "2px solid var(--accent)" : undefined,
                        outlineOffset: attendanceDays[i].date === today ? "1px" : undefined,
                      }} />
                  ))}
                </div>
                <div className="w-[70px] shrink-0 text-right">
                  <p className="text-[12px] font-bold tabular-nums">{conRegistro}/{habiles}</p>
                  <p className="text-[12px]" style={{ color: "var(--text-3)" }}>días reg.</p>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.fichaje.bg }} /> Con registro
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.vacacion.bg }} /> Vacaciones
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.inhabil.bg, border: CELL.inhabil.border }} /> Día inhábil
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.sin.bg, border: CELL.sin.border }} /> Sin registro (informativo)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.off.bg }} /> Fin de semana
              </span>
            </div>
          </div>
        </div>
      )}

      {view === "Equipo" && (
        <CalendarEngine today={today} events={events} layers={layers}>
          <CalendarFilterBar />
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            <div className="flex-1 min-w-0 w-full">
              {granularity === "Mes" && (
                <>
                  <MonthView ym={ym} onEventClick={handleEventClick} cellTint={cellTint} />
                  <div className="mt-3.5">
                    <CalendarLegend items={legendItems} />
                  </div>
                </>
              )}
              {granularity === "Semana" && (
                <WeekView weekStart={weekStart} onDayClick={goToDate} onEventClick={handleEventClick} />
              )}
              {granularity === "Día" && (
                <DayView date={focusDate} onEventClick={handleEventClick} />
              )}
              {granularity === "Agenda" && (
                <AgendaView onDayClick={goToDate} onEventClick={handleEventClick} />
              )}
              {granularity === "Año" && (
                <YearView year={year} onMonthClick={goToMonth} onDayClick={goToDate} />
              )}
            </div>
            <CalendarRightPanel onEventClick={handleEventClick} />
          </div>
        </CalendarEngine>
      )}

      {monthHolidays.length > 0 && (
        <div className="card p-5 mt-4">
          <h2 className="text-[15px] font-bold mb-2.5">Días inhábiles de {MONTHS[month - 1]}</h2>
          <div className="flex flex-col gap-1.5">
            {monthHolidays.map((h) => {
              const st = holidayStyle(h.kind);
              return (
                <div key={h.date} className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: st.fg }} />
                    <span className="font-semibold">{h.name}</span>
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--text-3)" }}>{dmy(h.date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drawer: alta / edición de un evento institucional (FASE U + Fase 1). */}
      <Sheet
        open={eventSheetOpen} onClose={() => setEventSheetOpen(false)}
        title={editingEvent ? "Editar evento" : "Nuevo evento"}
        subtitle="Evento institucional con ubicación, participantes y seguimiento"
      >
        <div className="flex flex-col gap-3 pb-2">
          {/* Información general */}
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Información general</p>
          <Field label="Título">
            <input className="field-input" placeholder="Ej. Graduación Enfermería"
              value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo">
              <Select
                value={eventForm.kind} onChange={(v) => setEventForm({ ...eventForm, kind: v as InstitutionalKind })}
                title="Tipo de evento" searchable={false}
                options={(Object.keys(INSTITUTIONAL_KIND_LABEL) as InstitutionalKind[]).map((k) => ({ value: k, label: INSTITUTIONAL_KIND_LABEL[k] }))}
              />
            </Field>
            <Field label="Prioridad">
              <Select
                value={eventForm.priority} onChange={(v) => setEventForm({ ...eventForm, priority: v as "alta" | "media" | "baja" })}
                title="Prioridad" searchable={false}
                options={[
                  { value: "alta", label: "Alta" },
                  { value: "media", label: "Media" },
                  { value: "baja", label: "Baja" },
                ]}
              />
            </Field>
          </div>
          <Field label="Estado">
            <Select
              value={eventForm.status} onChange={(v) => setEventForm({ ...eventForm, status: v as "pendiente" | "confirmado" | "cancelado" })}
              title="Estado" searchable={false}
              options={[
                { value: "pendiente", label: "Pendiente" },
                { value: "confirmado", label: "Confirmado" },
                { value: "cancelado", label: "Cancelado" },
              ]}
            />
          </Field>

          {/* Fecha y hora */}
          <p className="text-[11px] font-bold uppercase tracking-wide mt-2" style={{ color: "var(--text-3)" }}>Fecha y hora</p>
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Rango de fechas</label>
            <DateRangeField start={eventForm.start} end={eventForm.end}
              onSelect={(s, e) => setEventForm({ ...eventForm, start: s, end: e ?? s })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Hora inicio (opcional)">
              <input type="time" className="field-input" value={eventForm.startTime}
                onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })} />
            </Field>
            <Field label="Hora fin (opcional)">
              <input type="time" className="field-input" value={eventForm.endTime}
                onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })} />
            </Field>
          </div>

          {/* Cliente y departamento */}
          <p className="text-[11px] font-bold uppercase tracking-wide mt-2" style={{ color: "var(--text-3)" }}>Cliente y departamento</p>
          <Field label="Cliente (opcional)">
            <input className="field-input" placeholder="Ej. Hospital Juárez"
              value={eventForm.clientName} onChange={(e) => setEventForm({ ...eventForm, clientName: e.target.value })} />
          </Field>
          <Field label="Departamento solicitante (opcional)">
            <input className="field-input" placeholder="Ej. Enfermería"
              value={eventForm.departmentId} onChange={(e) => setEventForm({ ...eventForm, departmentId: e.target.value })} />
          </Field>

          {/* Ubicación */}
          <p className="text-[11px] font-bold uppercase tracking-wide mt-2" style={{ color: "var(--text-3)" }}>Ubicación</p>
          <Field label="Tipo de ubicación">
            <Select
              value={eventForm.locationType} onChange={(v) => setEventForm({ ...eventForm, locationType: v as "interno" | "externo" })}
              title="Tipo de ubicación" searchable={false}
              options={[
                { value: "interno", label: "Dentro del CERT" },
                { value: "externo", label: "Externo" },
              ]}
            />
          </Field>
          {eventForm.locationType === "externo" && (
            <>
              <Field label="Nombre del lugar">
                <input className="field-input" placeholder="Ej. Hotel Fiesta Americana"
                  value={eventForm.locationName} onChange={(e) => setEventForm({ ...eventForm, locationName: e.target.value })} />
              </Field>
              <Field label="Dirección">
                <input className="field-input" placeholder="Ej. Av. Colon 420, Mérida"
                  value={eventForm.locationAddress} onChange={(e) => setEventForm({ ...eventForm, locationAddress: e.target.value })} />
              </Field>
              <Field label="Coordenadas GPS (lat,lng)">
                <input className="field-input" placeholder="Ej. 20.9839,-89.6169"
                  value={eventForm.locationCoords} onChange={(e) => setEventForm({ ...eventForm, locationCoords: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Radio (metros)">
                  <input type="number" className="field-input" value={eventForm.locationRadius}
                    onChange={(e) => setEventForm({ ...eventForm, locationRadius: Number(e.target.value) })} />
                </Field>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={eventForm.allowAnyLocation}
                      onChange={(e) => setEventForm({ ...eventForm, allowAnyLocation: e.target.checked })}
                      className="w-4 h-4 rounded" />
                    <span className="text-[12px]" style={{ color: "var(--text-2)" }}>Sin GPS</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Descripción */}
          <p className="text-[11px] font-bold uppercase tracking-wide mt-2" style={{ color: "var(--text-3)" }}>Descripción</p>
          <Field label="Notas (opcional)">
            <textarea className="field-input min-h-[60px] resize-none" placeholder="Contexto adicional…"
              value={eventForm.notes} onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })} />
          </Field>
          <Field label="Descripción detallada (opcional)">
            <textarea className="field-input min-h-[80px] resize-none" placeholder="Detalles del evento…"
              value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} />
          </Field>

          {/* Sincronización con Google Calendar (Fase 3) */}
          <p className="text-[11px] font-bold uppercase tracking-wide mt-2" style={{ color: "var(--text-3)" }}>Google Calendar</p>
          <div className="rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={eventForm.syncToGoogle}
                onChange={(e) => setEventForm({ ...eventForm, syncToGoogle: e.target.checked })}
                className="w-4 h-4 rounded mt-0.5"
              />
              <div className="flex-1">
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>
                  Sincronizar con Google Calendar
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                  El evento se creará/actualizará automáticamente en Google Calendar
                </p>
              </div>
            </label>
            {eventForm.syncToGoogle && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <Field label="ID del calendario (opcional)">
                  <input
                    className="field-input"
                    placeholder="primary"
                    value={eventForm.googleCalendarId}
                    onChange={(e) => setEventForm({ ...eventForm, googleCalendarId: e.target.value })}
                  />
                </Field>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
                  Deja vacío para usar tu calendario principal
                </p>
              </div>
            )}
          </div>

          {/* Botones */}
          {editingEvent && confirmDeleteEvent ? (
            <div className="flex items-center gap-2 rounded-sm px-3.5 py-2.5" style={{ background: "var(--danger-tint)" }}>
              <span className="text-[12.5px] font-semibold flex-1" style={{ color: "var(--danger)" }}>¿Eliminar este evento?</span>
              <button className="text-[12px] font-semibold px-2.5 py-1 rounded-full" disabled={deletingEvent}
                style={{ background: "var(--danger)", color: "#fff" }} onClick={deleteEvent}>Sí, eliminar</button>
              <button className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "var(--surface-2)", color: "var(--text-2)" }} onClick={() => setConfirmDeleteEvent(false)}>No</button>
            </div>
          ) : (
            <div className="flex gap-2.5 mt-1">
              {editingEvent && (
                <button className="btn-secondary px-3.5 py-3 text-[14px]" onClick={() => setConfirmDeleteEvent(true)}>
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
              )}
              <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setEventSheetOpen(false)}>Cancelar</button>
              <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={savingEvent} onClick={saveEvent}>
                {savingEvent ? "Guardando…" : "Guardar"}
              </button>
            </div>
          )}
        </div>
      </Sheet>

      {/* Sheet: Check-in/out de evento (Fase 2) */}
      <Sheet
        open={checkinSheetOpen}
        onClose={() => setCheckinSheetOpen(false)}
        title="Cobertura de evento"
        subtitle={checkinEvent?.title ?? ""}
      >
        <div className="flex flex-col gap-4 pb-2">
          {/* Información del evento */}
          <div className="rounded-lg p-4" style={{ background: "var(--surface-2)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-[14px] font-bold">{checkinEvent?.title}</p>
                <p className="text-[12px] mt-1" style={{ color: "var(--text-2)" }}>
                  {checkinEvent?.start_date === checkinEvent?.end_date
                    ? dmy(checkinEvent?.start_date ?? "")
                    : `${dmy(checkinEvent?.start_date ?? "")} → ${dmy(checkinEvent?.end_date ?? "")}`}
                  {checkinEvent?.start_time && ` · ${checkinEvent.start_time.slice(0, 5)}`}
                  {checkinEvent?.end_time && ` → ${checkinEvent.end_time.slice(0, 5)}`}
                </p>
                {checkinEvent?.location_type === "externo" && checkinEvent?.location_name && (
                  <p className="text-[12px] mt-1" style={{ color: "var(--text-3)" }}>
                    📍 {checkinEvent.location_name}
                    {checkinEvent.location_address && ` · ${checkinEvent.location_address}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setCheckinSheetOpen(false);
                  if (checkinEvent) openEditEvent(checkinEvent);
                }}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
                style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
              >
                Editar
              </button>
            </div>
          </div>

          {/* Estado de cobertura */}
          {checkinStatus ? (
            <>
              {checkinStatus.is_participant ? (
                <div className="rounded-lg p-4" style={{ background: "var(--surface-2)" }}>
                  <p className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>
                    Tu cobertura
                  </p>
                  {checkinStatus.coverage_status === "not_checked_in" && (
                    <>
                      <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
                        No has iniciado cobertura
                      </p>
                      {gpsError && (
                        <p className="text-[12px] mt-2" style={{ color: "var(--warn)" }}>
                          ⚠ {gpsError}
                        </p>
                      )}
                      {gpsCoords && (
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
                          GPS: {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
                        </p>
                      )}
                    </>
                  )}
                  {checkinStatus.coverage_status === "in_coverage" && (
                    <>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--ok)" }}>
                        ✓ En cobertura
                      </p>
                      <p className="text-[12px] mt-1" style={{ color: "var(--text-2)" }}>
                        Inicio: {checkinStatus.check_in_at ? new Date(checkinStatus.check_in_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </p>
                      {checkinStatus.duration_min !== undefined && (
                        <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                          Duración: {Math.floor(checkinStatus.duration_min / 60)}h {checkinStatus.duration_min % 60}m
                        </p>
                      )}
                    </>
                  )}
                  {checkinStatus.coverage_status === "coverage_completed" && (
                    <>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
                        ✓ Cobertura completada
                      </p>
                      <p className="text-[12px] mt-1" style={{ color: "var(--text-2)" }}>
                        Inicio: {checkinStatus.check_in_at ? new Date(checkinStatus.check_in_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </p>
                      <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                        Fin: {checkinStatus.check_out_at ? new Date(checkinStatus.check_out_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </p>
                      {checkinStatus.duration_min !== undefined && (
                        <p className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                          Duración total: {Math.floor(checkinStatus.duration_min / 60)}h {checkinStatus.duration_min % 60}m
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-lg p-4" style={{ background: "var(--warn-tint)" }}>
                  <p className="text-[13px]" style={{ color: "var(--warn)" }}>
                    No estás asignado como participante de este evento
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2">
                {checkinStatus.is_participant && checkinStatus.coverage_status === "not_checked_in" && (
                  <button
                    onClick={handleCheckIn}
                    disabled={checkinLoading}
                    className="btn-primary flex-1 py-3 text-[14px] font-semibold"
                  >
                    {checkinLoading ? "Registrando…" : "Iniciar cobertura"}
                  </button>
                )}
                {checkinStatus.is_participant && checkinStatus.coverage_status === "in_coverage" && (
                  <button
                    onClick={handleCheckOut}
                    disabled={checkinLoading}
                    className="flex-1 py-3 text-[14px] font-semibold rounded-lg"
                    style={{ background: "var(--warn)", color: "#fff" }}
                  >
                    {checkinLoading ? "Registrando…" : "Finalizar cobertura"}
                  </button>
                )}
                <button
                  onClick={() => setCheckinSheetOpen(false)}
                  className="btn-secondary flex-1 py-3 text-[14px]"
                >
                  Cerrar
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-[13px]" style={{ color: "var(--text-3)" }}>
                Cargando estado…
              </p>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
