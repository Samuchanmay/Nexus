"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TimePicker } from "@/components/select";
import { useToast } from "@/components/ui";
import { Button, Field } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { scheduleFor } from "@/lib/hours";
import { logAdminAction } from "@/lib/admin-log";
import type { Schedule, AttendanceReason } from "@/lib/types";

interface EditAttendanceSheetProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  date: string;
  firstIn: string | null;
  lastOut: string | null;
  adminId: string;
  onSuccess: () => void;
}

// FASE 9 (auditoría 4 ago 2026): catálogo COMPLETO de movimientos — antes
// este Sheet solo corregía entrada/salida del día; los movimientos
// intermedios (comida, diligencia, cita médica, permiso, pendientes) que el
// checador normal SÍ genera no se podían agregar ni corregir a mano. Estos
// 12 valores son EXACTAMENTE los que valida attendance.reason (check
// constraint) y la Edge Function `fichar` — nunca se inventan valores aquí.
const REASON_CATALOG: { reason: AttendanceReason; type: "Entrada" | "Salida"; label: string }[] = [
  { reason: "Entrada a trabajo", type: "Entrada", label: "Entrada a trabajo" },
  { reason: "Regreso de comida", type: "Entrada", label: "Regreso de comida" },
  { reason: "Regreso de diligencia", type: "Entrada", label: "Regreso de diligencia" },
  { reason: "Regreso de cita médica", type: "Entrada", label: "Regreso de cita médica" },
  { reason: "Regreso de permiso", type: "Entrada", label: "Regreso de permiso" },
  { reason: "Regreso de pendientes", type: "Entrada", label: "Regreso de pendientes" },
  { reason: "Salida a comer", type: "Salida", label: "Salida a comer" },
  { reason: "Salida a pendientes", type: "Salida", label: "Salida a pendientes" },
  { reason: "Salida a diligencia", type: "Salida", label: "Salida a diligencia" },
  { reason: "Salida a permiso", type: "Salida", label: "Salida a permiso" },
  { reason: "Salida a cita médica", type: "Salida", label: "Salida a cita médica" },
  { reason: "Fin de jornada", type: "Salida", label: "Fin de jornada" },
];
const REASON_LABEL_OF = new Map(REASON_CATALOG.map((r) => [r.reason, r.label]));
const TYPE_OF_REASON = new Map(REASON_CATALOG.map((r) => [r.reason, r.type]));

/** Un movimiento en edición dentro del Sheet — id null = todavía no existe
    en `attendance` (se va a insertar); _original = hora con la que llegó
    del servidor (para saber si cambió y armar el detalle del historial). */
interface EditableMovement {
  key: string;              // key estable para React — id real o uuid temporal
  id: string | null;
  reason: AttendanceReason;
  type: "Entrada" | "Salida";
  time: string;              // "HH:MM"
  original: string | null;   // null si es nuevo
  deleted: boolean;
}

let tempKeySeq = 0;
function tempKey() { return `nuevo-${++tempKeySeq}-${Date.now()}`; }

export function EditAttendanceSheet({
  // firstIn/lastOut ya no se usan aquí (FASE 9: el Sheet carga TODOS los
  // movimientos del día directo de `attendance`, no solo entrada/salida) —
  // se mantienen en la interfaz para no romper al caller, que sigue
  // calculándolos para otras partes de la pantalla.
  open, onClose, userId, userName, date, adminId, onSuccess,
}: EditAttendanceSheetProps) {
  const toast = useToast();
  const [movements, setMovements] = useState<EditableMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [addReason, setAddReason] = useState<AttendanceReason>("Entrada a trabajo");
  const [addTime, setAddTime] = useState("08:00");
  // Confirmación explícita al cruzar AM/PM (auditoría 4 ago 2026, FASE 1) —
  // se aplica solo a movimientos EXISTENTES cuya hora cambió de periodo del
  // día, porque ese es el caso real de "seleccioné el AM/PM equivocado".
  const [confirmAmPm, setConfirmAmPm] = useState(false);

  // Carga TODOS los movimientos del día (no solo entrada/salida) al abrir.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const [{ data: rows }, { data: scheds }] = await Promise.all([
        supabase.from("attendance").select("id, type, reason, time")
          .eq("user_id", userId).eq("date", date).order("time", { ascending: true }),
        supabase.from("schedules")
          .select("id, user_id, start_time, end_time, target_min, tolerance_min, valid_from, valid_until")
          .eq("user_id", userId),
      ]);
      if (!active) return;
      const list: EditableMovement[] = (rows ?? []).map((r) => ({
        key: r.id, id: r.id, reason: r.reason as AttendanceReason,
        type: r.type as "Entrada" | "Salida", time: (r.time as string).slice(0, 5),
        original: (r.time as string).slice(0, 5), deleted: false,
      }));
      setMovements(list);
      // FASE 2 (auditoría 4 ago 2026): sugerir hora inicial del "agregar
      // movimiento" según el horario laboral vigente, si todavía no hay
      // ninguna entrada registrada ese día.
      const effective = scheduleFor((scheds ?? []) as Schedule[], userId, date);
      if (effective && list.length === 0) setAddTime(effective.start_time.slice(0, 5));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [open, userId, date]);

  const visibles = movements.filter((m) => !m.deleted).sort((a, b) => a.time.localeCompare(b.time));
  const entradas = visibles.filter((m) => m.type === "Entrada").map((m) => timeToMin(m.time));
  const salidas = visibles.filter((m) => m.type === "Salida").map((m) => timeToMin(m.time));
  const primeraEntrada = entradas.length ? Math.min(...entradas) : null;
  const ultimaSalida = salidas.length ? Math.max(...salidas) : null;
  const duracionMin = primeraEntrada !== null && ultimaSalida !== null ? ultimaSalida - primeraEntrada : null;
  const esSalidaAntesEntrada = duracionMin !== null && duracionMin < 0;
  const esJornadaMuyLarga = duracionMin !== null && duracionMin > 16 * 60;
  const motivoVacio = motivo.trim().length === 0;

  // ¿Algún movimiento EXISTENTE (no nuevo, no borrado) cambió de AM/PM?
  const cruces = movements.filter((m) => !m.deleted && m.original && cruzaAmPm(m.original, m.time));
  const cambioDePeriodo = cruces.length > 0;

  const hayCambios = movements.some((m) =>
    (m.id === null && !m.deleted) || (m.id !== null && m.deleted) || (m.id !== null && !m.deleted && m.original !== m.time));

  const canSave = !esSalidaAntesEntrada && !esJornadaMuyLarga && !motivoVacio
    && (!cambioDePeriodo || confirmAmPm) && hayCambios;

  function updateTime(key: string, time: string) {
    setMovements((prev) => prev.map((m) => (m.key === key ? { ...m, time } : m)));
    setConfirmAmPm(false);
  }
  function toggleDelete(key: string) {
    setMovements((prev) => prev.map((m) => (m.key === key ? { ...m, deleted: !m.deleted } : m)));
  }
  function agregarMovimiento() {
    const type = TYPE_OF_REASON.get(addReason)!;
    setMovements((prev) => [...prev, { key: tempKey(), id: null, reason: addReason, type, time: addTime, original: null, deleted: false }]);
  }

  const guardar = async () => {
    setAttempted(true);
    if (!canSave) {
      toast(motivoVacio ? "Escribe el motivo de la corrección" : "Corrige los errores antes de guardar", "danger");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const cambios: string[] = [];

    try {
      for (const m of movements) {
        const label = REASON_LABEL_OF.get(m.reason) ?? m.reason;
        if (m.id === null && !m.deleted) {
          // Movimiento nuevo — insertar. source='admin_correccion' + created_by
          // (FASE 9, auditoría 4 ago 2026): a diferencia de un fichaje real, este
          // registro queda marcado en su propia fila como corrección de admin,
          // no solo en la bitácora aparte attendance_corrections.
          const { error } = await supabase.from("attendance").insert({
            user_id: userId, date, type: m.type, reason: m.reason, time: timeCol(m.time),
            distance_m: null, source: "admin_correccion", created_by: adminId,
          });
          if (error) throw error;
          cambios.push(`Agregó ${label}: ${m.time}`);
        } else if (m.id !== null && m.deleted) {
          const { error } = await supabase.from("attendance").delete().eq("id", m.id);
          if (error) throw error;
          cambios.push(`Eliminó ${label} (${m.original})`);
        } else if (m.id !== null && !m.deleted && m.original !== m.time) {
          const { error } = await supabase.from("attendance").update({ time: timeCol(m.time) }).eq("id", m.id);
          if (error) throw error;
          cambios.push(`${label}: ${m.original} → ${m.time}`);
        }
      }

      if (cambios.length > 0) {
        const { error: errHistorial } = await supabase.from("attendance_corrections").insert({
          user_id: userId, date, admin_id: adminId,
          action: cambios.length === 1 ? cambios[0] : `Editó ${cambios.length} movimientos`,
          details: `${cambios.join(". ")}. Motivo: ${motivo.trim()}`,
        });
        if (errHistorial) throw errHistorial;
        logAdminAction(supabase, adminId, "Corrigió asistencia", `${userName} · ${date} · ${cambios.join(", ")}`);
      }

      toast(cambios.length > 0 ? "Asistencia corregida" : "Sin cambios");
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[attendance-correction] No se pudo guardar:", err);
      toast(`No se pudo guardar: ${message}`, "danger");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }}>
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[16px] font-bold">Corregir asistencia</p>
            <p className="text-[13.5px] mt-0.5" style={{ color: "var(--text-2)" }}>{userName} · {date}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full grid place-items-center hover:bg-surface-3"
            style={{ color: "var(--text-3)" }}
            aria-label="Cerrar"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {loading ? (
          <p className="text-[13.5px] py-6 text-center" style={{ color: "var(--text-3)" }}>Cargando movimientos…</p>
        ) : (
          <div className="space-y-4">
            {/* Lista de movimientos del día — FASE 9: ya no solo entrada/salida. */}
            <div>
              <p className="text-[12.5px] font-semibold mb-2" style={{ color: "var(--text-3)" }}>
                Movimientos del día
              </p>
              {visibles.length === 0 && (
                <p className="text-[13px] mb-2" style={{ color: "var(--text-3)" }}>Sin movimientos registrados.</p>
              )}
              <div className="space-y-2">
                {movements.filter((m) => !m.deleted).map((m) => (
                  <div key={m.key} className="flex items-center gap-2 rounded-m p-2" style={{ background: "var(--surface-2)" }}>
                    <Icon name={m.type === "Entrada" ? "login" : "logout"} size={14} className="shrink-0" style={{ color: "var(--text-3)" }} />
                    <span className="text-[13px] font-medium flex-1">{REASON_LABEL_OF.get(m.reason) ?? m.reason}</span>
                    <TimePicker value={m.time} onChange={(v) => updateTime(m.key, v)} />
                    <button type="button" onClick={() => toggleDelete(m.key)} aria-label="Eliminar movimiento"
                      className="h-7 w-7 rounded-full grid place-items-center hover:bg-surface-3 shrink-0" style={{ color: "var(--danger)" }}>
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Agregar movimiento — cualquiera de los 12 tipos del catálogo. */}
            <div className="rounded-m p-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-[12.5px] font-semibold mb-2" style={{ color: "var(--text-3)" }}>Agregar movimiento</p>
              <div className="flex items-center gap-2">
                <select
                  className="field-input flex-1"
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value as AttendanceReason)}
                >
                  {REASON_CATALOG.map((r) => (
                    <option key={r.reason} value={r.reason}>{r.label}</option>
                  ))}
                </select>
                <TimePicker value={addTime} onChange={setAddTime} />
                <button type="button" onClick={agregarMovimiento}
                  className="px-3 h-9 rounded-m text-[13px] font-semibold shrink-0"
                  style={{ background: "var(--accent)", color: "#fff" }}>
                  Agregar
                </button>
              </div>
            </div>

            <Field label="Motivo">
              <input
                type="text"
                className="field-input w-full"
                placeholder="Ej: Olvidó registrar, Error de sistema"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                style={attempted && motivoVacio ? { borderColor: "var(--danger)" } : undefined}
              />
              {attempted && motivoVacio && (
                <p className="text-[12px] mt-1" style={{ color: "var(--danger)" }}>
                  El motivo es obligatorio — queda en el historial de auditoría.
                </p>
              )}
            </Field>

            {cambioDePeriodo && (
              <div className="rounded-m p-3 flex items-start gap-2" style={{ background: "var(--warn-tint)" }}>
                <Icon name="alert" size={16} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
                <div className="flex-1">
                  <p className="text-[13.5px] font-semibold" style={{ color: "var(--warn)" }}>
                    Vas a cambiar el periodo del día (AM/PM)
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                    {cruces.map((m) => `${REASON_LABEL_OF.get(m.reason)}: ${m.original} → ${m.time}`).join(" · ")}
                    {" "}¿Seguro que no era un error de AM/PM?
                  </p>
                  {!confirmAmPm && (
                    <button
                      type="button"
                      onClick={() => setConfirmAmPm(true)}
                      className="text-[12.5px] font-semibold mt-2 underline"
                      style={{ color: "var(--warn)" }}
                    >
                      Sí, es correcto — continuar
                    </button>
                  )}
                </div>
              </div>
            )}

            {duracionMin !== null && duracionMin > 0 && (
              <div className="rounded-m p-3" style={{ background: "var(--surface-2)" }}>
                <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
                  Total del día (primera entrada → última salida)
                </p>
                <p className="text-[19px] font-bold tabular-nums mt-1" style={{ color: "var(--text-1)" }}>
                  {Math.floor(duracionMin / 60)}h {duracionMin % 60}m
                </p>
              </div>
            )}

            {esSalidaAntesEntrada && (
              <div className="rounded-m p-3 flex items-start gap-2" style={{ background: "var(--danger-tint)" }}>
                <Icon name="alert" size={16} className="shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
                <div>
                  <p className="text-[13.5px] font-semibold" style={{ color: "var(--danger)" }}>
                    La última salida es anterior a la primera entrada
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                    Ajusta las horas para que la jornada tenga sentido.
                  </p>
                </div>
              </div>
            )}

            {esJornadaMuyLarga && (
              <div className="rounded-m p-3 flex items-start gap-2" style={{ background: "var(--warn-tint)" }}>
                <Icon name="alert" size={16} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
                <div>
                  <p className="text-[13.5px] font-semibold" style={{ color: "var(--warn)" }}>
                    Jornada mayor a 16 horas
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                    Verifica que las horas sean correctas.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <Button variant="primary" onClick={guardar} disabled={saving || loading || !canSave} className="flex-1">
            {saving ? "Guardando…" : "Guardar corrección"}
          </Button>
          <Button variant="subtle" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Normaliza "HH:MM" o "HH:MM:SS" al literal `time` de Postgres ("HH:MM:SS").
    Evita el doble `:00` si el valor llega con segundos desde la BD. */
function timeCol(t: string): string {
  const [h, m] = t.split(":");
  return `${h}:${m ?? "00"}:00`;
}

/** ¿El nuevo valor cae en el otro periodo del día (AM/PM) respecto al
    original? 12:00-23:59 = PM, 00:00-11:59 = AM. */
function cruzaAmPm(original: string, next: string): boolean {
  const origHour = Number(original.split(":")[0]);
  const nextHour = Number(next.split(":")[0]);
  if (Number.isNaN(origHour) || Number.isNaN(nextHour)) return false;
  return (origHour >= 12) !== (nextHour >= 12);
}
