"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, Department } from "@/lib/types";
import { useToast, Sheet, Avatar, SelectField, DatePicker, Menu, MenuItem } from "@/components/ui";
import {
  IconUserPlus, IconCamera, IconChevronLeft, IconClipboard, IconPen, IconCalendar, IconX,
  IconMail, IconPhone, IconBuilding,
} from "@/components/icons";
import { Switch, PersonRow } from "@/components/shared";
import { ImageCropper } from "@/components/os/image-cropper";
import { todayMerida, dmy } from "@/lib/tz";
import { PALETTE, nextAvailableColor } from "@/lib/colors";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { useHeaderAction } from "@/lib/header-actions";
import { KIND_LABELS } from "@/lib/ui-maps";

/** Los roles "Equipo" (empleado) y Administrador son los que realmente
    administramos día a día (asistencia, vacaciones, incidencias) — reciben
    la ficha completa. Coordinador/Departamento/RH son Directorio Institucional:
    solo lookup de contacto, sin cargar datos que nunca se usan aquí. */
const isFullDrawerRole = (role: string) => role === "empleado" || role === "admin";

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

export default function EmpleadosClient({ users, areas, rhColor, vacationTodayIds, permisoTodayIds }: {
  users: UserProfile[]; areas: Department[]; rhColor: string | null;
  vacationTodayIds: string[]; permisoTodayIds: string[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  useHeaderAction(
    <button onClick={() => setOpen(true)} className="btn-primary px-3.5 h-8 text-[13px] flex items-center gap-1.5">
      <IconUserPlus className="w-3.5 h-3.5" /> Nuevo colaborador
    </button>
  );
  const vacationTodaySet = new Set(vacationTodayIds);
  const permisoTodaySet = new Set(permisoTodayIds);
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
    phone: "", extension: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"todos" | "admin" | "equipo" | "coordinador" | "departamento" | "rh">("todos");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (label: string) => setCollapsed((c) => ({ ...c, [label]: !c[label] }));
  const copyEmail = (email: string) => {
    navigator.clipboard?.writeText(email);
    toast("Correo copiado");
  };

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
    if (!form.email.trim() || !form.full_name.trim()) { toast("Correo y nombre son obligatorios", "warn"); return; }
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
      toast(error?.code === "23505" ? "Ese correo ya está registrado" : "No se pudo guardar", "danger");
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
    if (error) { toast("No se pudo actualizar", "danger"); return; }
    toast(u.active ? "Cuenta desactivada — su historial se conserva" : "Cuenta reactivada");
    router.refresh();
  };

  // Desactivar SIEMPRE pide confirmación antes de guardar (nunca al primer
  // click sobre el switch) — reactivar puede ser inmediato, no hay riesgo.
  const [confirmUser, setConfirmUser] = useState<UserProfile | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const requestToggle = (u: UserProfile) => {
    if (u.active) { setConfirmUser(u); return; }
    toggleActive(u);
  };
  const confirmDeactivate = async () => {
    if (!confirmUser) return;
    setConfirmBusy(true);
    await toggleActive(confirmUser);
    setConfirmBusy(false);
    setConfirmUser(null);
  };

  /** Punto de estado junto al avatar — independiente del switch, prioridad:
      baja > vacaciones > permiso > invitación pendiente (nunca inició sesión) > activo. */
  const rowStatus = (u: UserProfile): { color: string; label: string } => {
    if (!u.active) return { color: "var(--danger)", label: "Baja" };
    if (vacationTodaySet.has(u.id)) return { color: "var(--purple)", label: "Vacaciones" };
    if (permisoTodaySet.has(u.id)) return { color: "var(--warn)", label: "Permiso" };
    if (!u.auth_id) return { color: "#AEAEB2", label: "Invitación pendiente" };
    return { color: "var(--ok)", label: "Activo" };
  };

  // Detalle completo (vacaciones + incidencias) SOLO se consulta cuando se abre
  // a alguien de Equipo/Administrador — el Directorio Institucional nunca lo
  // necesita, así que nunca se pide (punto "Optimiza las consultas").
  const [fullDetail, setFullDetail] = useState<{
    vacations: { id: string; start_date: string; end_date: string; days: number; status: string }[];
    incidents: { id: string; kind: string; start_date: string; end_date: string; status: string }[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const openEdit = (u: UserProfile) => {
    setEditing(u);
    setFullDetail(null);
    setEditForm({
      role: u.role, area_id: u.area_id ?? "", nivel: u.nivel ?? "licenciatura",
      balance: String(u.vacation_balance ?? 0), daysPerYear: String(u.vacation_days_per_year ?? 0),
      fullName: u.full_name ?? "", displayName: u.display_name ?? "", title: u.title ?? "",
      honorific: u.honorific ?? "", phone: u.phone ?? "", extension: u.extension ?? "",
      hireDate: u.hire_date ?? "", birthDate: u.birth_date ?? "",
    });
    if (isFullDrawerRole(u.role)) {
      setLoadingDetail(true);
      const supabase = createClient();
      Promise.all([
        supabase.from("vacations").select("id,start_date,end_date,days,status")
          .eq("user_id", u.id).is("archived_at", null).order("start_date", { ascending: false }).limit(8),
        supabase.from("incidents").select("id,kind,start_date,end_date,status")
          .eq("user_id", u.id).order("start_date", { ascending: false }).limit(8),
      ]).then(([v, i]) => {
        setFullDetail({
          vacations: (v.data ?? []) as NonNullable<typeof fullDetail>["vacations"],
          incidents: (i.data ?? []) as NonNullable<typeof fullDetail>["incidents"],
        });
        setLoadingDetail(false);
      });
    }
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
      phone: editForm.phone.trim() || null,
      extension: editForm.extension.trim() || null,
      hire_date: editForm.hireDate || null,
      birth_date: editForm.birthDate || null,
    }).eq("id", editing.id);
    setEditSaving(false);
    if (error) { toast("No se pudo actualizar", "danger"); return; }
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
      toast(`No se pudo subir la foto: ${upErr.message}`, "danger");
      setAvatarUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const { error } = await supabase.from("users").update({ avatar_url: url }).eq("id", editing.id);
    setAvatarUploading(false);
    if (error) { toast("La foto se subió pero no se pudo guardar", "danger"); return; }
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

  type GroupKey = "admin" | "equipo" | "coordinador" | "departamento" | "rh";
  const groups: { key: GroupKey; label: string; list: UserProfile[] }[] = [
    { key: "admin", label: "Administrador", list: administradores },
    { key: "equipo", label: "Equipo", list: equipo },
    { key: "coordinador", label: "Coordinadores Licenciatura", list: coordinadores.filter((u) => (u.nivel ?? "licenciatura") === "licenciatura") },
    { key: "coordinador", label: "Coordinadores Centro Educativo", list: coordinadores.filter((u) => u.nivel === "centro_educativo") },
    { key: "coordinador", label: "Coordinadores Posgrados", list: coordinadores.filter((u) => u.nivel === "posgrado") },
    { key: "departamento", label: "Departamentos", list: users.filter((u) => u.role === "departamento") },
    { key: "rh", label: "RH", list: users.filter((u) => u.role === "rh") },
  ];

  const q = search.trim().toLowerCase();
  const matches = (u: UserProfile) => {
    if (!q) return true;
    const dept = areaName(u) ?? u.area ?? "";
    return [u.full_name, u.display_name, u.email, u.title, dept]
      .some((v) => (v ?? "").toLowerCase().includes(q));
  };

  const ROLE_CHIPS: { key: typeof roleFilter; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: users.length },
    { key: "admin", label: "Administrador", count: administradores.length },
    { key: "equipo", label: "Equipo", count: equipo.length },
    { key: "coordinador", label: "Coordinadores", count: coordinadores.length },
    { key: "departamento", label: "Departamentos", count: users.filter((u) => u.role === "departamento").length },
    { key: "rh", label: "RH", count: users.filter((u) => u.role === "rh").length },
  ];

  // Fila de Equipo — usa el PersonRow compartido (mismo componente que
  // Horarios) en vez de un <div role="button"> a medida: ese envoltorio con
  // rol de botón conteniendo OTROS controles interactivos (switch, menú,
  // botones de acción) es un patrón de ARIA inválido — "interactivo dentro de
  // interactivo" — y es la causa más probable del bloqueo/comportamiento
  // errático reportado al pasar el mouse o intentar salir del detalle.
  // PersonRow es un <div onClick> sencillo: sin tabIndex ni rol falso.
  const Row = ({ u }: { u: UserProfile }) => {
    const dept = areaName(u) ?? u.area;
    const status = rowStatus(u);
    return (
      <PersonRow
        name={u.honorific ? `${u.honorific} ${u.full_name}` : u.full_name}
        color={u.nexus_color}
        avatarUrl={u.avatar_url}
        birthday={isBirthdayToday(u.birth_date, todayISO())}
        status={status.color}
        statusLabel={status.label}
        onClick={() => openEdit(u)}
        dense
        dim={!u.active}
        badges={
          <div className="flex items-center gap-1.5 flex-wrap mt-[3px]">
            {u.title && (
              <span className="px-1.5 py-[1px] rounded-full text-[10.5px] font-semibold shrink-0"
                style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>{u.title}</span>
            )}
            {dept && (
              <span className="px-1.5 py-[1px] rounded-full text-[10.5px] font-semibold shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>{dept}</span>
            )}
            {!u.onboarded && (
              <span className="px-1.5 py-[1px] rounded-full text-[10.5px] font-semibold shrink-0"
                style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>Perfil incompleto</span>
            )}
          </div>
        }
        hoverActions={
          <>
            <button
              onClick={() => openEdit(u)}
              title="Editar" aria-label="Editar"
              className="h-7 w-7 rounded-full grid place-items-center hover:bg-surface-3"
              style={{ color: "var(--text-3)" }}>
              <IconPen className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => router.push("/admin/vacaciones")}
              title="Vacaciones" aria-label="Vacaciones"
              className="h-7 w-7 rounded-full grid place-items-center hover:bg-surface-3"
              style={{ color: "var(--text-3)" }}>
              <IconCalendar className="w-3.5 h-3.5" />
            </button>
            <Menu
              align="right"
              trigger={({ onClick }) => (
                <button onClick={onClick} title="Más acciones" aria-label="Más acciones"
                  className="h-7 w-7 rounded-full grid place-items-center hover:bg-surface-3"
                  style={{ color: "var(--text-3)" }}>
                  <span className="text-[15px] leading-none font-bold">⋯</span>
                </button>
              )}>
              <MenuItem icon={<IconClipboard className="w-4 h-4" />} onClick={() => copyEmail(u.email)}>
                Copiar correo
              </MenuItem>
              <MenuItem
                icon={<IconX className="w-4 h-4" />}
                danger={u.active}
                onClick={() => requestToggle(u)}>
                {u.active ? "Desactivar cuenta" : "Reactivar cuenta"}
              </MenuItem>
            </Menu>
          </>
        }
        right={
          <span onClick={(e) => e.stopPropagation()}>
            <Switch tone="status" checked={u.active} onChange={() => requestToggle(u)} />
          </span>
        }
      />
    );
  };

  const Group = ({ g }: { g: { key: GroupKey; label: string; list: UserProfile[] } }) => {
    if (roleFilter !== "todos" && g.key !== roleFilter) return null;
    const filtered = g.list.filter(matches);
    if (q && filtered.length === 0) return null;
    const isCollapsed = !q && !!collapsed[g.label];
    return (
      <div className="flex flex-col gap-2.5">
        <button onClick={() => toggleGroup(g.label)}
          className="flex items-center gap-2 text-left w-fit">
          <span className="transition-transform duration-200" style={{ color: "var(--text-3)", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
            <IconChevronLeft className="w-3 h-3 -rotate-90" />
          </span>
          <div>
            <p className="text-[12.5px] font-bold leading-tight">{g.label}</p>
            <p className="text-[10.5px] font-semibold leading-tight" style={{ color: "var(--text-3)" }}>
              {filtered.length} colaborador{filtered.length === 1 ? "" : "es"}
            </p>
          </div>
        </button>
        {/* Grid-rows 0fr/1fr: acordeón CSS-only, sin medir alturas — fade + slide suaves (punto 14) */}
        <div className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr" }}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2.5 transition-opacity duration-200"
              style={{ opacity: isCollapsed ? 0 : 1 }}>
              {filtered.length === 0 ? (
                <p className="text-[13px] py-3" style={{ color: "var(--text-3)" }}>Sin registros</p>
              ) : filtered.map((u) => <Row key={u.id} u={u} />)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Equipo</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          {users.length} colaborador{users.length === 1 ? "" : "es"}
          {" "}&bull;{" "}
          {users.filter((u) => u.active).length} activo{users.filter((u) => u.active).length === 1 ? "" : "s"}
          {users.some((u) => !u.onboarded) && (
            <> {" "}&bull;{" "} {users.filter((u) => !u.onboarded).length} perfil{users.filter((u) => !u.onboarded).length === 1 ? "" : "es"} incompleto{users.filter((u) => !u.onboarded).length === 1 ? "" : "s"}</>
          )}
        </p>
      </header>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <input className="field-input text-[12.5px] w-[220px]" placeholder="Buscar por nombre, correo, cargo o área…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex items-center gap-1.5 flex-wrap">
          {ROLE_CHIPS.map((c) => (
            <button key={c.key} onClick={() => setRoleFilter(c.key)}
              className="px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-colors"
              style={roleFilter === c.key
                ? { background: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent)" }
                : { border: "1px solid var(--border-2)", color: "var(--text-2)" }}>
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {groups.map((g) => <Group key={g.label} g={g} />)}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Nuevo colaborador">
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
                <DatePicker value={form.hire_date} onChange={(v) => setForm({ ...form, hire_date: v })} />
              </div>
            </div>
          )}

          {!isEquipo && (
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de ingreso</label>
              <DatePicker value={form.hire_date} onChange={(v) => setForm({ ...form, hire_date: v })} />
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
        title={editing ? (editing.honorific ? `${editing.honorific} ${editing.full_name}` : editing.full_name) : "Editar"}
        subtitle={editing ? (isFullDrawerRole(editing.role) ? "Equipo" : "Directorio institucional") : undefined}>
        {editing && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col items-center gap-2 mb-1">
              <div className="relative">
                <Avatar name={editing.display_name} color={editing.nexus_color} size={72} avatarUrl={editing.avatar_url} birthday={isBirthdayToday(editing.birth_date, todayISO())} />
                <button onClick={() => avatarFileRef.current?.click()} disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-accent text-white grid place-items-center border-2 disabled:opacity-50"
                  style={{ borderColor: "var(--panel)" }}
                  aria-label="Cambiar foto" title="Cambiar foto">
                  <IconCamera className="w-3.5 h-3.5" />
                </button>
                <input ref={avatarFileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = ""; }} />
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                {avatarUploading ? "Subiendo…" : "Foto de perfil"}
              </p>
            </div>

            {!isFullDrawerRole(editing.role) ? (
              /* ── Directorio Institucional — solo lookup, sin asistencia/vacaciones/
                 incidencias/horarios/carga: esos datos nunca se usan aquí. ── */
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm" style={{ background: "var(--surface-2)" }}>
                    <IconBuilding className="w-4 h-4 shrink-0 text-[var(--text-3)]" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold" style={{ color: "var(--text-3)" }}>Departamento</p>
                      <p className="text-[13px] font-semibold truncate">{(editing.area_id ? areas.find((a) => a.id === editing.area_id)?.nombre : editing.area) ?? "—"}</p>
                    </div>
                  </div>
                  <a href={`mailto:${editing.email}`} className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm hover:bg-hover transition-colors" style={{ background: "var(--surface-2)" }}>
                    <IconMail className="w-4 h-4 shrink-0 text-[var(--text-3)]" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold" style={{ color: "var(--text-3)" }}>Correo</p>
                      <p className="text-[13px] font-semibold truncate">{editing.email}</p>
                    </div>
                  </a>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm" style={{ background: "var(--surface-2)" }}>
                      <IconPhone className="w-4 h-4 shrink-0 text-[var(--text-3)]" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold" style={{ color: "var(--text-3)" }}>Teléfono</p>
                        <p className="text-[13px] font-semibold truncate">{editing.phone ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm" style={{ background: "var(--surface-2)" }}>
                      <IconClipboard className="w-4 h-4 shrink-0 text-[var(--text-3)]" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold" style={{ color: "var(--text-3)" }}>Extensión</p>
                        <p className="text-[13px] font-semibold truncate">{editing.extension ?? "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* La administración (rol/área/nombramiento/contacto) queda un nivel
                    abajo — el directorio prioriza la consulta rápida, no la edición. */}
                <details className="group/fold">
                  <summary className="text-[12px] font-semibold cursor-pointer list-none flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                    <IconChevronLeft className="w-3 h-3 -rotate-90 transition-transform group-open/fold:rotate-90" />
                    Editar información
                  </summary>
                  <div className="flex flex-col gap-2.5 mt-3">
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
                        <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Teléfono</label>
                        <input className="field-input" value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Extensión</label>
                        <input className="field-input" value={editForm.extension}
                          onChange={(e) => setEditForm({ ...editForm, extension: e.target.value })} />
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
                    <div>
                      <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de ingreso</label>
                      <DatePicker value={editForm.hireDate} onChange={(v) => setEditForm({ ...editForm, hireDate: v })} />
                    </div>
                  </div>
                </details>

                <div className="flex gap-2.5 mt-1">
                  <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setEditing(null)}>Cancelar</button>
                  <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={editSaving} onClick={saveEdit}>
                    {editSaving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </>
            ) : (
              /* ── Ficha completa — Equipo y Administradores, a quienes sí
                 administramos día a día. ── */
              <>
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
                    <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Correo</label>
                    <p className="field-input flex items-center" style={{ color: "var(--text-3)" }}>{editing.email}</p>
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Teléfono</label>
                    <input className="field-input" value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de ingreso</label>
                    <DatePicker value={editForm.hireDate} onChange={(v) => setEditForm({ ...editForm, hireDate: v })} />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de cumpleaños</label>
                    <DatePicker value={editForm.birthDate} onChange={(v) => setEditForm({ ...editForm, birthDate: v })} />
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

                {/* Vacaciones + Incidencias — solo se consultan para Equipo/Admin,
                    cargadas de forma perezosa al abrir esta ficha (ver openEdit). */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-3)" }}>Vacaciones recientes</p>
                    {loadingDetail ? (
                      <div className="h-16 rounded-sm animate-pulse" style={{ background: "var(--surface-2)" }} />
                    ) : !fullDetail || fullDetail.vacations.length === 0 ? (
                      <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Sin registros</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {fullDetail.vacations.slice(0, 4).map((v) => (
                          <div key={v.id} className="text-[11.5px] px-2 py-1.5 rounded-sm" style={{ background: "var(--surface-2)" }}>
                            <span className="font-semibold">{dmy(v.start_date)}–{dmy(v.end_date)}</span>
                            <span style={{ color: "var(--text-3)" }}> · {v.days}d · {v.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-3)" }}>Incidencias recientes</p>
                    {loadingDetail ? (
                      <div className="h-16 rounded-sm animate-pulse" style={{ background: "var(--surface-2)" }} />
                    ) : !fullDetail || fullDetail.incidents.length === 0 ? (
                      <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Sin registros</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {fullDetail.incidents.slice(0, 4).map((i) => (
                          <div key={i.id} className="text-[11.5px] px-2 py-1.5 rounded-sm" style={{ background: "var(--surface-2)" }}>
                            <span className="font-semibold">{dmy(i.start_date)}–{dmy(i.end_date)}</span>
                            <span style={{ color: "var(--text-3)" }}> · {KIND_LABELS[i.kind as keyof typeof KIND_LABELS] ?? i.kind}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2.5 mt-1">
                  <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setEditing(null)}>Cancelar</button>
                  <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={editSaving} onClick={saveEdit}>
                    {editSaving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Sheet>

      {/* Confirmar antes de desactivar (punto 5) — nunca se desactiva de golpe
          desde el switch de la lista. Se desmonta por completo cuando
          confirmUser es null: nada de overlays fantasma (punto 1). */}
      {confirmUser && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,.38)", backdropFilter: "blur(14px)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !confirmBusy) setConfirmUser(null); }}>
          <div className="w-full max-w-[380px] p-5"
            style={{ background: "var(--surface)", borderRadius: 20, border: "0.5px solid var(--border-2)", boxShadow: "0 8px 60px rgba(0,0,0,0.22)" }}>
            <p className="text-[15px] font-bold">¿Desactivar a {confirmUser.full_name}?</p>
            <p className="text-[12.5px] mt-1.5" style={{ color: "var(--text-2)" }}>
              Perderá acceso a Nexus de inmediato. Su historial se conserva y puedes reactivarla cuando quieras.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button className="btn-secondary flex-1 py-2.5 text-[13.5px]" disabled={confirmBusy}
                onClick={() => setConfirmUser(null)}>Cancelar</button>
              <button className="flex-1 py-2.5 text-[13.5px] rounded-full font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--danger)" }} disabled={confirmBusy}
                onClick={confirmDeactivate}>
                {confirmBusy ? "Desactivando…" : "Desactivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cropFile && (
        <ImageCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={(blob) => { setCropFile(null); uploadTeamPhoto(new File([blob], "avatar.jpg", { type: "image/jpeg" })); }}
        />
      )}
    </>
  );
}
