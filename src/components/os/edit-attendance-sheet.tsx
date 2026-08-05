"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TimePicker } from "@/components/select";
import { useToast } from "@/components/ui";
import { Button, Field } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { fmtTime, scheduleFor } from "@/lib/hours";
import { logAdminAction } from "@/lib/admin-log";
import type { Schedule } from "@/lib/types";

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

export function EditAttendanceSheet({
  open, onClose, userId, userName, date, firstIn, lastOut, adminId, onSuccess,
}: EditAttendanceSheetProps) {
  const toast = useToast();
  const [entrada, setEntradaRaw] = useState(firstIn ?? "08:00");
  const [salida, setSalidaRaw] = useState(lastOut ?? "17:00");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  // Confirmación explícita al cruzar AM/PM (auditoría 4 ago 2026, FASE 1):
  // cambiar solo la hora (8 → 9) no la pide; cambiar el periodo del día
  // (AM → PM) sí, porque modifica la jornada completa — se resetea en
  // cuanto la persona vuelve a tocar el picker, para no dejar "colada" una
  // confirmación vieja si sigue ajustando la hora después.
  const [confirmAmPm, setConfirmAmPm] = useState(false);
  const setEntrada = (v: string) => { setEntradaRaw(v); setConfirmAmPm(false); };
  const setSalida = (v: string) => { setSalidaRaw(v); setConfirmAmPm(false); };

  // FASE 2 (auditoría 4 ago 2026): sugerir la hora inicial según el horario
  // laboral vigente de la persona ese día, en vez del "08:00"/"17:00" fijo —
  // solo cuando se está AGREGANDO el movimiento (no toca una hora ya
  // registrada que el admin esté corrigiendo).
  useEffect(() => {
    let active = true;
    createClient()
      .from("schedules")
      .select("id, user_id, start_time, end_time, target_min, tolerance_min, valid_from, valid_until")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!active || !data) return;
        const effective = scheduleFor(data as Schedule[], userId, date);
        if (!effective) return;
        if (!firstIn) setEntradaRaw(effective.start_time.slice(0, 5));
        if (!lastOut) setSalidaRaw(effective.end_time.slice(0, 5));
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, date]);

  // Validaciones inteligentes
  const entradaMin = timeToMin(entrada);
  const salidaMin = timeToMin(salida);
  const duracionMin = salidaMin - entradaMin;
  const esSalidaAntesEntrada = salidaMin < entradaMin;
  const esJornadaMuyLarga = duracionMin > 16 * 60; // >16 horas
  const esJornadaMuyCorta = duracionMin > 0 && duracionMin < 15; // <15 minutos
  const entradaCambioPeriodo = !!firstIn && cruzaAmPm(firstIn, entrada);
  const salidaCambioPeriodo = !!lastOut && cruzaAmPm(lastOut, salida);
  const cambioDePeriodo = entradaCambioPeriodo || salidaCambioPeriodo;
  const motivoVacio = motivo.trim().length === 0;

  const canSave = !esSalidaAntesEntrada && !esJornadaMuyLarga && !esJornadaMuyCorta && duracionMin > 0
    && !motivoVacio && (!cambioDePeriodo || confirmAmPm);

  const guardar = async () => {
    setAttempted(true);
    if (!canSave) {
      toast(motivoVacio ? "Escribe el motivo de la corrección" : "Corrige los errores antes de guardar", "danger");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    console.log("[attendance-correction] ANTES payload:", { userId, date, firstIn, lastOut, entrada, salida, motivo });

    try {
      const cambios: string[] = [];

      // 1. Actualizar o insertar entrada
      if (firstIn) {
        // Ya existe entrada — actualizar si cambió
        if (entrada !== firstIn) {
          const { error } = await supabase
            .from("attendance")
            .update({ time: timeCol(entrada) })
            .eq("user_id", userId)
            .eq("date", date)
            .eq("type", "Entrada")
            .eq("reason", "Entrada a trabajo");
          if (error) throw error;
          cambios.push(`Entrada: ${firstIn} → ${entrada}`);
        }
      } else {
        // No existe entrada — insertar
        const { error } = await supabase.from("attendance").insert({
          user_id: userId,
          date,
          type: "Entrada",
          reason: "Entrada a trabajo",
          time: timeCol(entrada),
          distance_m: null,
        });
        if (error) throw error;
        cambios.push(`Agregó entrada: ${entrada}`);
      }

      // 2. Actualizar o insertar salida
      if (lastOut) {
        // Ya existe salida — actualizar si cambió
        if (salida !== lastOut) {
          const { error } = await supabase
            .from("attendance")
            .update({ time: timeCol(salida) })
            .eq("user_id", userId)
            .eq("date", date)
            .eq("type", "Salida")
            .eq("reason", "Fin de jornada");
          if (error) throw error;
          cambios.push(`Salida: ${lastOut} → ${salida}`);
        }
      } else {
        // No existe salida — insertar
        const { error } = await supabase.from("attendance").insert({
          user_id: userId,
          date,
          type: "Salida",
          reason: "Fin de jornada",
          time: timeCol(salida),
          distance_m: null,
        });
        if (error) throw error;
        cambios.push(`Agregó salida: ${salida}`);
      }

      // 3. Registrar en historial de correcciones (si hubo cambios)
      if (cambios.length > 0) {
        const { error: errHistorial } = await supabase.from("attendance_corrections").insert({
          user_id: userId,
          date,
          admin_id: adminId,
          action: cambios.length === 1 ? cambios[0] : "Editó entrada y salida",
          details: `${cambios.join(". ")}. Motivo: ${motivo.trim()}`,
        });
        if (errHistorial) throw errHistorial;

        // 4. Log de admin
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
      <div className="card p-6 w-full max-w-md">
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

        <div className="space-y-4">
          <Field label="Hora de entrada">
            {/* No puede quedar después de la salida del mismo día (FASE 2). */}
            <TimePicker value={entrada} onChange={setEntrada} maxTime={salida || undefined} />
          </Field>

          <Field label="Hora de salida">
            {/* No puede quedar antes de la entrada del mismo día (FASE 2). */}
            <TimePicker value={salida} onChange={setSalida} minTime={entrada || undefined} />
          </Field>

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
                  {entradaCambioPeriodo && lastOut && salidaCambioPeriodo
                    ? "La entrada y la salida cambian de mañana a tarde (o viceversa) — esto modifica toda la jornada."
                    : entradaCambioPeriodo
                    ? `La entrada pasa de ${firstIn} a ${entrada} — distinto periodo del día.`
                    : `La salida pasa de ${lastOut} a ${salida} — distinto periodo del día.`}
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

          {/* Validaciones en tiempo real */}
          {duracionMin > 0 && (
            <div className="rounded-m p-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
                Total trabajado
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
                  La salida es anterior a la entrada
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                  Ajusta las horas para que la salida sea después de la entrada.
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

          {esJornadaMuyCorta && (
            <div className="rounded-m p-3 flex items-start gap-2" style={{ background: "var(--warn-tint)" }}>
              <Icon name="alert" size={16} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
              <div>
                <p className="text-[13.5px] font-semibold" style={{ color: "var(--warn)" }}>
                  Jornada menor a 15 minutos
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                  ¿Es correcto este registro?
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="primary" onClick={guardar} disabled={saving || !canSave} className="flex-1">
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
    original? 12:00-23:59 = PM, 00:00-11:59 = AM. Cambiar 8:12 → 9:12 no
    cruza nada (AM→AM); cambiar 8:12 → 20:12 sí (AM→PM) — ese es el caso
    típico de "seleccioné el AM/PM equivocado" que pide confirmación. */
function cruzaAmPm(original: string, next: string): boolean {
  const origHour = Number(original.split(":")[0]);
  const nextHour = Number(next.split(":")[0]);
  if (Number.isNaN(origHour) || Number.isNaN(nextHour)) return false;
  return (origHour >= 12) !== (nextHour >= 12);
}
