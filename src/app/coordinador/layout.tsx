import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import { AppShell, roleLabel } from "@/components/os/app-shell";

export default async function CoordinadorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  if (!["coordinador", "departamento", "admin"].includes(profile.role)) redirect("/");

  return (
    <ToastProvider>
      <AppShell
        role="coordinador"
        user={{
          name: profile.display_name,
          area: profile.area ?? "",
          color: profile.nexus_color ?? "#0066FF",
          roleLabel: roleLabel(profile.role === "departamento" ? "departamento" : profile.role === "admin" ? "admin" : "coordinador"),
        }}
      >
        <div className="max-w-[720px] mx-auto">{children}</div>
      </AppShell>
    </ToastProvider>
  );
}
