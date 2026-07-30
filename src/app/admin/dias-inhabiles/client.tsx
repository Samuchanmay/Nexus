"use client";
import type React from "react";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast, SlidingSegments, DatePicker, Sheet, Select } from "@/components/ui";
import { dmy } from "@/lib/tz";
import { useSupabaseMutation, EmptyState, Field } from "@/components/shared";
import { IconPlus, IconCalendar, IconMapPin, IconFolder, IconSun, IconDownload, IconTrash } from "@/components/icons";
import { mexicanHolidays } from "@/lib/holidays";
import { MONTHS, DOW, shiftMonth, monthBounds, buildMonthGrid } from "@/lib/calendar-grid";
import { todayMerida } from "@/lib/tz";
import { HOLIDAY_KIND_LABEL, holidayStyle, type HolidayKind } from "@/lib/ui-maps";
import { usePersistedView } from "@/lib/persisted-view";
import { logAdminAction } from "@/lib/admin-log";

const KIND_ICON: Record<HolidayKind, React.ComponentType<{ className?: string }>> = {
  nacional: IconCalendar, estatal: IconMapPin, empresa: IconFolder, puente: IconSun,
};

type Holiday = { id: string; date: string; name: string; kind: string; notes: string | null };
type HolidayForm = { date: string; name: string; kind: string; notes: string };
const EMPTY_FORM: HolidayForm = { date: "", name: "", kind: "empresa", notes: "" };

/**
 * Días inhábiles — rediseño completo. Esta pantalla NO es un Excel: su
 * único trabajo es dejar ver de un vistazo qué días no cuentan como
 * laborables y administrarlos rápido. Un solo calendario grande es la
 * vista principal; la vista Año queda como opción secundaria para
 * planeación de temporada. La vieja vista "Lista" (con eliminar en línea)
 * se retira — administrar un día ahora se hace abriendo su celda en el
 * calendario, que abre el mismo Drawer de alta en modo edición (con botón
 * Eliminar) — así no hace falta una pantalla de lista aparte para el CRUD.
 */
export default function DiasClient({ holidays, adminId }: { holidays: Holiday[]; adminId?: string }) {
  const toast = useToast();
  const { run, saving } = useSupabaseMutation();
  const { run: runGen, saving: generating } = useSupabaseMutation();
  const today = todayMerida();
  const currentYear = Number(today.slice(0, 4));

  const [view, setView] = usePersistedView<"Mes" | "Año">("dias-inhabiles.view", ["Mes", "Año"], "Mes");
  const [ym, setYm] = useState(today.slice(0, 7));
  const [yearView, setYearView] = useState(currentYear);
  const [genYear, setGenYear] = useState(String(currentYear));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState<HolidayForm>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setConfirmDelete(false); setDrawerOpen(true); };
  const openEdit = (h: Holiday) => {
    setEditing(h); setForm({ date: h.date, name: h.name, kind: h.kind, notes: h.notes ?? "" });
    setConfirmDelete(false); setDrawerOpen(true);
  };

  const save = async () => {
    if (!form.date || !form.name.trim()) { toast("Fecha y nombre son obligatorios", "warn"); return; }
    const payload = { date: form.date, name: form.name.trim(), kind: form.kind, notes: form.notes.trim() || null };
    const ok = await run(async () => {
      const sb = createClient();
      const { error } = editing
        ? await sb.from("holidays").update(payload).eq("id", editing.id)
        : await sb.from("holidays").insert(payload);
      if (error) return { error: { message: error.code === "23505" ? "Esa fecha ya está registrada" : "No se pudo guardar" } };
      return { error: null };
    }, { ok: editing ? "Día inhábil actualizado" : "Día inhábil agregado" });
    if (ok) {
      if (adminId) logAdminAction(createClient(), adminId, editing ? "Editó día inhábil" : "Agregó día inhábil", form.name.trim());
      setDrawerOpen(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await run(() => createClient().from("holidays").delete().eq("id", editing.id),
      { ok: "Día eliminado", err: "No se pudo eliminar" });
    if (ok) {
      if (adminId) logAdminAction(createClient(), adminId, "Eliminó día inhábil", editing.name);
      setDrawerOpen(false);
    }
  };

  const generar = () => runGen(async () => {
    const year = parseInt(genYear);
    if (!year) return { error: { message: "Año inválido" } };
    const rows = mexicanHolidays(year).map((h) => ({ date: h.date, name: h.name, kind: "nacional" }));
    const { error } = await createClient().from("holidays")
      .upsert(rows, { onConflict: "date", ignoreDuplicates: true });
    if (error) return { error: { message: "No se pudieron generar" } };
    if (adminId) logAdminAction(createClient(), adminId, "Importó feriados oficiales", genYear);
    return { error: null };
  }, { ok: `Feriados oficiales de ${genYear} importados` });

  const { year, month, daysInMonth, first, last } = monthBounds(ym);
  const holidayOf = useMemo(() => new Map(holidays.map((h) => [h.date, h])), [holidays]);
  const monthCells = useMemo(() => buildMonthGrid(first, last, daysInMonth), [first, last, daysInMonth]);

  const yearMonths = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const ymI = `${yearView}-${String(i + 1).padStart(2, "0")}`;
    const b = monthBounds(ymI);
    return { ...b, cells: buildMonthGrid(b.first, b.last, b.daysInMonth) };
  }), [yearView]);

  /** Resumen del año que se está viendo (Mes usa el año de `ym`; Año usa `yearView`). */
  const summaryYear = view === "Mes" ? Number(ym.slice(0, 4)) : yearView;
  const kindCounts = useMemo(() => {
    const c: Record<string, number> = { nacional: 0, estatal: 0, empresa: 0, puente: 0 };
    for (const h of holidays) if (h.date.slice(0, 4) === String(summaryYear)) c[h.kind] = (c[h.kind] ?? 0) + 1;
    return c;
  }, [holidays, summaryYear]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    for (let y = currentYear - 1; y <= currentYear + 2; y++) years.add(y);
    for (const h of holidays) years.add(Number(h.date.slice(0, 4)));
    return Array.from(years).sort((a, b) => a - b).map((y) => ({ value: String(y), label: String(y) }));
  }, [holidays, currentYear]);

  return (
    <>
      {/* ── Header: título + descripción, selector de año, importar feriados ── */}
      <header className="pt-8 pb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Días inhábiles</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Estos días nunca generan falta y no cuentan para vacaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={genYear} onChange={setGenYear} title="Año" searchable={false}
            className="field-input w-[100px] flex items-center justify-between gap-2 text-left"
            options={yearOptions}
          />
          <button className="btn-secondary px-4 py-2.5 text-[13px] flex items-center gap-1.5" disabled={generating} onClick={generar}>
            <IconDownload className="w-3.5 h-3.5" /> {generating ? "Importando…" : "Importar feriados oficiales"}
          </button>
          <button className="btn-primary px-4 py-2.5 text-[13px] flex items-center gap-1.5" onClick={openAdd}>
            <IconPlus className="w-4 h-4" /> Agregar día inhábil
          </button>
        </div>
      </header>

      {/* ── Resumen: 4 tarjetas pequeñas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
        {(Object.keys(HOLIDAY_KIND_LABEL) as HolidayKind[]).map((k) => {
          const KIcon = KIND_ICON[k];
          const st = holidayStyle(k);
          return (
            <div key={k} className="card p-3.5 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: st.bg, color: st.fg }}>
                <KIcon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[18px] font-bold tabular-nums leading-none">{kindCounts[k] ?? 0}</p>
                <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-2)" }}>{HOLIDAY_KIND_LABEL[k]}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-4">
        <SlidingSegments options={["Mes", "Año"]} value={view} onChange={(v) => setView(v as typeof view)} />
      </div>

      {/* ── Calendario principal: un único calendario grande ── */}
      {view === "Mes" && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold capitalize">{MONTHS[month - 1]} {year}</h2>
            <div className="flex items-center gap-2">
              <button className="btn-secondary px-3.5 py-1.5 text-[13px]" onClick={() => setYm(shiftMonth(ym, -1))}>← Mes anterior</button>
              <button className="btn-tertiary px-3.5 py-1.5 text-[13px]" onClick={() => setYm(today.slice(0, 7))}>Hoy</button>
              <button className="btn-secondary px-3.5 py-1.5 text-[13px]" onClick={() => setYm(shiftMonth(ym, 1))}>Mes siguiente →</button>
              <Select
                value={String(year)} onChange={(v) => setYm(`${v}-${String(month).padStart(2, "0")}`)}
                title="Cambiar año" searchable={false}
                className="field-input w-[90px] flex items-center justify-between gap-2 text-left py-1.5 text-[13px]"
                options={yearOptions}
              />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {DOW.map((d) => <p key={d} className="text-center text-[12px] font-bold" style={{ color: "var(--text-3)" }}>{d}</p>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {monthCells.map((c) => {
              const h = holidayOf.get(c.date);
              const style = h ? holidayStyle(h.kind) : null;
              return (
                <button
                  key={c.date} type="button" disabled={!c.inMonth}
                  onClick={() => { if (h) openEdit(h); }}
                  title={h ? `${dmy(c.date)} · ${h.name} (${HOLIDAY_KIND_LABEL[(h.kind as HolidayKind)] ?? h.kind})` : dmy(c.date)}
                  className="rounded-sm p-2 min-h-[72px] flex flex-col items-start justify-start gap-1.5 transition-colors text-left"
                  style={{
                    background: h ? style!.bg : "var(--surface-2)",
                    opacity: c.inMonth ? 1 : 0.3,
                    outline: c.date === today ? "2px solid var(--accent)" : undefined,
                    outlineOffset: "-2px",
                    cursor: h ? "pointer" : "default",
                  }}>
                  <p className="text-[12px] font-bold tabular-nums" style={{ color: h ? style!.fg : "var(--text-2)" }}>{c.day}</p>
                  {h && (
                    <p className="text-[12px] font-semibold leading-tight line-clamp-2" style={{ color: style!.fg }}>{h.name}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Vista Año: secundaria, solo para planeación de temporada ── */}
      {view === "Año" && (
        <div className="flex flex-col gap-4">
          <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
            <span className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Vista anual</span>
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
                      <button
                        key={c.date} type="button" disabled={!h}
                        onClick={() => { if (h) openEdit(h); }}
                        title={h ? `${dmy(c.date)} · ${h.name} (${HOLIDAY_KIND_LABEL[(h.kind as HolidayKind)] ?? h.kind})` : dmy(c.date)}
                        className="relative aspect-square rounded-[3px] flex items-center justify-center text-[8.5px] font-semibold tabular-nums"
                        style={{
                          opacity: c.inMonth ? 1 : 0.25,
                          color: "var(--text-3)",
                          outline: c.date === today ? "1.5px solid var(--accent)" : undefined,
                          outlineOffset: "-1.5px",
                          cursor: h ? "pointer" : "default",
                        }}>
                        {c.day}
                        {h && (
                          <span className="absolute bottom-[1px] w-[3px] h-[3px] rounded-full" style={{ background: st!.fg }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {holidays.length === 0 && (
        <div className="mt-4">
          <EmptyState icon={<IconPlus className="w-[22px] h-[22px]" />} title="Sin días inhábiles registrados"
            hint="Agrega el primero con el botón de arriba, o importa los feriados oficiales del año." />
        </div>
      )}

      {/* ── Drawer: alta / edición de un día inhábil ── */}
      <Sheet
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editing ? "Editar día inhábil" : "Agregar día inhábil"}
        subtitle={editing ? editing.name : "Feriado, puente u otro día que no cuenta como laborable"}
      >
        <div className="flex flex-col gap-3 pb-2">
          <Field label="Fecha">
            <DatePicker value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} />
          </Field>
          <Field label="Tipo">
            <Select
              value={form.kind} onChange={(v) => setForm({ ...form, kind: v })}
              title="Tipo de día" searchable={false}
              options={(Object.keys(HOLIDAY_KIND_LABEL) as HolidayKind[]).map((k) => {
                const KIcon = KIND_ICON[k];
                return { value: k, label: HOLIDAY_KIND_LABEL[k], icon: <KIcon className="w-4 h-4" /> };
              })}
            />
          </Field>
          <Field label="Nombre">
            <input className="field-input" placeholder="Ej. Día de la Independencia"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Notas (opcional)">
            <textarea className="field-input min-h-[80px] resize-none" placeholder="Contexto adicional…"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          {editing && confirmDelete ? (
            <div className="flex items-center gap-2 rounded-sm px-3.5 py-2.5" style={{ background: "var(--danger-tint)" }}>
              <span className="text-[12.5px] font-semibold flex-1" style={{ color: "var(--danger)" }}>¿Eliminar este día inhábil?</span>
              <button className="text-[12px] font-semibold px-2.5 py-1 rounded-full" disabled={saving}
                style={{ background: "var(--danger)", color: "#fff" }} onClick={remove}>Sí, eliminar</button>
              <button className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "var(--surface-2)", color: "var(--text-2)" }} onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          ) : (
            <div className="flex gap-2.5 mt-1">
              {editing && (
                <button className="btn-secondary px-3.5 py-3 text-[14px] flex items-center gap-1.5" onClick={() => setConfirmDelete(true)}>
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
              )}
              <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setDrawerOpen(false)}>Cancelar</button>
              <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={saving} onClick={save}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
