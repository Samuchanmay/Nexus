"use client";
import type React from "react";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast, SlidingSegments, DatePicker } from "@/components/ui";
import { dmy } from "@/lib/tz";
import { useSupabaseMutation, EmptyState } from "@/components/shared";
import { IconPlus, IconX, IconCalendar, IconMapPin, IconFolder, IconSun } from "@/components/icons";
import { mexicanHolidays } from "@/lib/holidays";
import { MONTHS, DOW, shiftMonth, monthBounds, buildMonthGrid } from "@/lib/calendar-grid";
import { todayMerida } from "@/lib/tz";
import { HOLIDAY_KIND_LABEL, holidayStyle, type HolidayKind } from "@/lib/ui-maps";
import { usePersistedView } from "@/lib/persisted-view";

const KIND_ICON: Record<HolidayKind, React.ComponentType<{ className?: string }>> = {
  nacional: IconCalendar, estatal: IconMapPin, empresa: IconFolder, puente: IconSun,
};

export default function DiasClient({ holidays }: { holidays: { id: string; date: string; name: string; kind: string }[] }) {
  const toast = useToast();
  const { run, saving } = useSupabaseMutation();
  const [form, setForm] = useState({ date: "", name: "", kind: "empresa" });
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()));
  const { run: runGen, saving: generating } = useSupabaseMutation();
  const [view, setView] = usePersistedView<"Año" | "Mes" | "Lista">(
    "dias-inhabiles.view", ["Año", "Mes", "Lista"], "Año"
  );
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const today = todayMerida();
  const [ym, setYm] = useState(today.slice(0, 7));
  const [yearView, setYearView] = useState(Number(today.slice(0, 4)));

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
    if (!form.date || !form.name.trim()) { toast("Fecha y nombre son obligatorios", "warn"); return; }
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

  /** 12 mini-meses del año seleccionado, cada uno con su propia rejilla —
      para la vista Año (calendario anual en vez de una lista plana). */
  const yearMonths = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const ymI = `${yearView}-${String(i + 1).padStart(2, "0")}`;
    const b = monthBounds(ymI);
    return { ...b, cells: buildMonthGrid(b.first, b.last, b.daysInMonth) };
  }), [yearView]);
  const kindCounts = useMemo(() => {
    const c: Record<string, number> = { nacional: 0, estatal: 0, empresa: 0, puente: 0 };
    for (const h of holidays) if (h.date.slice(0, 4) === String(yearView)) c[h.kind] = (c[h.kind] ?? 0) + 1;
    return c;
  }, [holidays, yearView]);

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
          <DatePicker value={form.date}
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
        <SlidingSegments options={["Año", "Mes", "Lista"]} value={view} onChange={(v) => setView(v as typeof view)} />
      </div>

      {view === "Lista" && (
        <div className="flex flex-col gap-2">
          {holidays.length === 0 && (
            <EmptyState icon={<IconPlus className="w-[22px] h-[22px]" />} title="Sin días inhábiles registrados" hint="Agrégalos arriba — feriados, puentes u otros días que no cuenten como laborables." />
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
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold"
                    style={{ background: holidayStyle(h.kind).bg, color: holidayStyle(h.kind).fg }}>
                    {(() => { const KIcon = KIND_ICON[(h.kind as HolidayKind)] ?? IconCalendar; return <KIcon className="w-3 h-3" />; })()}
                    {HOLIDAY_KIND_LABEL[(h.kind as HolidayKind)] ?? h.kind}
                  </span>
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

      {view === "Año" && (
        <div className="flex flex-col gap-4">
          <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Categorías</span>
              {(Object.keys(HOLIDAY_KIND_LABEL) as HolidayKind[]).map((k) => {
                const KIcon = KIND_ICON[k];
                const st = holidayStyle(k);
                return (
                  <span key={k} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold"
                    style={{ background: st.bg, color: st.fg }}>
                    <KIcon className="w-3 h-3" /> {HOLIDAY_KIND_LABEL[k]} · {kindCounts[k] ?? 0}
                  </span>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary px-3.5 py-1.5 text-[13px]" onClick={() => setYearView((y) => y - 1)}>←</button>
              <span className="text-[15px] font-bold tabular-nums w-[52px] text-center">{yearView}</span>
              <button className="btn-secondary px-3.5 py-1.5 text-[13px]" onClick={() => setYearView((y) => y + 1)}>→</button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {yearMonths.map((m) => (
              <div key={m.month} className="card p-3">
                <p className="text-[12.5px] font-bold capitalize mb-2">{MONTHS[m.month - 1]}</p>
                <div className="grid grid-cols-7 gap-[3px] mb-1">
                  {DOW.map((d) => (
                    <p key={d} className="text-center text-[8px] font-bold" style={{ color: "var(--text-3)" }}>{d[0]}</p>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-[3px]">
                  {m.cells.map((c) => {
                    const h = holidayOf.get(c.date);
                    const st = h ? holidayStyle(h.kind) : null;
                    return (
                      <div key={c.date}
                        title={h ? `${dmy(c.date)} · ${h.name} (${HOLIDAY_KIND_LABEL[(h.kind as HolidayKind)] ?? h.kind})` : dmy(c.date)}
                        className="aspect-square rounded-[3px] flex items-center justify-center text-[8.5px] font-semibold tabular-nums"
                        style={{
                          background: st ? st.bg : "transparent",
                          color: st ? st.fg : "var(--text-3)",
                          opacity: c.inMonth ? 1 : 0.25,
                          outline: c.date === today ? "1.5px solid var(--accent)" : undefined,
                          outlineOffset: "-1.5px",
                        }}>
                        {c.day}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
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
              const style = h ? holidayStyle(h.kind) : null;
              const KIcon = h ? (KIND_ICON[(h.kind as HolidayKind)] ?? IconCalendar) : null;
              return (
                <div key={c.date} className="rounded-sm p-1.5 min-h-[64px] flex flex-col gap-1"
                  style={{
                    background: style ? style.bg : "var(--surface-2)",
                    opacity: c.inMonth ? 1 : 0.35,
                    outline: c.date === today ? "2px solid var(--accent)" : undefined,
                    outlineOffset: "-2px",
                  }}>
                  <div className="flex items-center justify-between">
                    <p className="text-[11.5px] font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{c.day}</p>
                    {KIcon && <span style={{ color: style!.fg }}><KIcon className="w-2.5 h-2.5" /></span>}
                  </div>
                  {h && <p className="text-[9.5px] font-semibold truncate" style={{ color: style!.fg }} title={h.name}>{h.name}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
