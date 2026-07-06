"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types";
import { useToast, Sheet, Pill, Avatar } from "@/components/ui";
import { IconUserPlus } from "@/components/icons";
import { todayMerida } from "@/lib/tz";

const SPECIALTIES = ["video", "fotografia", "diseno", "difusion", "redaccion"];
const COLORS = ["#5856D6", "#FF3B30", "#FF8A00", "#0066FF", "#2FB344", "#AF52DE", "#FF2D55"];
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador", empleado: "Empleado", rh: "RH",
  coordinador: "Coordinador", departamento: "Departamento",
};

export default function EmpleadosClient({ users }: { users: UserProfile[] }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "", full_name: "", display_name: "", role: "empleado",
    area: "", color: COLORS[4], specialties: [] as string[],
    start: "09:00", end: "18:00", target: "480", balance: "0",
  });

  const toggleSpec = (s: string) => setForm((f) => ({
    ...f, specialties: f.specialties.includes(s) ? f.specialties.filter((x) => x !== s) : [...f.specialties, s],
  }));

  const save = async () => {
    if (!form.email.trim() || !form.full_name.trim()) { toast("Correo y nombre son obligatorios"); return; }
    setSaving(true);
    const supabase = createClient();
    const { data: u, error } = await supabase.from("users").insert({
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name.trim(),
      display_name: form.display_name.trim() || form.full_name.split(" ")[0],
      role: form.role,
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
                <p className="text-[14px] font-bold">{u.full_name}</p>
                <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                  {u.email} · {ROLE_LABELS[u.role]}{u.area && ` · ${u.area}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {!u.active && <Pill tone="muted">Inactivo</Pill>}
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
              <select className="field-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="empleado">Empleado</option>
                <option value="rh">RH (solo lectura)</option>
                <option value="coordinador">Coordinador</option>
                <option value="departamento">Departamento</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Área</label>
              <input className="field-input" placeholder="Comunicación"
                value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
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

          <div className="flex gap-2.5 mt-1">
            <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={saving} onClick={save}>
              {saving ? "Guardando…" : "Agregar a la whitelist"}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
