"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseMutation, PageHeader, PersonRow, EmptyState, Field } from "@/components/shared";
import { SectionIntro } from "@/components/config-intro";
import { Sheet, DatePicker, Pill, useToast, Select, TimePicker } from "@/components/ui";
import { IconPlus, IconX } from "@/components/icons";
import { todayMerida, shortDate } from "@/lib/tz";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { scheduleFor, fmtTime, fmtMin } from "@/lib/hours";
import { addDays } from "@/lib/tz";
import type { Schedule } from "@/lib/types";
import { logAdminAction } from "@/lib/admin-log";

export type Person = { id: string; display_name: string; full_name?: string; nexus_color: string | null; avatar_url?: string | null; birth_date?: string | null; area: string | null };

const DEFAULT_SCHED = { start_time: "09:00:00", end_time: "18:00:00", target_min: 480, tolerance_min: 15 };

const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};
/** "16:00" + 300min → "21:00:00" (para calcular end_time, informativo). */
const addMinToTime = (start: string, min: number) => {
  const total = (toMin(start) + Math.round(min)) % (24 * 60);
  const h = Math.floor(total / 60), m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
};

/** Lunes a domingo de la semana que contiene `isoToday` (§316) — calculado
    en mediodía UTC como el resto de lib/tz.ts, para no depender de la
    zona horaria del navegador. */
function weekDates(isoToday: string): string[] {
  const d = new Date(isoToday + "T12:00:00Z");
  const dow = d.getUTCDay(); // 0=domingo..6=sábado
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => addDays(isoToday, mondayOffset + i));
}

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

/** Tira de 7 puntos (§316) — resumen visual de la semana sin abrir el
    Sheet de cada persona: punto vacío = sin horario definido para ese
    día, punto neutro = horario base, punto acentuado = horario temporal
    vigente ese día. */
function WeekStrip({ userId, schedules, today }: { userId: string; schedules: Schedule[]; today: string }) {
  const dates = weekDates(today);
  return (
    <div className="flex items-center gap-1 mt-0.5">
      {dates.map((date, i) => {
        const row = scheduleFor(schedules, userId, date);
        const isOverride = !!row && row.valid_until !== null;
        const isToday = date === today;
        return (
          <span
            key={date}
            title={`${WEEKDAY_LABELS[i]} ${shortDate(date)}${row ? ` · ${fmtTime(row.start_time)} · ${fmtMin(row.target_min)}${isOverride ? " (temporal)" : ""}` : " · sin horario"}`}
            className="w-[7px] h-[7px] rounded-full shrink-0"
            style={{
              background: row ? (isOverride ? "var(--accent)" : "var(--text-3)") : "transparent",
              border: row ? "none" : "1px solid var(--border-2)",
              boxShadow: isToday ? "0 0 0 2px var(--surface-1), 0 0 0 3px var(--border-2)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

export default function HorariosClient({ team, schedules, adminId, embedded }: { team: Person[]; schedules: Schedule[]; adminId?: string; embedded?: boolean }) {
  const { run, saving } = useSupabaseMutation();
  const toast = useToast();
  const today = todayMerida();

  const [editing, setEditing] = useState<Person | null>(null);
  const [editForm, setEditForm] = useState({ start: "09:00", hours: "8" });

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ personId: team[0]?.id ?? "", start: "16:00", hours: "5", from: "", to: "" });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const overrides = schedules
    .filter((s) => s.valid_until !== null)
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from));

  const personName = (id: string) => team.find((t) => t.id === id)?.display_name ?? "Persona eliminada";

  const openEdit = (p: Person) => {
    const current = scheduleFor(schedules, p.id, today) ?? DEFAULT_SCHED;
    setEditing(p);
    setEditForm({ start: current.start_time.slice(0, 5), hours: String(current.target_min / 60) });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const hours = parseFloat(editForm.hours) || 8;
    const target_min = Math.round(hours * 60);
    const start_time = `${editForm.start}:00`;
    const end_time = addMinToTime(editForm.start, target_min);
    const base = schedules.find((s) => s.user_id === editing.id && s.valid_until === null);
    const ok = await run(() => {
      const supabase = createClient();
      return base
        ? supabase.from("schedules").update({ start_time, end_time, target_min }).eq("id", base.id)
        : supabase.from("schedules").insert({
            user_id: editing.id, start_time, end_time, target_min, tolerance_min: 15,
            valid_from: today, valid_until: null,
          });
    }, { ok: "Horario actualizado", err: "No se pudo guardar" });
    if (ok) {
      if (adminId) logAdminAction(createClient(), adminId, "Editó horario", personName(editing.id));
      setEditing(null);
    }
  };

  const saveAdd = async () => {
    if (!addForm.personId) { toast("Selecciona una persona"); return; }
    if (!addForm.from || !addForm.to) { toast("Selecciona el rango de fechas"); return; }
    if (addForm.to < addForm.from) { toast("La fecha final debe ser posterior a la inicial"); return; }
    const hours = parseFloat(addForm.hours) || 8;
    const target_min = Math.round(hours * 60);
    const start_time = `${addForm.start}:00`;
    const end_time = addMinToTime(addForm.start, target_min);
    const ok = await run(() => createClient().from("schedules").insert({
      user_id: addForm.personId, start_time, end_time, target_min, tolerance_min: 15,
      valid_from: addForm.from, valid_until: addForm.to,
    }), { ok: "Horario temporal creado", err: "No se pudo crear" });
    if (ok) {
      if (adminId) logAdminAction(createClient(), adminId, "Creó horario temporal", personName(addForm.personId));
      setAddOpen(false);
    }
  };

  const removeOverride = async (id: string) => {
    setConfirmId(null);
    const target = schedules.find((s) => s.id === id);
    const ok = await run(() => createClient().from("schedules").delete().eq("id", id),
      { ok: "Horario temporal eliminado", err: "No se pudo eliminar" });
    if (ok && adminId) logAdminAction(createClient(), adminId, "Eliminó horario temporal", target ? personName(target.user_id) : undefined);
  };

  const conTemporal = team.filter((p) => {
    const row = scheduleFor(schedules, p.id, today);
    return !!row && row.valid_until !== null;
  }).length;

  return (
    <>
      {!embedded && (
        <PageHeader title="Horarios" subtitle="Hora de entrada y horas objetivo por persona — crea horarios temporales para cubrir vacaciones u otros periodos" />
      )}

      <SectionIntro
        stats={[
          { label: "Personas", value: team.length },
          { label: "Con temporal hoy", value: conTemporal, tone: conTemporal > 0 ? "accent" : "default" },
          { label: "Vigentes", value: overrides.filter((o) => today >= o.valid_from && (!o.valid_until || today <= o.valid_until)).length },
        ]}
        tip="Los puntos bajo cada persona son su semana (L-D): vacío = sin horario, gris = horario base, morado = horario temporal ese día."
      />

      <section className="mb-7">
        <h2 className="text-[12px] font-bold mb-2.5" style={{ color: "var(--text-3)" }}>
          Horario base
        </h2>
        <div className="card p-2 flex flex-col gap-0.5">
          {team.map((p) => {
            const currentRow = scheduleFor(schedules, p.id, today);
            const current = currentRow ?? DEFAULT_SCHED;
            const isOverride = !!currentRow && currentRow.valid_until !== null;
            return (
              <PersonRow
                key={p.id}
                name={p.display_name}
                color={p.nexus_color}
                avatarUrl={p.avatar_url}
                birthday={isBirthdayToday(p.birth_date, todayISO())}
                meta={p.area ?? undefined}
                badges={<WeekStrip userId={p.id} schedules={schedules} today={today} />}
                right={
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-[13px] font-bold tabular-nums">{fmtTime(current.start_time)}</p>
                      <p className="text-[11px]" style={{ color: isOverride ? "var(--accent)" : "var(--text-3)" }}>
                        {fmtMin(current.target_min)}{isOverride ? " · temporal" : ""}
                      </p>
                    </div>
                    <button onClick={() => openEdit(p)}
                      className="px-3.5 py-2 rounded-full text-[12px] font-semibold shrink-0"
                      style={{ border: "1px solid var(--border-2)", color: "var(--text-2)" }}>
                      Editar
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>
            Horarios temporales
          </h2>
          <button
            className="btn-secondary text-[12.5px] px-3 py-1.5 flex items-center gap-1.5"
            onClick={() => { setAddForm({ personId: team[0]?.id ?? "", start: "16:00", hours: "5", from: "", to: "" }); setAddOpen(true); }}>
            <IconPlus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>

        {overrides.length === 0 ? (
          <EmptyState title="Sin horarios temporales" hint="Créalos para cubrir vacaciones u otros periodos con horas distintas — al terminar, la persona vuelve sola a su horario base" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {overrides.map((o) => {
              const status = today < o.valid_from ? "Próximo" : (o.valid_until && today > o.valid_until) ? "Vencido" : "Vigente";
              const tone = status === "Vigente" ? "ok" : status === "Próximo" ? "accent" : "muted";
              return (
                <div key={o.id} className="card p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold truncate">{personName(o.user_id)}</p>
                    <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--text-2)" }}>
                      {shortDate(o.valid_from)} – {o.valid_until ? shortDate(o.valid_until) : "—"} · {fmtTime(o.start_time)} · {fmtMin(o.target_min)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Pill tone={tone}>{status}</Pill>
                    {confirmId === o.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>¿Eliminar?</span>
                        <button disabled={saving} onClick={() => removeOverride(o.id)}
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
                      <button onClick={() => setConfirmId(o.id)} disabled={saving} aria-label="Eliminar"
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                        <IconX className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Sheet open={!!editing} onClose={() => setEditing(null)}
        title={`Horario de ${editing?.display_name ?? ""}`}
        subtitle="Horario permanente — aplica todos los días salvo que tenga un horario temporal vigente">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Field label="Hora de entrada">
            <TimePicker value={editForm.start}
              onChange={(v) => setEditForm({ ...editForm, start: v })} />
          </Field>
          <Field label="Horas objetivo por día">
            <input type="number" step="0.5" min="1" max="12" className="field-input" value={editForm.hours}
              onChange={(e) => setEditForm({ ...editForm, hours: e.target.value })} />
          </Field>
        </div>
        <button className="btn-primary w-full py-3" disabled={saving} onClick={saveEdit}>Guardar</button>
      </Sheet>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Horario temporal"
        subtitle="Para cubrir vacaciones u otros periodos con horas distintas">
        <div className="flex flex-col gap-3.5 mb-5">
          <Field label="Persona">
            <Select
              value={addForm.personId} onChange={(v) => setAddForm({ ...addForm, personId: v })}
              title="Seleccionar empleado"
              options={team.map((p) => ({
                value: p.id, label: p.display_name, sublabel: p.area ?? undefined,
                avatar: { name: p.display_name, color: p.nexus_color, avatarUrl: p.avatar_url },
              }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde">
              <DatePicker value={addForm.from} onChange={(v) => setAddForm({ ...addForm, from: v })} />
            </Field>
            <Field label="Hasta">
              <DatePicker value={addForm.to} minDate={addForm.from || undefined}
                onChange={(v) => setAddForm({ ...addForm, to: v })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora de entrada">
              <TimePicker value={addForm.start}
                onChange={(v) => setAddForm({ ...addForm, start: v })} />
            </Field>
            <Field label="Horas objetivo">
              <input type="number" step="0.5" min="1" max="12" className="field-input" value={addForm.hours}
                onChange={(e) => setAddForm({ ...addForm, hours: e.target.value })} />
            </Field>
          </div>
        </div>
        <button className="btn-primary w-full py-3" disabled={saving} onClick={saveAdd}>Crear horario temporal</button>
      </Sheet>
    </>
  );
}
