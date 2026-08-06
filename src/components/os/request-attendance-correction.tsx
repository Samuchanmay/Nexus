"use client";
// ══════════════════════════════════════════════════════════
//  Pedir corrección de asistencia — gap de producto cerrado a pedido
//  del usuario (auditoría de notificaciones, ago 2026). El empleado ve
//  un error en un día de su historial (hora mal marcada, movimiento que
//  falta) y antes no tenía forma de avisarlo dentro de EMET.
//
//  No corrige nada directamente — solo crea una SOLICITUD (tabla
//  attendance_correction_requests) que un admin revisa y resuelve desde
//  /admin/asistencia, aplicando el fix real con el mismo Sheet que ya
//  usa para corregir asistencia manualmente (edit-attendance-sheet.tsx).
//  Mismo patrón visual que resolve-pending-exit.tsx.
// ══════════════════════════════════════════════════════════
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notifyAdmins } from "@/lib/notify";
import { Field, Button } from "@/components/os/ui";
import { useToast } from "@/components/ui";

export function RequestAttendanceCorrection({ userId, userName, date }: { userId: string; userName: string; date: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const enviar = async () => {
    const trimmed = note.trim();
    if (!trimmed) { toast("Escribe qué está mal ese día", "danger"); return; }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("attendance_correction_requests")
      .insert({ user_id: userId, date, note: trimmed });
    if (error) {
      setBusy(false);
      toast("No se pudo enviar la solicitud", "danger");
      return;
    }
    notifyAdmins(supabase, "Solicitud de corrección de asistencia", `${userName} · ${date}: ${trimmed}`, "request", "/admin/asistencia");
    setBusy(false);
    setOpen(false);
    setNote("");
    toast("Solicitud enviada — un admin la va a revisar");
    router.refresh();
  };

  if (!open) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); setOpen(true); }}
        className="text-[12.5px] font-semibold px-3 py-2 rounded-sm w-full text-left"
        style={{ color: "var(--text-3)" }}
      >
        ¿Algo mal este día? Pedir corrección
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 p-3 rounded-sm" style={{ background: "var(--surface-2)" }}>
      <Field label="¿Qué hay que corregir?">
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <textarea
          autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="Ej: mi entrada marcó 9:30 pero llegué a las 9:00"
          className="field-input w-full resize-none"
        />
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={enviar} disabled={busy || !note.trim()} className="flex-1">
          {busy ? "Enviando…" : "Enviar solicitud"}
        </Button>
        <Button variant="subtle" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
      </div>
    </div>
  );
}
