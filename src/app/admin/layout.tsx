import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import AdminNav from "./nav";

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
      <div className="mesh min-h-screen" data-mesh="admin">
        <AdminNav profile={{ display_name: profile.display_name, nexus_color: profile.nexus_color }} />
        <main className="relative z-[1] md:pl-[228px]">
          <div className="max-w-[1060px] mx-auto px-5 pb-16">{children}</div>
          <p className="text-center text-[10.5px] pb-8" style={{ color: "var(--text-3)" }}>
            Hecho con ❤️ por Samu Chan
          </p>
        </main>
      </div>
    </ToastProvider>
  );
}
