import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/os/app-shell";
import { roleLabel, type Role } from "@/lib/nav";

// Enlace es el único módulo abierto a los 5 roles por igual (a diferencia
// de admin/comunicacion/coordinador/rh, que gatean por rol específico) —
// necesita su propio layout en vez de vivir dentro de uno existente.
export default async function EnlaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  if (!profile.active) redirect("/");

  const role = (profile.role as Role) ?? "empleado";

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
