import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/os/app-shell";
import { roleLabel } from "@/lib/nav";

export default async function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  // Admin es superset de Empleado: también puede entrar aquí
  if (!["empleado", "admin"].includes(profile.role)) redirect("/");

  return (
    <ToastProvider>
      <AppShell
        role={profile.role === "admin" ? "admin" : "empleado"}
        ficharAction
        user={{
          id: profile.id,
          name: profile.display_name,
          area: profile.area ?? "",
          color: profile.nexus_color ?? "#0066FF",
          roleLabel: roleLabel(profile.role === "admin" ? "admin" : "empleado"),
        }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
