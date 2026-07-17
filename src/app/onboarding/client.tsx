"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, Department } from "@/lib/types";
import { IconGrid, IconCheck } from "@/components/icons";

const HONORIFICS = ["Dr.", "Dra.", "Mtro.", "Mtra.", "Lic.", "Ing.", "Otro"];

const AREA_LABEL: Record<string, string> = {
  coordinacion: "tu coordinación",
  departamento: "tu departamento",
};

export default function OnboardingClient({
  profile, areas, redirectTo,
}: { profile: UserProfile; areas: Department[]; redirectTo: string }) {
  const router = useRouter();
  const isEquipo = profile.role === "empleado";
  const [displayName, setDisplayName] = useState(profile.display_name || profile.full_name.split(" ")[0]);
  const [honorific, setHonorific] = useState(profile.honorific ?? "");
  const [roleTitle, setRoleTitle] = useState(profile.title ?? "");
  const [areaId, setAreaId] = useState(profile.area_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const needsArea = areas.length > 0;
  const areaTipoLabel = areas[0] ? AREA_LABEL[areas[0].tipo] : "tu área";
  const canSave = displayName.trim().length > 0 && (isEquipo || honorific !== "") && (!needsArea || areaId !== "");

  const save = async () => {
    setError("");
    if (!canSave) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Tu sesión expiró, vuelve a entrar."); setSaving(false); return; }

    const { error: err } = await supabase.from("users").update({
      display_name: displayName.trim(),
      honorific: isEquipo ? null : (honorific || null),
      title: roleTitle.trim() || null,
      area_id: needsArea ? areaId : profile.area_id,
      onboarded: true,
    }).eq("auth_id", user.id);

    if (err) { setError("No se pudo guardar tu perfil. Intenta de nuevo."); setSaving(false); return; }
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <main className="mesh min-h-screen flex items-center justify-center p-5" data-mesh="admin">
      <div className="card relative z-[1] w-full max-w-[440px] p-8">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white"
          style={{ background: "linear-gradient(150deg,#7B7AFF,#5856D6)", boxShadow: "0 8px 24px rgba(88,86,214,.35)" }}>
          <IconGrid className="w-7 h-7" />
        </div>
        <h1 className="text-[24px] font-bold tracking-tight text-center mb-1">¡Bienvenido a Nexus!</h1>
        <p className="text-[13.5px] text-center mb-7" style={{ color: "var(--text-2)" }}>
          Antes de entrar, completa tu perfil
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
              ¿Cómo quieres que te llamen?
            </label>
            <input className="field-input" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" />
          </div>

          {!isEquipo && (
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                Rango académico
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {HONORIFICS.map((t) => (
                  <button key={t} type="button" onClick={() => setHonorific(t)}
                    className="px-3.5 py-2 rounded-full text-[13px] font-semibold"
                    style={honorific === t
                      ? { background: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent)" }
                      : { border: "1px solid var(--border-2)", color: "var(--text-2)" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
              Tu cargo o rol (opcional)
            </label>
            <input className="field-input" value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder={isEquipo ? "Ej. Productor Multimedia" : "Ej. Coordinador en Enfermería y Nutrición"} />
          </div>

          {needsArea && (
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                Selecciona {areaTipoLabel}
              </label>
              <select className="field-input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="" disabled>Elige una opción…</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          )}

          {error && (
            <div className="rounded-sm px-4 py-3 text-[12.5px]"
              style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          <button onClick={save} disabled={!canSave || saving}
            className="btn-primary w-full py-3.5 text-[14.5px] flex items-center justify-center gap-2.5 mt-1">
            <IconCheck className="w-[16px] h-[16px]" />
            {saving ? "Guardando…" : "Entrar a Nexus"}
          </button>
        </div>
      </div>
    </main>
  );
}
