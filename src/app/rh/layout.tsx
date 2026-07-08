import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import { AppShell, roleLabel } from "@/components/os/app-shell";

export default async function RHLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  if (!["rh", "admin"].includes(profile.role)) redirect("/");

  return (
    <ToastProvider>
      <AppShell
        role="rh"
        user={{
          name: profile.display_name,
          area: profile.area ?? "",
          color: profile.nexus_color ?? "#5856D6",
          roleLabel: roleLabel(profile.role === "admin" ? "admin" : "rh"),
        }}
      >
        <div className="max-w-[900px] mx-auto">
          <div className="flex justify-end mb-2">
            <span className="pill" style={{ background: "var(--purple-tint)", color: "var(--purple)" }}>
              Solo lectura
            </span>
          </div>
          {children}
        </div>
      </AppShell>
    </ToastProvider>
  );
}
