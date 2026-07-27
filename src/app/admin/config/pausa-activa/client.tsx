"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseMutation, PageHeader, Switch } from "@/components/shared";
import { Select } from "@/components/ui";
import { IconPlus, IconTrash } from "@/components/icons";
import { SectionIntro } from "@/components/config-intro";
import type { PausaFraseRow } from "./page";

export default function PausaActivaClient({ frases, intervalMin, windowMin, modo, embedded }: {
  frases: PausaFraseRow[]; intervalMin: number; windowMin: number; modo: "secuencial" | "aleatorio"; embedded?: boolean;
}) {
  const { run, saving } = useSupabaseMutation();
  const [newTexto, setNewTexto] = useState("");
  const [intervalHours, setIntervalHours] = useState(intervalMin / 60);
  const [windowMinutes, setWindowMinutes] = useState(windowMin);
  const [modoRotacion, setModoRotacion] = useState<"secuencial" | "aleatorio">(modo);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  const activas = frases.filter((f) => f.activo);

  // La preview rota sola cada 4s entre las frases activas, para que el
  // admin vea cómo se sentirá el ciclo real sin tener que esperar horas.
  useEffect(() => {
    if (activas.length <= 1) return;
    const id = setInterval(() => setPreviewIdx((i) => (i + 1) % activas.length), 4000);
    return () => clearInterval(id);
  }, [activas.length]);

  const toggleActivo = (row: PausaFraseRow) =>
    run(() => createClient().from("pausa_activa_frases").update({ activo: !row.activo }).eq("id", row.id),
      { ok: row.activo ? "Frase desactivada" : "Frase activada", err: "No se pudo actualizar" });

  const saveTexto = (row: PausaFraseRow, texto: string) => {
    if (!texto.trim() || texto.trim() === row.texto) return;
    run(() => createClient().from("pausa_activa_frases").update({ texto: texto.trim() }).eq("id", row.id),
      { err: "No se pudo guardar" });
  };

  const remove = (row: PausaFraseRow) => {
    setConfirmId(null);
    run(() => createClient().from("pausa_activa_frases").delete().eq("id", row.id),
      { ok: "Frase eliminada", err: "No se pudo eliminar" });
  };

  const add = async () => {
    if (!newTexto.trim()) return;
    const orden = (frases.at(-1)?.orden ?? 0) + 1;
    const ok = await run(() => createClient().from("pausa_activa_frases")
      .insert({ texto: newTexto.trim(), orden, activo: true }),
      { ok: "Frase agregada" });
    if (ok) setNewTexto("");
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= frases.length) return;
    const a = frases[index], b = frases[j];
    return run(async () => {
      const supabase = createClient();
      const { error: e1 } = await supabase.from("pausa_activa_frases").update({ orden: b.orden }).eq("id", a.id);
      const { error: e2 } = await supabase.from("pausa_activa_frases").update({ orden: a.orden }).eq("id", b.id);
      if (e1 || e2) return { error: { message: "No se pudo reordenar" } };
      return { error: null };
    }, {});
  };

  const saveTiming = () => {
    const hours = Math.max(0.5, Number(intervalHours) || 2);
    const mins = Math.max(1, Math.round(Number(windowMinutes) || 12));
    return run(async () => {
      const supabase = createClient();
      const { error: e1 } = await supabase.from("app_settings")
        .upsert({ key: "pausa_activa_interval_min", value: String(Math.round(hours * 60)) });
      const { error: e2 } = await supabase.from("app_settings")
        .upsert({ key: "pausa_activa_window_min", value: String(mins) });
      const { error: e3 } = await supabase.from("app_settings")
        .upsert({ key: "pausa_activa_modo", value: modoRotacion });
      if (e1 || e2 || e3) return { error: { message: "No se pudo guardar el ritmo" } };
      return { error: null };
    }, { ok: "Ritmo actualizado" });
  };

  const previewFrase = activas[previewIdx % Math.max(activas.length, 1)]?.texto
    ?? "Aún no hay frases activas — se usará una frase genérica de respaldo.";

  return (
    <>
      {!embedded && (
        <PageHeader title="Pausa activa" subtitle="Frases y ritmo del aviso de pausa activa en el Asistente — sin tocar código" />
      )}

      <SectionIntro
        stats={[
          { label: "Frases", value: frases.length },
          { label: "Activas", value: activas.length, tone: "ok" },
          { label: "Cada (h)", value: intervalHours },
        ]}
        tip="El modo aleatorio evita que las primeras frases de la lista se repitan más que las últimas — sigue siendo determinista, solo se siente más variado."
      />

      <div className="card p-4 mb-5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
        El Asistente avisa cada cierto tiempo de trabajo <strong>continuo</strong> (no de reloj fijo —
        si hubo un descanso, el conteo se reinicia desde que se retoma). Cada vez que se cumple el
        ciclo, muestra la siguiente frase activa de la lista de abajo (o una al azar, según el modo).
      </div>

      {/* Vista previa del popup real (§321) — mismo lenguaje visual que
          components/os/pausa-activa-popup.tsx (círculo con acento, título,
          mensaje), estática/embebida en la tarjeta en vez de flotante. */}
      <div className="card p-6 mb-6 text-center" style={{ background: "var(--surface-2)" }}>
        <p className="text-[10px] font-bold mb-4" style={{ color: "var(--text-3)" }}>VISTA PREVIA DEL AVISO</p>
        <div className="max-w-[340px] mx-auto rounded-lg p-6" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
            <span className="text-[20px]">☕</span>
          </div>
          <p className="text-[14px] font-bold mb-1.5">Pausa activa</p>
          <p className="text-[12.5px] leading-relaxed transition-opacity duration-300" style={{ color: "var(--text-2)" }}>
            {previewFrase}
          </p>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <p className="text-[13px] font-bold mb-3">Ritmo del aviso</p>
        <div className="grid sm:grid-cols-3 gap-2.5 mb-3">
          <label className="block">
            <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>
              Cada cuántas horas de trabajo continuo
            </span>
            <input type="number" min={0.5} step={0.5} value={intervalHours}
              onChange={(e) => setIntervalHours(Number(e.target.value))}
              className="field-input text-[13px] py-2" />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>
              Minutos que permanece visible cada aviso
            </span>
            <input type="number" min={1} value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value))}
              className="field-input text-[13px] py-2" />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>
              Orden de rotación
            </span>
            <Select
              value={modoRotacion} onChange={(v) => setModoRotacion(v as "secuencial" | "aleatorio")}
              title="Orden de rotación" searchable={false}
              options={[
                { value: "secuencial", label: "Secuencial (en orden)" },
                { value: "aleatorio", label: "Aleatorio (revuelto)" },
              ]}
            />
          </label>
        </div>
        <button className="btn-primary px-4 py-2 text-[12.5px]" disabled={saving} onClick={saveTiming}>
          Guardar ritmo
        </button>
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {frases.length === 0 && (
          <div className="card p-4 text-[12.5px]" style={{ color: "var(--text-3)" }}>
            Aún no hay frases — el Asistente usará una frase genérica de respaldo hasta que agregues una.
          </div>
        )}
        {frases.map((row, idx) => (
          <div key={row.id} className="card p-3.5 flex items-center gap-2.5" style={{ opacity: row.activo ? 1 : 0.5 }}>
            <div className="flex flex-col shrink-0">
              <button onClick={() => move(idx, -1)} disabled={idx === 0 || saving}
                className="text-[11px] font-bold px-1 disabled:opacity-30" style={{ color: "var(--text-2)" }}>↑</button>
              <button onClick={() => move(idx, 1)} disabled={idx === frases.length - 1 || saving}
                className="text-[11px] font-bold px-1 disabled:opacity-30" style={{ color: "var(--text-2)" }}>↓</button>
            </div>
            <input defaultValue={row.texto} onBlur={(e) => saveTexto(row, e.target.value)}
              className="text-[13.5px] bg-transparent border-0 outline-none flex-1 min-w-0" />
            <Switch tone="status" checked={row.activo} onChange={() => toggleActivo(row)} disabled={saving}
              label={row.activo ? "Activa" : "Inactiva"} />
            {confirmId === row.id ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>¿Eliminar?</span>
                <button disabled={saving} onClick={() => remove(row)}
                  className="text-[11.5px] font-semibold px-2 py-1 rounded-full"
                  style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                  Sí, eliminar
                </button>
                <button onClick={() => setConfirmId(null)}
                  className="text-[11.5px] font-semibold px-2 py-1 rounded-full"
                  style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                  No
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmId(row.id)} aria-label="Eliminar frase (borra permanentemente)" title="Eliminar frase — borra permanentemente"
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card p-5">
        <p className="text-[13px] font-bold mb-3">Agregar frase nueva</p>
        <div className="flex gap-2">
          <input className="field-input flex-1" placeholder="Ej. Momento de estirar las piernas — ¿bala time o taxito time? ☕"
            value={newTexto} onChange={(e) => setNewTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <button onClick={add} disabled={saving} className="btn-primary px-4 py-2 text-[12.5px] flex items-center gap-1.5 shrink-0">
            <IconPlus className="w-4 h-4" /> Agregar
          </button>
        </div>
      </div>
    </>
  );
}
