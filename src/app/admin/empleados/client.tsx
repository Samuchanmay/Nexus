"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, Department } from "@/lib/types";
import { useToast, Sheet, Pill, Avatar } from "@/components/ui";
import { IconUserPlus, IconPen } from "@/components/icons";
import { todayMerida } from "@/lib/tz";

const SPECIALTIES = ["video", "fotografia", "diseno", "difusion", "redaccion"];
const COLORS = ["#5856D6", "#FF3B30", "#FF8A00", "#0066FF", "#2FB344", "#AF52DE", "#FF2D55"];
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador", empleado: "Empleado", rh: "RH",
  coordinador: "Coordinador", departamento: "Departamento",
};
const AREA_TIPO: Record<string, "coordinacion" | "departamento" | null> = {
  coordinador: "coordinacion", departamento: "departamento",
  empleado: null, admin: null, rh: null,
};

function AreaSelect({ role, areas, value, onChange }: {
  role: string; areas: Department[]; value: string; onChange: (v: string) => void;
}) {
  const tipo = AREA_TIPO[role];
  if (!tipo) return null;
  const options = areas.filter((a) => a.tipo === tipo);
  const label = tipo === "coordinacion" ? "Coordinación" : "Departamento";
  return (
    <div>
      <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>{label}</label>
      <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— que la persona la elija al entrar —</option>
        {options.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
      </select>
    </div>
  );
}

export default function EmpleadosClient({ users, areas }: { users: UserProfile[]; areas: Department[] }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "", full_name: "", display_name: "", role: "empleado",
    area: "", area_id: "", color: COLORS[4], specialties: [] as string[],
    start: "09:00", end: "18:00", target: "480", balance: "0",
  });

  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({ role: "empleado", area_id: "" });
  const [editSaving, setEditSaving] = useState(false);

  const toggleSpec = (s: string) => setForm((f) => ({
    ...f, specialties: f.specialties.includes(s) ? f.specialties.filter((x) => x !== s) : [...f.specialties, s],
  }));

  const save = async () => {
    if (!form.email.trim() || !form.full_name.trim()) { toast("Correo y nombre son obligatorios"); return; }
    setSaving(true);
    const supabase = createClient();
    const requesterKind = AREA_TIPO[form.role] === "coordinacion" ? "coordinador"
      : AREA_TIPO[form.role] === "departamento" ? "departamento" : null;
    const { data: u, error } = await supabase.from("users").insert({
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name.trim(),
      display_name: form.display_name.trim() || form.full_name.split(" ")[0],
      role: form.role,
      requester_kind: requesterKind,
      area_id: form.area_id || null,
      nexus_clave: form.display_name.trim() || form.full_name.split(" ")[0],
      nexus_color: form.color,
      area: form.area || null,
      specialties: form.specialties,
      vacation_balance: parseInt(form.balance) || 0,
    }).select("id").single();
    if (error || !u) {
      toast(error?.code === "23505" ? "Ese correo ya está registrado" : "No se pudo guardar");
      setSaving(false); return;
    }
    if (["empleado", "admin"].includes(form.role)) {
      await supabase.from("schedules").insert({
        user_id: u.id, start_time: form.start, end_time: form.end,
        target_min: parseInt(form.target) || 480,
      });
    }
    setSaving(false); setOpen(false);
    toast("Persona agregada a la whitelist");
    router.refresh();
  };

  const toggleActive = async (u: UserProfile) => {
    const supabase = createClient();
    const { error } = await supabase.from("users")
      .update({ active: !u.active, termination_date: u.active ? todayMerida() : null })
      .eq("id", u.id);
    if (error) { toast("No se pudo actualizar"); return; }
    toast(u.active ? "Cuenta desactivada — su historial se conserva" : "Cuenta reactivada");
    router.refresh();
  };

  const openEdit = (u: UserProfile) => {
    setEditing(u);
    setEditForm({ role: u.role, area_id: u.area_id ?? "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    const supabase = createClient();
    const requesterKind = AREA_TIPO[editForm.role] === "coordinacion" ? "coordinador"
      : AREA_TIPO[editForm.role] === "departamento" ? "departamento" : null;
    const { error } = await supabase.from("users").update({
      role: editForm.role,
      requester_kind: requesterKind,
      area_id: AREA_TIPO[editForm.role] ? (editForm.area_id || null) : null,
    }).eq("id", editing.id);
    setEditSaving(false);
    if (error) { toast("No se pudo actualizar"); return; }
    toast("Perfil actualizado");
    setEditing(null);
    router.refresh();
  };

  const areaName = (u: UserProfile) => {
    if (u.area_id) return areas.find((a) => a.id === u.area_id)?.nombre;
    return u.area;
  };

  return (
    <>
      <header className="pt-8 pb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Empleados</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Solo los correos de esta lista pueden entrar a Nexus
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary px-5 py-2.5 text-[13.5px] flex items-center gap-2">
          <IconUserPlus className="w-4 h-4" /> Agregar persona
        </button>
      </header>

      <div className="flex flex-col gap-2.5">
        {users.map((u) => (
          <div key={u.id} className="card px-5 py-4 flex items-center justify-between gap-3 flex-wrap"
            style={!u.active ? { opacity: 0.55 } : undefined}>
            <div className="flex items-center gap-3">
              <Avatar name={u.display_name} color={u.nexus_color} size={38} />
              <div>
                <p className="text-[14px] font-bold">{u.title ? `${u.title} ${u.full_name}` : u.full_name}</p>
                <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                  {u.email} · {ROLE_LABELS[u.role]}{areaName(u) && ` · ${areaName(u)}`}
                  {!u.onboarded && " · Pendiente de completar perfil"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {!u.active && <Pill tone="muted">Inactivo</Pill>}
              {["coordinador", "departamento"].includes(u.role) && (
                <button onClick={() => openEdit(u)}
                  className="px-3.5 py-2 rounded-full text-[12px] font-semibold flex items-center gap-1.5"
                  style={{ border: "1px solid var(--border-2)", color: "var(--text-2)" }}>
                  <IconPen className="w-3.5 h-3.5" /> Editar
                </button>
              )}
              <button onClick={() => toggleActive(u)}
                className="px-4 py-2 rounded-full text-[12px] font-semibold"
                style={u.active
                  ? { background: "var(--danger-tint)", color: "var(--danger)" }
                  : { background: "var(--ok-tint)", color: "var(--ok)" }}>
                {u.active ? "Desactivar" : "Reactivar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Agregar persona">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Correo Google *</label>
            <input className="field-input" placeholder="nombre@cert.edu.mx" type="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Nombre completo *</label>
              <input className="field-input" placeholder="Nombre Apellido"
                value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Nombre corto</label>
              <input className="field-input" placeholder="Como aparece en la app"
                value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Rol</label>
              <select className="field-input" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value, area_id: "" })}>
                <option value="empleado">Empleado</option>
                <option value="rh">RH (solo lectura)</option>
                <option value="coordinador">Coordinador</option>
                <option value="departamento">Departamento</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {AREA_TIPO[form.role]
              ? <AreaSelect role={form.role} areas={areas} value={form.area_id}
                  onChange={(v) => setForm({ ...form, area_id: v })} />
              : (
                <div>
                  <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Área</label>
                  <input className="field-input" placeholder="Comunicación"
                    value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                </div>
              )}
          </div>

          {["empleado", "admin"].includes(form.role) && (
            <>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Especialidades</label>
                <div className="flex gap-1.5 flex-wrap">
                  {SPECIALTIES.map((s) => (
                    <button key={s} onClick={() => toggleSpec(s)}
                      className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold capitalize"
                      style={form.specialties.includes(s)
                        ? { background: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent)" }
                        : { border: "1px solid var(--border-2)", color: "var(--text-2)" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Entrada</label>
                  <input type="time" className="field-input" value={form.start}
                    onChange={(e) => setForm({ ...form, start: e.target.value })} />
                </div>
                <div>
                  <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Salida</label>
                  <input type="time" className="field-input" value={form.end}
                    onChange={(e) => setForm({ ...form, end: e.target.value })} />
                </div>
                <div>
                  <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Min objetivo</label>
                  <input type="number" className="field-input" value={form.target}
                    onChange={(e) => setForm({ ...form, target: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Saldo vacaciones</label>
                  <input type="number" className="field-input" value={form.balance}
                    onChange={(e) => setForm({ ...form, balance: e.target.value })} />
                </div>
                <div>
                  <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Color</label>
                  <div className="flex gap-1.5 items-center h-[46px]">
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setForm({ ...form, color: c })}
                        aria-label={`Color ${c}`}
                        className="w-7 h-7 rounded-full transition-transform"
                        style={{
                          background: c,
                          transform: form.color === c ? "scale(1.2)" : "scale(1)",
                          border: form.color === c ? "2.5px solid var(--text-1)" : "2.5px solid transparent",
                        }} />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {AREA_TIPO[form.role] && (
            <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
              Si dejas el área en blanco, la persona la elegirá ella misma la primera vez que entre.
            </p>
          )}

          <div className="flex gap-2.5 mt-1">
            <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={saving} onClick={save}>
              {saving ? "Guardando…" : "Agregar a la whitelist"}
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)}
        title={editing ? `Editar · ${editing.full_name}` : "Editar"}>
        {editing && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Rol</label>
              <select className="field-input" value={editForm.role}
                onChange={(e) => setEditForm({ role: e.target.value, area_id: "" })}>
                <option value="coordinador">Coordinador</option>
                <option value="departamento">Departamento</option>
                <option value="empleado">Empleado</option>
                <option value="rh">RH (solo lectura)</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {AREA_TIPO[editForm.role] && (
              <AreaSelect role={editForm.role} areas={areas} value={editForm.area_id}
                onChange={(v) => setEditForm({ ...editForm, area_id: v })} />
            )}
            <div className="flex gap-2.5 mt-1">
              <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={editSaving} onClick={saveEdit}>
                {editSaving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
