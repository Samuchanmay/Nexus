"use client";
// ══════════════════════════════════════════════════════════
//  Resolver un día "Pendiente de confirmar salida" — la persona
//  indica su hora real de salida (o pide que RH lo valide si no la
//  recuerda). Ver lib/pending-exits.ts para el detalle de datos.
// ══════════════════════════════════════════════════════════
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolvePendingExit, requestRhValidation } from "@/lib/pending-exits";
import { Field, Input, Button } from "@/components/os/ui";
import { useToast, TimePicker } from "@/components/ui";

export function ResolvePendingExit({ userId, date }: { userId: string; date: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [hora, setHora] = useState("18:00");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    setBusy(true);
    const supabase = createClient();
    const r = await resolvePendingExit(supabase, userId, date, `${hora}:00`, motivo);
    setBusy(false);
    if (r.ok) {
      toast("Salida registrada — gracias por confirmarla");
      setOpen(false);
      router.refresh();
    } else {
      toast(`No se pudo guardar: ${r.error}`);
    }
  };

  const solicitarRh = async () => {
    setBusy(true);
    const supabase = createClient();
    const r = await requestRhValidation(supabase, userId, date, motivo);
    setBusy(false);
    if (r.ok) {
      toast("Se avisó a RH para que valide este día");
      setOpen(false);
      router.refresh();
    } else {
      toast(`No se pudo enviar: ${r.error}`);
    }
  };

  if (!open) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); setOpen(true); }}
        className="text-[12.5px] font-semibold px-3 py-2 rounded-sm w-full text-left"
        style={{ color: "var(--warn)", background: "var(--warn-tint)" }}
      >
        ¿A qué hora saliste realmente? Toca aquí para confirmarlo
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 p-3 rounded-sm" style={{ background: "var(--surface-2)" }}>
      <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
        Ese día olvidaste registrar tu salida. ¿A qué hora saliste?
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Hora de salida">
          <TimePicker value={hora} onChange={setHora} />
        </Field>
        <Field label="Motivo (opcional)">
          <Input placeholder="Olvidé registrar" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={guardar} disabled={busy} className="flex-1">Guardar</Button>
        <Button variant="subtle" size="sm" onClick={solicitarRh} disabled={busy} className="flex-1">Solicitar validación RH</Button>
        <Button variant="subtle" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
      </div>
    </div>
  );
}
