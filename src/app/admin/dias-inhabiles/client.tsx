"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast, Pill, SlidingSegments, DateField } from "@/components/ui";
import { dmy } from "@/lib/tz";
import { useSupabaseMutation } from "@/components/shared";
import { IconPlus, IconX } from "@/components/icons";
import { mexicanHolidays } from "@/lib/holidays";
import { MONTHS, DOW, shiftMonth, monthBounds, buildMonthGrid } from "@/lib/calendar-grid";
import { todayMerida } from "@/lib/tz";

const KIND_TONE: Record<string, "accent" | "warn" | "ok" | "muted"> = {
  nacional: "accent", estatal: "warn", empresa: "ok", puente: "muted",
};

export default function DiasClient({ holidays }: { holidays: { id: string; date: string; name: string; kind: string }[] }) {
  const toast = useToast();
  const { run, saving } = useSupabaseMutation();
  const [form, setForm] = useState({ date: "", name: "", kind: "empresa" });
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()));
  const { run: runGen, saving: generating } = useSupabaseMutation();
  const [view, setView] = useState<"Lista" | "Mes">("Lista");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const today = todayMerida();
  const [ym, setYm] = useState(today.slice(0, 7));

  const generar = () => runGen(async () => {
    const year = parseInt(genYear);
    if (!year) return { error: { message: "Año inválido" } };
    const rows = mexicanHolidays(year).map((h) => ({ date: h.date, name: h.name, kind: "nacional" }));
    const { error } = await createClient().from("holidays")
      .upsert(rows, { onConflict: "date", ignoreDuplicates: true });
    if (error) return { error: { message: "No se pudieron generar" } };
    return { error: null };
  }, { ok: `Feriados oficiales de ${genYear} generados` });

  const add = async () => {
    if (!form.date || !form.name.trim()) { toast("Fecha y nombre son obligatorios"); return; }
    const ok = await run(async () => {
      const { error } = await createClient().from("holidays").insert(form);
      if (error) return { error: { message: error.code === "23505" ? "Esa fecha ya está registrada" : "No se pudo guardar" } };
      return { error: null };
    }, { ok: "Día inhábil agregado" });
    if (ok) setForm({ date: "", name: "", kind: "empresa" });
  };

  const remove = async (id: string) => {
    const ok = await run(() => createClient().from("holidays").delete().eq("id", id),
      { ok: "Día eliminado", err: "No se pudo eliminar" });
    if (ok) setConfirmId(null);
  };

  const { year, month, daysInMonth, first, last } = monthBounds(ym);
  const holidayOf = useMemo(() => new Map(holidays.map((h) => [h.date, h])), [holidays]);
  const monthCells = useMemo(() => buildMonthGrid(first, last, daysInMonth), [first, last, daysInMonth]);

  return (
    <>
      <header className="pt-8 pb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Días inhábiles</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Estos días nunca generan falta y no cuentan para vacaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" className="field-input w-[100px]" value={genYear}
            onChange={(e) => setGenYear(e.target.value)} />
          <button className="btn-secondary px-4 py-2.5 text-[13px]" disabled={generating} onClick={generar}>
            {generating ? "Generando…" : `Generar feriados oficiales de ${genYear}`}
          </button>
        </div>
      </header>

      <div className="card p-5 mb-6">
        <div className="grid md:grid-cols-[160px_1fr_150px_auto] gap-2.5">
          <DateField value={form.date}
            onChange={(iso) => setForm({ ...form, date: iso })} />
          <input className="field-input" placeholder="Nombre del día"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="field-input" value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="nacional">Nacional</option>
            <option value="estatal">Estatal</option>
            <option value="empresa">Empresa</option>
            <option value="puente">Puente</option>
          </select>
          <button className="btn-primary px-5 py-3 text-[13.5px] flex items-center gap-1.5" disabled={saving} onClick={add}>
            <IconPlus className="w-4 h-4" /> Agregar
          </button>
        </div>
      </div>

      <div className="mb-4">
        <SlidingSegments options={["Lista", "Mes"]} value={view} onChange={(v) => setView(v as typeof view)} />
      </div>

      {view === "Lista" && (
        <div className="flex flex-col gap-2">
          {holidays.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-[13px]" style={{ color: "var(--text-2)" }}>Sin días inhábiles registrados</p>
            </div>
          )}
          {holidays.map((h) => (
            <div key={h.id} className="card px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <p className="text-[13.5px] font-bold tabular-nums w-[100px]">{dmy(h.date)}</p>
                <p className="text-[13.5px]">{h.name}</p>
              </div>
              {confirmId === h.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>¿Eliminar?</span>
                  <button disabled={saving} onClick={() => remove(h.id)}
                    className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                    Sí, eliminar
                  </button>
                  <button onClick={() => setConfirmId(null)}
                    className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                    No
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Pill tone={KIND_TONE[h.kind] ?? "muted"}>{h.kind}</Pill>
                  <button onClick={() => setConfirmId(h.id)} aria-label="Eliminar"
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                    <IconX className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "Mes" && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold capitalize">{MONTHS[month - 1]} {year}</h2>
            <div className="flex items-center gap-2">
              <button className="btn-secondary px-3.5 py-1.5 text-[13px]" onClick={() => setYm(shiftMonth(ym, -1))}>←</button>
              <button className="btn-secondary px-3.5 py-1.5 text-[13px]" onClick={() => setYm(today.slice(0, 7))}>Hoy</button>
              <button className="btn-secondary px-3.5 py-1.5 text-[13px]" onClick={() => setYm(shiftMonth(ym, 1))}>→</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {DOW.map((d) => <p key={d} className="text-center text-[11px] font-bold" style={{ color: "var(--text-3)" }}>{d}</p>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthCells.map((c) => {
              const h = holidayOf.get(c.date);
              return (
                <div key={c.date} className="rounded-sm p-1.5 min-h-[64px] flex flex-col gap-1"
                  style={{
                    background: h ? "var(--accent-tint)" : "var(--surface-2)",
                    opacity: c.inMonth ? 1 : 0.35,
                    outline: c.date === today ? "2px solid var(--accent)" : undefined,
                    outlineOffset: "-2px",
                  }}>
                  <p className="text-[11.5px] font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{c.day}</p>
                  {h && <p className="text-[9.5px] font-semibold truncate" style={{ color: "var(--accent)" }} title={h.name}>{h.name}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
