import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/os/app-shell";
import { roleLabel } from "@/lib/nav";

// Chat es solo para el equipo interno de CERT (admin + empleado) — a
// diferencia del primer intento (Enlace), NO es para coordinador/
// departamento/rh: esos roles son contrapartes externas que le piden
// cosas a CERT vía Solicitudes, no compañeros de equipo. Mismo criterio
// de rol que ya usa comunicacion/layout.tsx para "la experiencia de equipo".
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  if (!profile.active) redirect("/");
  if (!["admin", "empleado"].includes(profile.role)) redirect("/");

  const role = profile.role === "admin" ? "admin" : "empleado";

  return (
    <ToastProvider>
      <AppShell
        role={role}
        user={{
          id: profile.id,
          name: profile.display_name,
          avatarUrl: profile.avatar_url ?? null,
          birthDate: profile.birth_date ?? null,
          area: profile.area ?? "",
          color: profile.nexus_color ?? "#0066FF",
          roleLabel: roleLabel(role),
        }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
