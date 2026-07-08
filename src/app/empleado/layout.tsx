import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import EmpleadoNav from "./nav";

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
      <div className="mesh min-h-screen" data-mesh="empleado">
        <EmpleadoNav profile={{ display_name: profile.display_name, nexus_color: profile.nexus_color, role: profile.role }} />
        <main className="relative z-[1] max-w-[680px] mx-auto px-5 pb-28">{children}</main>
        <p className="relative z-[1] text-center text-[10.5px] pb-24 md:pb-6" style={{ color: "var(--text-3)" }}>
          Hecho con ❤️ por Samu Chan
        </p>
      </div>
    </ToastProvider>
  );
}
