"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, Department } from "@/lib/types";
import { useToast, Sheet, Avatar, DatePicker, Menu, MenuItem, Select, TimePicker } from "@/components/ui";
import {
  IconUserPlus, IconCamera, IconChevronLeft, IconClipboard, IconPen, IconCalendar, IconX,
  IconMail, IconPhone, IconBuilding,
} from "@/components/icons";
import { Switch, Field } from "@/components/shared";
import { ImageCropper } from "@/components/os/image-cropper";
import { Dialog } from "@/components/os/ui";
import { todayMerida } from "@/lib/tz";
import { PALETTE, nextAvailableColor } from "@/lib/colors";
import { notifyUser } from "@/lib/notify";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { useHeaderAction } from "@/lib/header-actions";
import { logAdminAction } from "@/lib/admin-log";
import { getAttendanceStatus, type IncidentKind } from "@/lib/domain/attendance/status";
import { DomainTabs } from "@/components/os/domain-tabs";

/** Los roles "Equipo" (empleado) y Administrador son los que realmente
    administramos día a día (asistencia, vacaciones, incidencias) — reciben
    la ficha completa. Coordinador/Departamento/RH son Directorio Institucional:
    solo lookup de contacto, sin cargar datos que nunca se usan aquí. */
const isFullDrawerRole = (role: string) => role === "empleado" || role === "admin";

const NIVEL_LABELS: Record<string, string> = {
  licenciatura: "Licenciatura", centro_educativo: "Centro Educativo", posgrado: "Posgrado",
};

// Cuántas tarjetas se renderizan por grupo antes de pedir "Mostrar más" —
// evita pintar cientos/miles de tarjetas de golpe sin sumar una librería de
// virtualización nueva al proyecto.
const PAGE_SIZE = 60;

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

/** Encabezado de sección dentro del Drawer de perfil (Información personal /
    laboral / Configuración) — mismo lenguaje tipográfico que ya se usaba para
    "Vacaciones recientes" etc., ahora reutilizado como separador de grupos
    reales en vez de solo etiqueta de bloque de datos. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-bold uppercase tracking-wide pt-3"
      style={{ color: "var(--text-3)", borderTop: "0.5px solid var(--border)" }}>
      {children}
    </p>
  );
}

function AreaSelect({ role, areas, value, onChange }: {
  role: string; areas: Department[]; value: string; onChange: (v: string) => void;
}) {
  const tipo = AREA_TIPO[role];
  if (!tipo) return null;
  const options = areas.filter((a) => a.tipo === tipo);
  const label = tipo === "coordinacion" ? "Coordinación" : "Departamento";
  return (
    <Field label={label}>
      <Select
        value={value} onChange={onChange} title={label}
        placeholder="— que la persona la elija al entrar —"
        options={options.map((a) => ({ value: a.id, label: a.nombre }))}
      />
    </Field>
  );
}

export default function EmpleadosClient({
  users, areas, rhColor, adminId,
  vacationOf = {}, incidentOf = {}, restDayOf = {}, isHoliday = false,
}: {
  users: UserProfile[]; areas: Department[]; rhColor: string | null; adminId?: string;
  vacationOf?: Record<string, { start: string; end: string }>;
  incidentOf?: Record<string, { kind: string; note: string | null }>;
  restDayOf?: Record<string, { note: string | null }>;
  isHoliday?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  {/* En el header compartido (búsqueda/tema/notificaciones/avatar ya ocupan
      esa fila en móvil), un solo botón que combina ícono+texto con la
      sombra/gradiente permanente de `.btn-primary` se veía "inflado" al
      lado de sus vecinos, que son planos (`IconButton`: 36×36, sin sombra,
      solo `hover:bg-hover`). Dos renders independientes por breakpoint en
      vez de mezclar clases condicionalmente: en móvil un ícono plano con el
      mismo peso visual exacto que sus vecinos (mismo tamaño, sin relieve);
      desde `sm:` el pill completo con texto, donde el peso de `.btn-primary`
      sí tiene sentido porque ya no compite en una fila de puros íconos. */}
  useHeaderAction(() => (
    <>
      <button onClick={() => { setAttemptedSave(false); setOpen(true); }} aria-label="Nuevo colaborador" title="Nuevo colaborador"
        className="sm:hidden h-9 w-9 rounded-sm grid place-items-center shrink-0 transition-colors duration-150 hover:bg-[var(--accent-tint)]"
        style={{ color: "var(--accent)" }}>
        <IconUserPlus className="w-[18px] h-[18px]" />
      </button>
      <button onClick={() => { setAttemptedSave(false); setOpen(true); }} aria-label="Nuevo colaborador" title="Nuevo colaborador"
        className="hidden sm:flex btn-primary h-8 px-3.5 text-[13.5px] items-center gap-1.5 shrink-0">
        <IconUserPlus className="w-3.5 h-3.5 shrink-0" /> Nuevo colaborador
      </button>
    </>
  ));
  const usedLockedColors = [...areas.map((a) => a.color), rhColor];
  const availableColors = PALETTE.filter((c) => !usedLockedColors.some((u) => u?.toUpperCase() === c.toUpperCase()));
  const [form, setForm] = useState({
    email: "", full_name: "", display_name: "", title: "", honorific: "", hire_date: "", role: "empleado",
    area: "", area_id: "", nivel: "licenciatura", color: nextAvailableColor(usedLockedColors), specialties: [] as string[],
    start: "09:00", end: "18:00", targetHours: "8", balance: "0",
  });

  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({
    role: "empleado", area_id: "", area: "", nivel: "licenciatura", balance: "0", daysPerYear: "0",
    fullName: "", displayName: "", title: "", honorific: "", hireDate: "", birthDate: "",
    phone: "", extension: "", color: PALETTE[0],
  });
  const [editSaving, setEditSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"todos" | "admin" | "equipo" | "coordinador" | "departamento" | "rh">("todos");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (label: string) => setCollapsed((c) => ({ ...c, [label]: !c[label] }));
  // Cuántas tarjetas se muestran por grupo ("Mostrar más" en vez de cargar
  // miles de una vez) — vive aquí y no dentro de Group porque Group se
  // redefine en cada render de este componente.
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  useEffect(() => { setVisibleCounts({}); }, [search]);
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

  const [attemptedSave, setAttemptedSave] = useState(false);
  const save = async () => {
    setAttemptedSave(true);
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
    setSaving(false); setOpen(false); setAttemptedSave(false);
    if (adminId) logAdminAction(supabase, adminId, "Dio de alta a una persona", form.full_name.trim());
    toast("Persona agregada a la whitelist");
    router.refresh();
  };

  const toggleActive = async (u: UserProfile) => {
    const supabase = createClient();
    const { error } = await supabase.from("users")
      .update({ active: !u.active, termination_date: u.active ? todayMerida() : null })
      .eq("id", u.id);
    if (error) { toast("No se pudo actualizar", "danger"); return; }
    if (adminId) logAdminAction(supabase, adminId, u.active ? "Dio de baja a una persona" : "Reactivó a una persona", u.full_name ?? u.display_name ?? undefined);
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

  /** Punto de estado junto al avatar — mismo Attendance Status Resolver que
      Asistencia/Equipo/Hoy (ver spec 2026-07-31): responde "¿por qué esta
      persona no inició su jornada?", no el estado de la cuenta. "Baja" e
      "Invitación pendiente" siguen visibles aparte, como estado de CUENTA
      (no de asistencia) — se resuelven antes de consultar al resolver. */
  const today = todayMerida();
  const rowStatus = (u: UserProfile): { color: string; label: string } => {
    if (!u.active) return { color: "var(--danger)", label: "Baja" };
    if (!u.auth_id) return { color: "#AEAEB2", label: "Invitación pendiente" };
    const incident = incidentOf[u.id];
    const s = getAttendanceStatus({
      date: today, today, firstIn: null, isOpen: false, noRegistroSalida: false,
      vacation: vacationOf[u.id] ?? null,
      incident: incident ? { kind: incident.kind as IncidentKind, note: incident.note } : null,
      isHoliday, restDay: restDayOf[u.id] ?? null,
      isBusinessDay: true,
    });
    // "Sin iniciar"/"Jornada terminada"/"Fuera de horario" no aplican aquí
    // (este directorio no conoce si la persona ya fichó hoy) — de vuelta a
    // "Activo" en ese caso, que es lo que esta pantalla mostraba antes para
    // "sin evento". showInDirectory ya centraliza exactamente este criterio.
    if (!s.showInDirectory) return { color: "var(--ok)", label: "Activo" };
    return { color: s.color, label: s.label };
  };

  // El Drawer de perfil administra SOLO el perfil (información personal +
  // laboral + configuración) — Vacaciones e Incidencias ya tienen sus propios
  // módulos especializados (admin/vacaciones, admin/incidencias) y mostrarlas
  // aquí también era duplicar información. Menos scope → ya no hace falta
  // precargar el detalle histórico al abrir cada ficha (una consulta menos
  // por apertura de Drawer).
  const openEdit = (u: UserProfile) => {
    setEditing(u);
    setEditForm({
      role: u.role, area_id: u.area_id ?? "", area: u.area ?? "", nivel: u.nivel ?? "licenciatura",
      balance: String(u.vacation_balance ?? 0), daysPerYear: String(u.vacation_days_per_year ?? 0),
      fullName: u.full_name ?? "", displayName: u.display_name ?? "", title: u.title ?? "",
      honorific: u.honorific ?? "", phone: u.phone ?? "", extension: u.extension ?? "",
      hireDate: u.hire_date ?? "", birthDate: u.birth_date ?? "",
      // Punto de partida del swatch: el color actual de la persona si es
      // válido, o el siguiente libre — mismo criterio que el form de alta.
      color: u.nexus_color ?? nextAvailableColor(usedLockedColors),
    });
  };

  /** Mismo criterio que resolvedColor() del form de alta (línea ~158): RH y
      coordinador/departamento heredan el color BLOQUEADO de su grupo — solo
      empleado/admin lo eligen a mano. Se recalcula con el ROL del formulario
      de edición (no el rol guardado), porque si el admin cambia el rol en el
      mismo guardado el color debe seguir la regla del rol nuevo. */
  const resolvedEditColor = (): string | null => {
    if (editForm.role === "rh") return rhColor;
    if (AREA_TIPO[editForm.role]) return areas.find((a) => a.id === editForm.area_id)?.color ?? null;
    return editForm.color;
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
      area: AREA_TIPO[editForm.role] ? null : (editForm.area.trim() || null),
      nivel: editForm.role === "coordinador" ? editForm.nivel : null,
      nexus_color: resolvedEditColor(),
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
    const roleChanged = editForm.role !== editing.role;
    if (adminId) {
      logAdminAction(supabase, adminId, roleChanged ? "Cambió el rol de una persona" : "Editó el perfil de una persona",
        `${editing.full_name ?? editing.display_name ?? ""}${roleChanged ? ` → ${ROLE_LABELS[editForm.role] ?? editForm.role}` : ""}`.trim());
    }
    // Auditoría de notificaciones: cambiar el rol de alguien nunca se lo
    // avisaba — se enteraba solo si notaba que veía pantallas distintas.
    // Solo dispara con el rol (no en cada edición de perfil — cambiar el
    // teléfono no amerita una notificación).
    if (roleChanged) {
      notifyUser(supabase, editing.id, "Tu rol cambió", `Ahora eres: ${ROLE_LABELS[editForm.role] ?? editForm.role}`, "info", "/");
    }
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
  // Búsqueda inteligente: nombre, correo, puesto, departamento Y el rol
  // (para que "RH", "Coordinador", etc. encuentren gente aunque esa palabra
  // no esté literalmente en su cargo/depto). Ver también Group() más abajo:
  // mientras hay texto de búsqueda, el filtro de rol activo se ignora — antes
  // buscar "Jorge" con el chip "Coordinadores" activo no encontraba a Jorge
  // si Jorge era Equipo, porque el grupo completo ya se descartaba ANTES de
  // aplicar la búsqueda.
  const matches = (u: UserProfile) => {
    if (!q) return true;
    const dept = areaName(u) ?? u.area ?? "";
    return [u.full_name, u.display_name, u.email, u.title, dept, ROLE_LABELS[u.role]]
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

  // Tarjeta de Equipo — vuelve al lenguaje de tarjeta individual (borde muy
  // sutil, fondo apenas distinto al canvas, padding generoso, hover ligero)
  // que se había perdido al migrar a PersonRow (fila plana). Sigue siendo un
  // <button> simple con SOLO controles secundarios anidados (switch, menú) —
  // el bug de bloqueo NO era este patrón: era el backdrop "fixed inset-0" a
  // pantalla completa del Menu compartido (components/ui.tsx), que quedaba
  // montado e invisible-pero-clickeable si el usuario abría "Más acciones" y
  // luego movía el mouse fuera de la fila sin elegir nada — ver el fix en
  // Menu (ya no usa un backdrop propio, cierra con un listener del documento).
  const Row = ({ u }: { u: UserProfile }) => {
    const dept = areaName(u) ?? u.area;
    const status = rowStatus(u);
    // <div> con onClick, NO <button> — la tarjeta contiene otros controles
    // interactivos (Editar/Copiar correo/Menu/Switch). Un <button> no puede
    // contener <button>s: el navegador cierra el externo apenas encuentra el
    // primero anidado, así que el árbol real del DOM queda roto respecto al
    // JSX y el resto de los controles terminan como hermanos sueltos fuera
    // de la tarjeta — la causa más probable de "a veces no responde" incluso
    // antes de este fix. Mismo criterio ya aplicado en PersonRow
    // (components/shared.tsx).
    return (
      <div
        onClick={() => openEdit(u)}
        className="group relative w-full text-left flex items-center gap-4 px-5 py-4 rounded-2xl border border-border cursor-pointer hover:border-[var(--border-2)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-[2px]"
        style={{
          background: "var(--surface)", 
          opacity: u.active ? 1 : 0.55,
          transition: "transform .22s var(--spring), box-shadow .22s var(--ease), border-color .22s var(--ease)",
        }}
      >
        {/* Avatar 48px + punto de estado */}
        <span className="relative shrink-0">
          <Avatar
            name={u.honorific ? `${u.honorific} ${u.full_name}` : u.full_name}
            color={u.nexus_color} avatarUrl={u.avatar_url} size={48}
            birthday={isBirthdayToday(u.birth_date, todayISO())}
            status={status.color} statusLabel={status.label}
          />
        </span>

        {/* Información - Nombre domina visualmente */}
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold truncate text-text-1">
            {u.honorific ? `${u.honorific} ${u.full_name}` : u.full_name}
          </p>
          {(u.title || dept || !u.onboarded) && (
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              {u.title && (
                <span
                  className="text-[13.5px] font-medium truncate max-w-[200px]"
                  style={{ color: "var(--text-2)" }}
                  title={u.title}
                >{u.title}</span>
              )}
              {u.title && dept && (
                <span className="text-[13.5px]" style={{ color: "var(--text-3)" }}>·</span>
              )}
              {dept && (
                <span
                  className="text-[13.5px] font-medium truncate max-w-[160px]"
                  style={{ color: "var(--text-3)" }}
                  title={dept}
                >{dept}</span>
              )}
              {!u.onboarded && (
                <span
                  className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--warn-tint)", color: "var(--warn)" }}
                  title="Aún no ha iniciado sesión — perfil incompleto"
                >
                  Incompleto
                </span>
              )}
            </div>
          )}
        </div>

        {/* Acciones - Menú ⋯ */}
        <div className="flex items-center shrink-0">
          <Menu
            align="right"
            trigger={({ onClick }) => (
              <button onClick={onClick} title="Más acciones" aria-label="Más acciones"
                className="h-8 w-8 rounded-lg grid place-items-center hover:bg-surface-3 transition-colors"
                style={{ color: "var(--text-3)" }}>
                <span className="text-[16px] leading-none font-bold">⋯</span>
              </button>
            )}>
            <MenuItem icon={<IconPen className="w-4 h-4" />} onClick={() => openEdit(u)}>
              Ver perfil
            </MenuItem>
            <MenuItem icon={<IconClipboard className="w-4 h-4" />} onClick={() => copyEmail(u.email)}>
              Copiar correo
            </MenuItem>
            <MenuItem icon={<IconCalendar className="w-4 h-4" />} onClick={() => router.push("/admin/vacaciones")}>
              Vacaciones
            </MenuItem>
            <MenuItem
              icon={<IconX className="w-4 h-4" />}
              danger={u.active}
              onClick={() => requestToggle(u)}>
              {u.active ? "Desactivar cuenta" : "Reactivar cuenta"}
            </MenuItem>
          </Menu>
        </div>

        {/* Switch de activo */}
        <span onClick={(e) => e.stopPropagation()} className="shrink-0">
          <Switch size="sm" tone="neutral" checked={u.active} onChange={() => requestToggle(u)} />
        </span>
      </div>
    );
  };

  const Group = ({ g }: { g: { key: GroupKey; label: string; list: UserProfile[] } }) => {
    // Mientras hay búsqueda activa, el filtro de rol se ignora (ver nota en
    // matches() más arriba) — así "Jorge" aparece sin importar qué chip esté
    // seleccionado.
    if (!q && roleFilter !== "todos" && g.key !== roleFilter) return null;
    const filtered = g.list.filter(matches);
    if (q && filtered.length === 0) return null;
    const isCollapsed = !q && !!collapsed[g.label];
    // Paginación simple ("Mostrar más") en vez de virtualización con
    // dependencias nuevas: con cientos/miles de colaboradores, solo se
    // renderizan 60 tarjetas a la vez por grupo — el resto se revela bajo
    // demanda. El contador vive en el padre (visibleCounts), no aquí adentro:
    // Group se redefine en cada render de EmpleadosClient, así que un
    // useState local perdería su valor en cada tecleo de búsqueda.
    const shown = visibleCounts[g.label] ?? PAGE_SIZE;
    const toShow = filtered.slice(0, shown);
    const hasMore = filtered.length > shown;
    return (
      <div className="flex flex-col gap-3">
        {/* Header del grupo */}
        <button onClick={() => toggleGroup(g.label)}
          className="flex items-center gap-2.5 text-left w-full px-2 py-2 rounded-xl transition-colors hover:bg-hover">
          <span className="transition-transform duration-200 shrink-0" style={{ color: "var(--text-3)", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
            <IconChevronLeft className="w-3.5 h-3.5 -rotate-90" />
          </span>
          <p className="text-[14px] font-bold leading-tight text-text-1">
            {g.label}
          </p>
          <span className="text-[13.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
            {filtered.length}
          </span>
        </button>
        
        {/* Grid de tarjetas con animación */}
        <div className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr" }}>
          <div className="overflow-hidden -m-1.5">
            <div className="p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity duration-200 items-start"
              style={{ opacity: isCollapsed ? 0 : 1 }}>
              {filtered.length === 0 ? (
                <p className="text-[13.5px] py-3 sm:col-span-2" style={{ color: "var(--text-3)" }}>Sin registros</p>
              ) : toShow.map((u) => <Row key={u.id} u={u} />)}
              {hasMore && (
                <button
                  onClick={() => setVisibleCounts((v) => ({ ...v, [g.label]: shown + PAGE_SIZE }))}
                  className="btn-tertiary h-9 px-4 text-[13.5px] w-fit sm:col-span-2"
                >
                  Mostrar más ({filtered.length - shown} restantes)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <DomainTabs domain="personas" role="admin" />
      
      {/* Header compacto */}
      <header className="pt-6 pb-5">
        <h1 className="text-[28px] font-bold tracking-tight text-text-1 leading-none">Directorio</h1>
        <div className="flex items-center gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-[14px] font-medium" style={{ color: "var(--text-2)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--ok)" }} />
            {users.filter((u) => u.active).length} activos
          </span>
          <span className="text-[14px]" style={{ color: "var(--text-3)" }}>
            {users.length} colaboradores
          </span>
          {users.some((u) => !u.onboarded) && (
            <span className="flex items-center gap-1.5 text-[14px]" style={{ color: "var(--warn)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--warn)" }} />
              {users.filter((u) => !u.onboarded).length} perfiles incompletos
            </span>
          )}
        </div>
      </header>

      {/* Buscador prominente + Filtros */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Buscador estilo Spotlight */}
        <div className="relative">
          <svg 
            className="absolute left-4 top-1/2 -translate-y-1/2" 
            width="18" height="18" viewBox="0 0 24 24" fill="none" 
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: "var(--text-3)" }}
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            className="w-full h-11 pl-11 pr-4 rounded-xl text-[14px] transition-all duration-200 focus:ring-2 focus:ring-accent/20"
            style={{ 
              background: "var(--surface-2)", 
              border: "1.5px solid var(--border)",
              color: "var(--text-1)"
            }}
            placeholder="Buscar personas, cargos o departamentos..."
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        
        {/* Filtros con mejor jerarquía */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
          {ROLE_CHIPS.map((c) => (
            <button 
              key={c.key} 
              onClick={() => setRoleFilter(c.key)}
              className="px-4 py-2 rounded-full text-[13.5px] font-semibold transition-all duration-200 shrink-0 whitespace-nowrap"
              style={roleFilter === c.key
                ? { 
                    background: "var(--accent)", 
                    color: "#fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)"
                  }
                : { 
                    background: "var(--surface-2)", 
                    color: "var(--text-2)",
                    border: "1px solid var(--border)"
                  }}
            >
              {c.label}
              <span className="ml-1.5 text-[12px] opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {groups.map((g) => <Group key={g.label} g={g} />)}
      </div>

      <Sheet open={open} onClose={() => { setOpen(false); setAttemptedSave(false); }} title="Nuevo colaborador">
        <div className="flex flex-col gap-3">
          <Field label="Selecciona el tipo de usuario">
            <Select
              value={form.role} onChange={(v) => setForm({ ...form, role: v, area_id: "" })}
              title="Selecciona el tipo de usuario" searchable={false}
              options={[
                { value: "empleado", label: "Empleado", sublabel: "Acceso a su espacio personal." },
                { value: "coordinador", label: "Coordinador", sublabel: "Gestiona colaboradores y solicitudes." },
                { value: "admin", label: "Administrador", sublabel: "Control completo del Workspace." },
                { value: "rh", label: "RH", sublabel: "Solo lectura — consulta información sin permisos de modificación." },
                { value: "departamento", label: "Departamento", sublabel: "Acceso únicamente al módulo correspondiente." },
              ]}
            />
          </Field>

          <div>
            <label htmlFor="emp-add-email" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Correo Google *</label>
            <input id="emp-add-email" className="field-input" placeholder="nombre@cert.edu.mx" type="email" aria-required="true"
              aria-invalid={attemptedSave && !form.email.trim() ? "true" : undefined}
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="emp-add-fullname" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Nombre completo *</label>
              <input id="emp-add-fullname" className="field-input" placeholder="Nombre Apellido" aria-required="true"
                aria-invalid={attemptedSave && !form.full_name.trim() ? "true" : undefined}
                value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="emp-add-displayname" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Nombre corto</label>
              <input id="emp-add-displayname" className="field-input" placeholder="Como aparece en la app"
                value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
          </div>

          {!isEquipo && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="emp-add-honorific" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Honorífico</label>
                <input id="emp-add-honorific" className="field-input" placeholder="Dr., Dra., Mtro., Mtra."
                  value={form.honorific} onChange={(e) => setForm({ ...form, honorific: e.target.value })} />
              </div>
              <div>
                <label htmlFor="emp-add-title" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Cargo</label>
                <input id="emp-add-title" className="field-input" placeholder="Ej. Coordinador en Enfermería"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
            </div>
          )}

          {isEquipo && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="emp-add-title-equipo" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Cargo</label>
                <input id="emp-add-title-equipo" className="field-input" placeholder="Ej. Coordinador de Video"
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
                <label htmlFor="emp-add-area" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Área</label>
                <input id="emp-add-area" className="field-input" placeholder="Comunicación"
                  value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
              </div>
            ) : null}

          {form.role === "coordinador" && (
            <Field label="Nivel educativo">
              <Select
                value={form.nivel} onChange={(v) => setForm({ ...form, nivel: v })}
                title="Nivel educativo" searchable={false}
                options={Object.entries(NIVEL_LABELS).map(([v, label]) => ({ value: v, label }))}
              />
            </Field>
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
                  <TimePicker value={form.start}
                    onChange={(v) => setForm({ ...form, start: v })} />
                </div>
                <div>
                  <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Salida</label>
                  <TimePicker value={form.end}
                    onChange={(v) => setForm({ ...form, end: v })} />
                </div>
                <div>
                  <label htmlFor="emp-add-target-hours" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Objetivo (horas)</label>
                  <input id="emp-add-target-hours" type="number" step="0.5" min="1" max="16" className="field-input" value={form.targetHours}
                    onChange={(e) => setForm({ ...form, targetHours: e.target.value })} />
                </div>
              </div>
              <div>
                <label htmlFor="emp-add-balance" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Saldo vacaciones</label>
                <input id="emp-add-balance" type="number" className="field-input" value={form.balance}
                  onChange={(e) => setForm({ ...form, balance: e.target.value })} />
              </div>
            </>
          )}

          {AREA_TIPO[form.role] && (
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
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
            <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => { setOpen(false); setAttemptedSave(false); }}>Cancelar</button>
            <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={saving} onClick={save}>
              {saving ? "Guardando…" : "Agregar a la whitelist"}
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)}
        title={editing ? (editing.honorific ? `${editing.honorific} ${editing.full_name}` : editing.full_name) : "Editar"}
        subtitle={editing ? (isFullDrawerRole(editing.role) ? "Equipo" : "Directorio institucional") : undefined}
        footer={editing && (
          <div className="flex gap-2.5">
            <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={editSaving} onClick={saveEdit}>
              {editSaving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        )}>
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
              <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
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
                      <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Departamento</p>
                      <p className="text-[13.5px] font-semibold truncate">{(editing.area_id ? areas.find((a) => a.id === editing.area_id)?.nombre : editing.area) ?? "—"}</p>
                    </div>
                  </div>
                  <a href={`mailto:${editing.email}`} className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm hover:bg-hover transition-colors" style={{ background: "var(--surface-2)" }}>
                    <IconMail className="w-4 h-4 shrink-0 text-[var(--text-3)]" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Correo</p>
                      <p className="text-[13.5px] font-semibold truncate">{editing.email}</p>
                    </div>
                  </a>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm" style={{ background: "var(--surface-2)" }}>
                      <IconPhone className="w-4 h-4 shrink-0 text-[var(--text-3)]" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Teléfono</p>
                        <p className="text-[13.5px] font-semibold truncate">{editing.phone ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm" style={{ background: "var(--surface-2)" }}>
                      <IconClipboard className="w-4 h-4 shrink-0 text-[var(--text-3)]" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Extensión</p>
                        <p className="text-[13.5px] font-semibold truncate">{editing.extension ?? "—"}</p>
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
                        <label htmlFor="emp-edit-fullname" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Nombre completo</label>
                        <input id="emp-edit-fullname" className="field-input" value={editForm.fullName}
                          onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
                      </div>
                      <div>
                        <label htmlFor="emp-edit-displayname" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Nombre corto</label>
                        <input id="emp-edit-displayname" className="field-input" value={editForm.displayName}
                          onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label htmlFor="emp-edit-honorific" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Honorífico</label>
                        <input id="emp-edit-honorific" className="field-input" placeholder="Dr., Dra., Mtro., Mtra."
                          value={editForm.honorific} onChange={(e) => setEditForm({ ...editForm, honorific: e.target.value })} />
                      </div>
                      <div>
                        <label htmlFor="emp-edit-title" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Cargo</label>
                        <input id="emp-edit-title" className="field-input" placeholder="Ej. Coordinador en Enfermería"
                          value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label htmlFor="emp-edit-phone" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Teléfono</label>
                        <input id="emp-edit-phone" className="field-input" value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                      </div>
                      <div>
                        <label htmlFor="emp-edit-extension" className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Extensión</label>
                        <input id="emp-edit-extension" className="field-input" value={editForm.extension}
                          onChange={(e) => setEditForm({ ...editForm, extension: e.target.value })} />
                      </div>
                    </div>
                    <Field label="Rol">
                      <Select
                        value={editForm.role} onChange={(v) => setEditForm({ ...editForm, role: v, area_id: "" })}
                        title="Rol" searchable={false}
                        options={[
                          { value: "coordinador", label: "Coordinador" },
                          { value: "departamento", label: "Departamento" },
                          { value: "empleado", label: "Empleado" },
                          { value: "rh", label: "RH (solo lectura)" },
                          { value: "admin", label: "Administrador" },
                        ]}
                      />
                    </Field>
                    {AREA_TIPO[editForm.role] && (
                      <AreaSelect role={editForm.role} areas={areas} value={editForm.area_id}
                        onChange={(v) => setEditForm({ ...editForm, area_id: v })} />
                    )}
                    {editForm.role === "coordinador" && (
                      <Field label="Nivel educativo">
                        <Select
                          value={editForm.nivel} onChange={(v) => setEditForm({ ...editForm, nivel: v })}
                          title="Nivel educativo" searchable={false}
                          options={Object.entries(NIVEL_LABELS).map(([v, label]) => ({ value: v, label }))}
                        />
                      </Field>
                    )}
                    <div>
                      <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de ingreso</label>
                      <DatePicker value={editForm.hireDate} onChange={(v) => setEditForm({ ...editForm, hireDate: v })} />
                    </div>
                  </div>
                </details>
              </>
            ) : (
              /* ── Ficha completa — Equipo y Administradores, a quienes sí
                 administramos día a día. Solo administra el PERFIL: nada de
                 vacaciones/incidencias/permisos aquí — esos ya viven en sus
                 propios módulos y duplicarlos aquí era ruido, no ayuda. ── */
              <>
                <SectionLabel>Información personal</SectionLabel>
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
                {/* Área — antes solo se podía fijar al crear (o quedaba de un seed
                    histórico) y no había forma de editarla ni vaciarla desde aquí.
                    Ahora es un campo editable normal: si se deja en blanco, se
                    guarda null y el Directorio no la muestra (nunca se inventa). */}
                <div>
                  <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Área</label>
                  <input className="field-input" placeholder="Ej. Comunicación — déjalo vacío si no aplica"
                    value={editForm.area} onChange={(e) => setEditForm({ ...editForm, area: e.target.value })} />
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

                <SectionLabel>Información laboral</SectionLabel>
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
                <Field label="Rol">
                  <Select
                    value={editForm.role} onChange={(v) => setEditForm({ ...editForm, role: v, area_id: "" })}
                    title="Rol" searchable={false}
                    options={[
                      { value: "coordinador", label: "Coordinador" },
                      { value: "departamento", label: "Departamento" },
                      { value: "empleado", label: "Empleado" },
                      { value: "rh", label: "RH (solo lectura)" },
                      { value: "admin", label: "Administrador" },
                    ]}
                  />
                </Field>
                {AREA_TIPO[editForm.role] && (
                  <AreaSelect role={editForm.role} areas={areas} value={editForm.area_id}
                    onChange={(v) => setEditForm({ ...editForm, area_id: v })} />
                )}
                {editForm.role === "coordinador" && (
                  <Field label="Nivel educativo">
                    <Select
                      value={editForm.nivel} onChange={(v) => setEditForm({ ...editForm, nivel: v })}
                      title="Nivel educativo" searchable={false}
                      options={Object.entries(NIVEL_LABELS).map(([v, label]) => ({ value: v, label }))}
                    />
                  </Field>
                )}
                {/* Color — antes solo se elegía al CREAR (gap encontrado en
                    auditoría 4 ago 2026: no había forma de recolorear a
                    alguien ya existente sin tocar la base a mano). RH y
                    coordinador/departamento heredan el color de su grupo
                    (bloqueado, se administra en Configuración → Colores);
                    Empleado/Administrador lo eligen aquí libremente, igual
                    que en el formulario de alta. Se refleja en TODA la app
                    (avatares, chat, reportes) porque todos leen el mismo
                    campo users.nexus_color — no hay overrides por pantalla. */}
                {!AREA_TIPO[editForm.role] && editForm.role !== "rh" && (
                  <Field label="Color">
                    <div className="flex gap-1.5 items-center flex-wrap">
                      {availableColors.map((c) => (
                        <button key={c} type="button" onClick={() => setEditForm({ ...editForm, color: c })}
                          aria-label={`Color ${c}`}
                          className="w-7 h-7 rounded-full transition-transform"
                          style={{
                            background: c,
                            transform: editForm.color === c ? "scale(1.2)" : "scale(1)",
                            border: editForm.color === c ? "2.5px solid var(--text-1)" : "2.5px solid transparent",
                          }} />
                      ))}
                    </div>
                  </Field>
                )}
                {/* Estado — mismo switch/confirmación que la tarjeta de la lista
                    (requestToggle), disponible también desde aquí para no
                    obligar a cerrar el Drawer para dar de baja/reactivar. */}
                <div className="flex items-center justify-between px-3.5 py-3 rounded-sm" style={{ background: "var(--surface-2)" }}>
                  <div>
                    <p className="text-[12.5px] font-semibold">{editing.active ? "Cuenta activa" : "Cuenta dada de baja"}</p>
                    <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                      {editing.active ? "Tiene acceso a Emet" : "Su historial se conserva"}
                    </p>
                  </div>
                  <Switch size="sm" tone="neutral" checked={editing.active} onChange={() => requestToggle(editing)} />
                </div>

                <SectionLabel>Configuración</SectionLabel>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                      Días asignados/año
                    </label>
                    <input type="number" className="field-input" value={editForm.daysPerYear}
                      onChange={(e) => setEditForm({ ...editForm, daysPerYear: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                      Saldo actual (días)
                    </label>
                    <input type="number" className="field-input" value={editForm.balance}
                      onChange={(e) => setEditForm({ ...editForm, balance: e.target.value })} />
                  </div>
                </div>
                <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                  Ajusta el saldo aquí solo para correcciones manuales — la aprobación de solicitudes ya lo descuenta automáticamente.
                </p>
              </>
            )}
          </div>
        )}
      </Sheet>

      {/* Confirmar antes de desactivar (punto 5) — nunca se desactiva de golpe
          desde el switch de la lista. Dialog accesible (W2/auditoría punto 7):
          role="alertdialog", foco atrapado, cierre con Escape, portado a
          document.body — reemplaza el modal ad-hoc que no tenía nada de eso. */}
      <Dialog
        open={!!confirmUser}
        onClose={() => { if (!confirmBusy) setConfirmUser(null); }}
        onConfirm={confirmDeactivate}
        title={`¿Desactivar a ${confirmUser?.full_name ?? ""}?`}
        description="Perderá acceso a Emet de inmediato. Su historial se conserva y puedes reactivarla cuando quieras."
        confirmLabel={confirmBusy ? "Desactivando…" : "Desactivar"}
        variant="danger"
        busy={confirmBusy}
      />

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
