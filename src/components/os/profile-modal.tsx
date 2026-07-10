"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Field } from "./ui";
import { Icon } from "./icons";

type ProfileData = {
  email: string;
  birth_date: string | null;
  hire_date: string | null;
  rfc: string | null;
  curp: string | null;
  avatar_url: string | null;
};

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
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!authUser) { setUploading(false); return; }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${authUser.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!upErr) {
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      const { error } = await supabase.from("users").update({ avatar_url: url }).eq("id", userId);
      if (!error) set("avatar_url", url);
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
        <div className="flex items-center justify-between px-5 h-14 border-b border-border">
          <p className="text-[14.5px] font-bold text-text-1">Mi perfil</p>
          <button onClick={onClose} className="text-text-3 hover:text-text-1 transition-colors" aria-label="Cerrar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5 max-h-[70vh] nx-scroll overflow-y-auto">
          <div className="flex items-center gap-4">
            <div className="relative">
              {data?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.avatar_url} alt={name} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <Avatar name={name} color={color} size={64} />
              )}
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
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-bold text-text-1 truncate">{name}</p>
              <p className="text-[12.5px] text-text-3">{roleLabel}</p>
            </div>
          </div>

          {loading || !data ? (
            <p className="text-center text-[12.5px] text-text-3 py-6">Cargando…</p>
          ) : (
            <>
              <Field label="Correo">
                <p className="text-[13.5px] text-text-2 px-3.5 py-3 rounded-sm bg-surface-2 border border-border">
                  {data.email}
                </p>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de nacimiento">
                  <input
                    type="date" value={data.birth_date ?? ""}
                    onChange={(e) => set("birth_date", e.target.value)}
                    className="field-input"
                  />
                </Field>
                <Field label="Fecha de ingreso">
                  <input
                    type="date" value={data.hire_date ?? ""}
                    onChange={(e) => set("hire_date", e.target.value)}
                    className="field-input"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="RFC">
                  <input
                    type="text" value={data.rfc ?? ""} maxLength={13}
                    onChange={(e) => set("rfc", e.target.value.toUpperCase())}
                    placeholder="XXXX000000XXX"
                    className="field-input uppercase"
                  />
                </Field>
                <Field label="CURP">
                  <input
                    type="text" value={data.curp ?? ""} maxLength={18}
                    onChange={(e) => set("curp", e.target.value.toUpperCase())}
                    placeholder="XXXX000000XXXXXX00"
                    className="field-input uppercase"
                  />
                </Field>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t border-border">
          {saved && <span className="text-[12px] font-semibold mr-auto" style={{ color: "var(--ok)" }}>Guardado ✓</span>}
          <button onClick={onClose} className="btn-secondary h-9 px-4 text-[13px]">Cerrar</button>
          <button onClick={save} disabled={saving || loading} className="btn-primary h-9 px-4 text-[13px]">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
