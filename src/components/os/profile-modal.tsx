"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./ui";
import { Icon } from "./icons";
import { useToast } from "@/components/ui";
import { ImageCropper } from "./image-cropper";
import { isBirthdayToday, todayISO } from "@/lib/birthday";

type ProfileData = {
  email: string;
  birth_date: string | null;
  hire_date: string | null;
  rfc: string | null;
  curp: string | null;
  avatar_url: string | null;
};

/** Fila tipo "ajustes de iOS": icono en burbuja + etiqueta + valor/input. */
function InfoRow({ icon, label, color, children }: {
  icon: string; label: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <div className="w-8 h-8 rounded-full grid place-items-center shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
        <Icon name={icon} size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-semibold text-text-3 mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}

export function ProfileModal({
  userId, name, roleLabel, color, onClose,
}: {
  userId: string;
  name: string;
  roleLabel: string;
  color: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    createClient()
      .from("users")
      .select("email, birth_date, hire_date, rfc, curp, avatar_url")
      .eq("id", userId)
      .single()
      .then(({ data: row }) => { if (active && row) { setData(row as ProfileData); setLoading(false); } });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const set = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => {
    setData((d) => (d ? { ...d, [key]: value } : d));
    setSaved(false);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({
        birth_date: data.birth_date || null,
        hire_date: data.hire_date || null,
        rfc: data.rfc?.trim() || null,
        curp: data.curp?.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      toast("No se pudo verificar tu sesión — vuelve a iniciar sesión e intenta de nuevo");
      setUploading(false);
      return;
    }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${authUser.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      toast(`No se pudo subir la foto: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const { error } = await supabase.from("users").update({ avatar_url: url }).eq("id", userId);
    if (error) {
      toast("La foto se subió pero no se pudo guardar en tu perfil — intenta de nuevo");
    } else {
      set("avatar_url", url);
      toast("Foto actualizada");
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 nx-fade" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[420px] rounded-lg bg-panel border border-border shadow-nx overflow-hidden nx-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Cerrar"
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full grid place-items-center bg-black/25 text-white hover:bg-black/40 transition-colors backdrop-blur-sm">
          <Icon name="close" size={16} />
        </button>

        {/* Portada con el color del usuario */}
        <div className="h-20 relative"
          style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, black))` }} />

        {/* Avatar superpuesto */}
        <div className="flex flex-col items-center -mt-10 px-5">
          <div className="relative">
            <div className="rounded-full" style={{ boxShadow: "0 0 0 4px var(--panel)" }}>
              <Avatar name={name} color={color} size={80} avatarUrl={data?.avatar_url} birthday={isBirthdayToday(data?.birth_date, todayISO())} />
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-accent text-white grid place-items-center border-2 border-panel disabled:opacity-50"
              aria-label="Cambiar foto"
              title="Cambiar foto"
            >
              <Icon name="camera" size={13} />
            </button>
            <input
              ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = ""; }}
            />
          </div>
          <p className="text-[17px] font-bold text-text-1 mt-2.5">{name}</p>
          <span className="mt-1 mb-4 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold"
            style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
            {roleLabel}
          </span>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-4 max-h-[52vh] nx-scroll overflow-y-auto">
          {loading || !data ? (
            <p className="text-center text-[12.5px] text-text-3 py-6">Cargando…</p>
          ) : (
            <>
              <div className="rounded-sm border border-border divide-y divide-border">
                <InfoRow icon="mail" label="Correo" color={color}>
                  <p className="text-[13.5px] text-text-1 truncate">{data.email}</p>
                </InfoRow>
              </div>

              <div className="rounded-sm border border-border divide-y divide-border">
                <InfoRow icon="cake" label="Fecha de nacimiento" color={color}>
                  <input
                    type="date" value={data.birth_date ?? ""}
                    onChange={(e) => set("birth_date", e.target.value)}
                    className="w-full bg-transparent text-[13.5px] text-text-1 focus:outline-none"
                  />
                </InfoRow>
                <InfoRow icon="calendar" label="Fecha de ingreso" color={color}>
                  <input
                    type="date" value={data.hire_date ?? ""}
                    onChange={(e) => set("hire_date", e.target.value)}
                    className="w-full bg-transparent text-[13.5px] text-text-1 focus:outline-none"
                  />
                </InfoRow>
                <InfoRow icon="idcard" label="RFC" color={color}>
                  <input
                    type="text" value={data.rfc ?? ""} maxLength={13}
                    onChange={(e) => set("rfc", e.target.value.toUpperCase())}
                    placeholder="XXXX000000XXX"
                    className="w-full bg-transparent text-[13.5px] text-text-1 uppercase focus:outline-none placeholder:text-text-3 placeholder:normal-case"
                  />
                </InfoRow>
                <InfoRow icon="idcard" label="CURP" color={color}>
                  <input
                    type="text" value={data.curp ?? ""} maxLength={18}
                    onChange={(e) => set("curp", e.target.value.toUpperCase())}
                    placeholder="XXXX000000XXXXXX00"
                    className="w-full bg-transparent text-[13.5px] text-text-1 uppercase focus:outline-none placeholder:text-text-3 placeholder:normal-case"
                  />
                </InfoRow>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t border-border">
          {saved && <span className="text-[12px] font-semibold mr-auto flex items-center gap-1" style={{ color: "var(--ok)" }}><Icon name="check" size={12} /> Guardado</span>}
          <button onClick={onClose} className="btn-secondary h-9 px-4 text-[13px]">Cerrar</button>
          <button onClick={save} disabled={saving || loading} className="btn-primary h-9 px-4 text-[13px]">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {cropFile && (
        <ImageCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={(blob) => { setCropFile(null); uploadPhoto(new File([blob], "avatar.jpg", { type: "image/jpeg" })); }}
        />
      )}
    </div>
  );
}
