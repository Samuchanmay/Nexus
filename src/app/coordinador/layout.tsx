import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider, ThemeToggle } from "@/components/ui";
import { IconMegaphone } from "@/components/icons";

export default async function CoordinadorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users").select("role, onboarded").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  if (!["coordinador", "departamento", "admin"].includes(profile.role)) redirect("/");

  return (
    <ToastProvider>
      <div className="mesh min-h-screen" data-mesh="coordinador">
        <nav className="glass-bar sticky top-0 z-[200] h-14 flex items-center justify-between px-5"
          style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-white"
              style={{ background: "linear-gradient(150deg,#4D8FFF,#0066FF)", boxShadow: "0 2px 6px rgba(0,102,255,.3)" }}>
              <IconMegaphone className="w-[15px] h-[15px]" />
            </div>
            <div className="leading-[1.05]">
              <p className="text-[14.5px] font-semibold tracking-tight">Nexus</p>
              <p className="text-[11.5px] font-medium" style={{ color: "var(--text-2)" }}>Solicitudes de Comunicación</p>
            </div>
          </div>
          <ThemeToggle />
        </nav>
        <main className="relative z-[1] max-w-[720px] mx-auto px-5 pb-16">{children}</main>
        <p className="relative z-[1] text-center text-[10.5px] pb-8" style={{ color: "var(--text-3)" }}>
          Hecho con ❤️ por Samu Chan
        </p>
      </div>
    </ToastProvider>
  );
}
