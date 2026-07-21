"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, Department } from "@/lib/types";
import { useToast, Sheet, Avatar, SelectField } from "@/components/ui";
import { IconUserPlus, IconCamera } from "@/components/icons";
import { Switch } from "@/components/shared";
import { todayMerida } from "@/lib/tz";
import { PALETTE, nextAvailableColor } from "@/lib/colors";

const NIVEL_LABELS: Record<string, string> = {
  licenciatura: "Licenciatura", centro_educativo: "Centro Educativo", posgrado: "Posgrado",
};

const SPECIALTIES = ["video", "fotografia", "diseno", "difusion", "redaccion"];
const SPECIALTY_LABELS: Record<string, string> = {
  video: "Video", fotografia: "Fotografía", diseno: "Diseño", difusion: "Difusión", redaccion: "Redacción",
};
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
    <SelectField label={label} value={value} onChange={onChange}>
      <option value="">— que la persona la elija al entrar —</option>
      {options.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
    </SelectField>
  );
}

export default function EmpleadosClient({ users, areas, rhColor }: { users: UserProfile[]; areas: Department[]; rhColor: string | null }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const usedLockedColors = [...areas.map((a) => a.color), rhColor];
  const availableColors = PALETTE.filter((c) => !usedLockedColors.some((u) => u?.toUpperCase() === c.toUpperCase()));
  const [form, setForm] = useState({
    email: "", full_name: "", display_name: "", title: "", honorific: "", hire_date: "", role: "empleado",
    area: "", area_id: "", nivel: "licenciatura", color: nextAvailableColor(usedLockedColors), specialties: [] as string[],
    start: "09:00", end: "18:00", targetHours: "8", balance: "0",
  });

  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({
    role: "empleado", area_id: "", nivel: "licenciatura", balance: "0", daysPerYear: "0",
    fullName: "", displayName: "", title: "", honorific: "", hireDate: "", birthDate: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const toggleSpec = (s: string) => setForm((f) => ({
    ...f, specialties: f.specialties.includes(s) ? f.specialties.filter((x) => x !== s) : [...f.specialties, s],
  }));

  const isEquipo = form.role === "empleado";

  /** Color final que se guarda: RH y coordinador/departamento lo heredan de
      su grupo (bloqueado); empleado lo elige a mano entre los disponibles. */
  const resolvedColor = (): string | null => {
    if (form.role === "rh") return rhColor;
    if (AREA_TIPO[form.role]) return areas.find((a) => a.id === form.area_id)?.color ?? null;
    return form.color;
  };

  const save = async () => {
    if (!form.email.trim() || !form.full_name.trim()) { toast("Correo y nombre son obligatorios"); return; }
    setSaving(true);
    const supabase = createClient();
    const requesterKind = AREA_TIPO[form.role] === "coordinacion" ? "coordinador"
      : AREA_TIPO[form.role] === "departamento" ? "departamento" : null;
    const targetMin = isEquipo ? Math.max(1, Math.round((parseFloat(form.targetHours) || 8) * 60)) : 480;
    const { data: u, error } = await supabase.from("users").insert({
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name.trim(),
      display_name: form.display_name.trim() || form.full_name.split(" ")[0],
      role: form.role,
      requester_kind: requesterKind,
      area_id: form.area_id || null,
      nexus_clave: form.display_name.trim() || form.full_name.split(" ")[0],
      nexus_color: resolvedColor(),
      nivel: form.role === "coordinador" ? form.nivel : null,
      area: form.area || null,
      specialties: isEquipo ? form.specialties : [],
      vacation_balance: parseInt(form.balance) || 0,
      title: form.title.trim() || null,
      honorific: form.honorific.trim() || null,
      hire_date: form.hire_date || null,
    }).select("id").single();
    if (error || !u) {
      toast(error?.code === "23505" ? "Ese correo ya está registrado" : "No se pudo guardar");
      setSaving(false); return;
    }
    if (isEquipo) {
      await supabase.from("schedules").insert({
        user_id: u.id, start_time: form.start, end_time: form.end,
        target_min: targetMin,
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
    setEditForm({
      role: u.role, area_id: u.area_id ?? "", nivel: u.nivel ?? "licenciatura",
      balance: String(u.vacation_balance ?? 0), daysPerYear: String(u.vacation_days_per_year ?? 0),
      fullName: u.full_name ?? "", displayName: u.display_name ?? "", title: u.title ?? "",
      honorific: u.honorific ?? "",
      hireDate: u.hire_date ?? "", birthDate: u.birth_date ?? "",
    });
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
      nivel: editForm.role === "coordinador" ? editForm.nivel : null,
      vacation_balance: parseInt(editForm.balance) || 0,
      vacation_days_per_year: parseInt(editForm.daysPerYear) || 0,
      full_name: editForm.fullName.trim() || editing.full_name,
      display_name: editForm.displayName.trim() || editing.display_name,
      title: editForm.title.trim() || null,
      honorific: editForm.honorific.trim() || null,
      hire_date: editForm.hireDate || null,
      birth_date: editForm.birthDate || null,
    }).eq("id", editing.id);
    setEditSaving(false);
    if (error) { toast("No se pudo actualizar"); return; }
    toast("Perfil actualizado");
    setEditing(null);
    router.refresh();
  };

  /** Foto subida por el admin a nombre de OTRA persona — vive en team/<id>.<ext>
      del bucket avatars (distinto del auth.uid()/avatar.<ext> que usa cada quien
      para su propia foto vía ProfileModal), para no depender de que la persona
      ya haya iniciado sesión con Google. */
  const uploadTeamPhoto = async (file: File) => {
    if (!editing) return;
    setAvatarUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `team/${editing.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      toast(`No se pudo subir la foto: ${upErr.message}`);
      setAvatarUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const { error } = await supabase.from("users").update({ avatar_url: url }).eq("id", editing.id);
    setAvatarUploading(false);
    if (error) { toast("La foto se subió pero no se pudo guardar"); return; }
    setEditing({ ...editing, avatar_url: url });
    toast("Foto actualizada");
    router.refresh();
  };

  const areaName = (u: UserProfile) => {
    if (u.area_id) return areas.find((a) => a.id === u.area_id)?.nombre;
    return u.area;
  };

  const administradores = users.filter((u) => u.role === "admin");
  const equipo = users.filter((u) => u.role === "empleado");
  const coordinadores = users.filter((u) => u.role === "coordinador");
  const otrosGrupos: { label: string; list: UserProfile[] }[] = [
    { label: "Coordinadores Licenciatura", list: coordinadores.filter((u) => (u.nivel ?? "licenciatura") === "licenciatura") },
    { label: "Coordinadores Centro Educativo", list: coordinadores.filter((u) => u.nivel === "centro_educativo") },
    { label: "Coordinadores Posgrados", list: coordinadores.filter((u) => u.nivel === "posgrado") },
    { label: "Departamentos", list: users.filter((u) => u.role === "departamento") },
    { label: "RH", list: users.filter((u) => u.role === "rh") },
  ];

  const Row = ({ u }: { u: UserProfile }) => (
    <div className="card px-5 py-4 flex items-center justify-between gap-3 flex-wrap"
      style={!u.active ? { opacity: 0.55 } : undefined}>
      <div className="flex items-center gap-3">
        <Avatar name={u.display_name} color={u.nexus_color} size={38} avatarUrl={u.avatar_url} />
        <div>
          <p className="text-[14px] font-bold">{u.honorific ? `${u.honorific} ${u.full_name}` : u.full_name}</p>
          {u.title && (
            <p className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>{u.title}</p>
          )}
          <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
            {u.email}
            {!u.onboarded && " · Pendiente de completar perfil"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <button onClick={() => openEdit(u)}
          className="px-3.5 py-2 rounded-full text-[12px] font-semibold"
          style={{ border: "1px solid var(--border-2)", color: "var(--text-2)" }}>
          Editar
        </button>
        <Switch tone="status" checked={u.active} onChange={() => toggleActive(u)}
          label={u.active ? "Activo" : "Inactivo"} />
      </div>
    </div>
  );

  return (
    <>
      <header className="pt-8 pb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Equipo</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Solo los correos de esta lista pueden entrar a Nexus
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary px-5 py-2.5 text-[13.5px] flex items-center gap-2">
          <IconUserPlus className="w-4 h-4" /> Agregar personal
        </button>
      </header>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
            Administrador · {administradores.length}
          </p>
          {administradores.length === 0 ? (
            <p className="text-[13px] py-3" style={{ color: "var(--text-3)" }}>Sin registros</p>
          ) : administradores.map((u) => <Row key={u.id} u={u} />)}
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
            Equipo · {equipo.length}
          </p>
          {equipo.length === 0 ? (
            <p className="text-[13px] py-3" style={{ color: "var(--text-3)" }}>Sin personas en el equipo todavía</p>
          ) : equipo.map((u) => <Row key={u.id} u={u} />)}
        </div>

        {otrosGrupos.map((g) => (
          <div key={g.label} className="flex flex-col gap-2.5">
            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
              {g.label} · {g.list.length}
            </p>
            {g.list.length === 0 ? (
              <p className="text-[13px] py-3" style={{ color: "var(--text-3)" }}>Sin registros</p>
            ) : g.list.map((u) => <Row key={u.id} u={u} />)}
          </div>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Agregar personal">
        <div className="flex flex-col gap-3">
          <SelectField label="¿A quién agregas?" value={form.role}
            onChange={(v) => setForm({ ...form, role: v, area_id: "" })}>
            <option value="empleado">Equipo (empleado)</option>
            <option value="rh">RH (solo lectura)</option>
            <option value="coordinador">Coordinador</option>
            <option value="departamento">Departamento</option>
            <option value="admin">Administrador</option>
          </SelectField>

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

          {!isEquipo && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Honorífico</label>
                <input className="field-input" placeholder="Dr., Dra., Mtro., Mtra."
                  value={form.honorific} onChange={(e) => setForm({ ...form, honorific: e.target.value })} />
              </div>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Cargo</label>
                <input className="field-input" placeholder="Ej. Coordinador en Enfermería"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
            </div>
          )}

          {isEquipo && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Cargo</label>
                <input className="field-input" placeholder="Ej. Coordinador de Video"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de ingreso</label>
                <input type="date" className="field-input" value={form.hire_date}
                  onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
              </div>
            </div>
          )}

          {!isEquipo && (
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de ingreso</label>
              <input type="date" className="field-input" value={form.hire_date}
                onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
            </div>
          )}

          {AREA_TIPO[form.role]
            ? <AreaSelect role={form.role} areas={areas} value={form.area_id}
                onChange={(v) => setForm({ ...form, area_id: v })} />
            : isEquipo ? (
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Área</label>
                <input className="field-input" placeholder="Comunicación"
                  value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
              </div>
            ) : null}

          {form.role === "coordinador" && (
            <SelectField label="Nivel educativo" value={form.nivel}
              onChange={(v) => setForm({ ...form, nivel: v })}>
              {Object.entries(NIVEL_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </SelectField>
          )}

          {isEquipo && (
            <>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Especialidades</label>
                <div className="flex gap-1.5 flex-wrap">
                  {SPECIALTIES.map((s) => (
                    <button key={s} onClick={() => toggleSpec(s)}
                      className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold"
                      style={form.specialties.includes(s)
                        ? { background: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent)" }
                        : { border: "1px solid var(--border-2)", color: "var(--text-2)" }}>
                      {SPECIALTY_LABELS[s]}
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
                  <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Objetivo (horas)</label>
                  <input type="number" step="0.5" min="1" max="16" className="field-input" value={form.targetHours}
                    onChange={(e) => setForm({ ...form, targetHours: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Saldo vacaciones</label>
                <input type="number" className="field-input" value={form.balance}
                  onChange={(e) => setForm({ ...form, balance: e.target.value })} />
              </div>
            </>
          )}

          {AREA_TIPO[form.role] && (
            <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
              Si dejas el área en blanco, la persona la elegirá ella misma la primera vez que entre — su color se
              asigna automático en cuanto elija.
            </p>
          )}

          {/* Color — bloqueado y automático por grupo (RH, coordinación/departamento);
              libre solo para colaboradores de Equipo, y excluye los colores ya tomados. */}
          {form.role !== "admin" && (
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Color</label>
              {form.role === "rh" ? (
                <div className="flex items-center gap-2 h-[38px]">
                  <span className="w-7 h-7 rounded-full shrink-0" style={{ background: rhColor ?? "#8E8E93" }} />
                  <span className="text-[12px]" style={{ color: "var(--text-3)" }}>Color de grupo de RH</span>
                </div>
              ) : AREA_TIPO[form.role] ? (
                form.area_id ? (
                  <div className="flex items-center gap-2 h-[38px]">
                    <span className="w-7 h-7 rounded-full shrink-0"
                      style={{ background: areas.find((a) => a.id === form.area_id)?.color ?? "#8E8E93" }} />
                    <span className="text-[12px]" style={{ color: "var(--text-3)" }}>Color del área — automático</span>
                  </div>
                ) : (
                  <p className="text-[12px] h-[38px] flex items-center" style={{ color: "var(--text-3)" }}>
                    Se asignará cuando elija su área
                  </p>
                )
              ) : (
                <div className="flex gap-1.5 items-center flex-wrap">
                  {availableColors.map((c) => (
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
              )}
            </div>
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
            <div className="flex flex-col items-center gap-2 mb-1">
              <div className="relative">
                <Avatar name={editing.display_name} color={editing.nexus_color} size={72} avatarUrl={editing.avatar_url} />
                <button onClick={() => avatarFileRef.current?.click()} disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-accent text-white grid place-items-center border-2 disabled:opacity-50"
                  style={{ borderColor: "var(--panel)" }}
                  aria-label="Cambiar foto" title="Cambiar foto">
                  <IconCamera className="w-3.5 h-3.5" />
                </button>
                <input ref={avatarFileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTeamPhoto(f); }} />
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                {avatarUploading ? "Subiendo…" : "Foto de perfil"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Nombre completo</label>
                <input className="field-input" value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
              </div>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Nombre corto</label>
                <input className="field-input" value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Honorífico</label>
                <input className="field-input" placeholder="Dr., Dra., Mtro., Mtra."
                  value={editForm.honorific} onChange={(e) => setEditForm({ ...editForm, honorific: e.target.value })} />
              </div>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Cargo</label>
                <input className="field-input" placeholder="Ej. Coordinador en Enfermería"
                  value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de ingreso</label>
                <input type="date" className="field-input" value={editForm.hireDate}
                  onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })} />
              </div>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de cumpleaños</label>
                <input type="date" className="field-input" value={editForm.birthDate}
                  onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} />
              </div>
            </div>
            <SelectField label="Rol" value={editForm.role}
              onChange={(v) => setEditForm({ ...editForm, role: v, area_id: "" })}>
              <option value="coordinador">Coordinador</option>
              <option value="departamento">Departamento</option>
              <option value="empleado">Empleado</option>
              <option value="rh">RH (solo lectura)</option>
              <option value="admin">Administrador</option>
            </SelectField>
            {AREA_TIPO[editForm.role] && (
              <AreaSelect role={editForm.role} areas={areas} value={editForm.area_id}
                onChange={(v) => setEditForm({ ...editForm, area_id: v })} />
            )}
            {editForm.role === "coordinador" && (
              <SelectField label="Nivel educativo" value={editForm.nivel}
                onChange={(v) => setEditForm({ ...editForm, nivel: v })}>
                {Object.entries(NIVEL_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </SelectField>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                  Saldo actual (días)
                </label>
                <input type="number" className="field-input" value={editForm.balance}
                  onChange={(e) => setEditForm({ ...editForm, balance: e.target.value })} />
              </div>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                  Días asignados/año
                </label>
                <input type="number" className="field-input" value={editForm.daysPerYear}
                  onChange={(e) => setEditForm({ ...editForm, daysPerYear: e.target.value })} />
              </div>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
              Ajusta el saldo aquí solo para correcciones manuales — la aprobación de solicitudes ya lo descuenta automáticamente.
            </p>
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
