"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TimePicker } from "@/components/select";
import { useToast } from "@/components/ui";
import { Button, Field } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { fmtTime } from "@/lib/hours";
import { logAdminAction } from "@/lib/admin-log";

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
  const [entrada, setEntrada] = useState(firstIn ?? "08:00");
  const [salida, setSalida] = useState(lastOut ?? "17:00");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  // Validaciones inteligentes
  const entradaMin = timeToMin(entrada);
  const salidaMin = timeToMin(salida);
  const duracionMin = salidaMin - entradaMin;
  const esSalidaAntesEntrada = salidaMin < entradaMin;
  const esJornadaMuyLarga = duracionMin > 16 * 60; // >16 horas
  const esJornadaMuyCorta = duracionMin > 0 && duracionMin < 15; // <15 minutos

  const canSave = !esSalidaAntesEntrada && !esJornadaMuyLarga && !esJornadaMuyCorta && duracionMin > 0;

  const guardar = async () => {
    if (!canSave) {
      toast("Corrige los errores antes de guardar", "danger");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      // 1. Insertar nueva entrada (si no existía)
      if (!firstIn) {
        const { error: errEntrada } = await supabase.from("attendance").insert({
          user_id: userId,
          date,
          type: "Entrada",
          reason: "Entrada a trabajo",
          time: `${entrada}:00`,
          distance_m: null,
        });
        if (errEntrada) throw errEntrada;
      }

      // 2. Insertar nueva salida (si no existía)
      if (!lastOut) {
        const { error: errSalida } = await supabase.from("attendance").insert({
          user_id: userId,
          date,
          type: "Salida",
          reason: "Fin de jornada",
          time: `${salida}:00`,
          distance_m: null,
        });
        if (errSalida) throw errSalida;
      }

      // 3. Registrar en historial de correcciones
      const { error: errHistorial } = await supabase.from("attendance_corrections").insert({
        user_id: userId,
        date,
        admin_id: adminId,
        action: !firstIn && !lastOut ? "Agregó entrada y salida" : !firstIn ? "Agregó entrada" : "Agregó salida",
        details: `Entrada: ${entrada}, Salida: ${salida}. Motivo: ${motivo || "Sin motivo"}`,
      });
      if (errHistorial) throw errHistorial;

      // 4. Log de admin
      logAdminAction(
        supabase,
        adminId,
        "Corrigió asistencia",
        `${userName} · ${date} · ${!firstIn && !lastOut ? "Entrada y salida" : !firstIn ? "Entrada" : "Salida"}`
      );

      toast("Asistencia corregida");
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast("No se pudo guardar la corrección", "danger");
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
            <p className="text-[17px] font-bold">Corregir asistencia</p>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--text-2)" }}>{userName} · {date}</p>
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
          {!firstIn && (
            <Field label="Hora de entrada">
              <TimePicker value={entrada} onChange={setEntrada} />
            </Field>
          )}

          {!lastOut && (
            <Field label="Hora de salida">
              <TimePicker value={salida} onChange={setSalida} />
            </Field>
          )}

          <Field label="Motivo (opcional)">
            <input
              type="text"
              className="field-input w-full"
              placeholder="Ej: Olvidó registrar, Error de sistema"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Field>

          {/* Validaciones en tiempo real */}
          {duracionMin > 0 && (
            <div className="rounded-m p-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
                Total trabajado
              </p>
              <p className="text-[20px] font-bold tabular-nums mt-1" style={{ color: "var(--text-1)" }}>
                {Math.floor(duracionMin / 60)}h {duracionMin % 60}m
              </p>
            </div>
          )}

          {esSalidaAntesEntrada && (
            <div className="rounded-m p-3 flex items-start gap-2" style={{ background: "var(--danger-tint)" }}>
              <Icon name="alert" size={16} className="shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "var(--danger)" }}>
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
                <p className="text-[13px] font-semibold" style={{ color: "var(--warn)" }}>
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
                <p className="text-[13px] font-semibold" style={{ color: "var(--warn)" }}>
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
