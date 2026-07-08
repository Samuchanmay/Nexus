import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/os/app-shell";
import { roleLabel } from "@/lib/nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  if (profile.role !== "admin") redirect("/");

  return (
    <ToastProvider>
      <AppShell
        role="admin"
        ficharAction
        user={{
          name: profile.display_name,
          area: profile.area ?? "",
          color: profile.nexus_color ?? "#5856D6",
          roleLabel: roleLabel("admin"),
        }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
