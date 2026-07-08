import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider, ThemeToggle } from "@/components/ui";
import { IconUsers } from "@/components/icons";

export default async function RHLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users").select("role, onboarded").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  if (!["rh", "admin"].includes(profile.role)) redirect("/");

  return (
    <ToastProvider>
      <div className="mesh min-h-screen" data-mesh="rh">
        <nav className="glass-bar sticky top-0 z-[200] h-14 flex items-center justify-between px-5"
          style={{ borderBottom: "0.5px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-white"
              style={{ background: "linear-gradient(150deg,#9D8CFF,#5856D6)", boxShadow: "0 2px 6px rgba(88,86,214,.3)" }}>
              <IconUsers className="w-[15px] h-[15px]" />
            </div>
            <div className="leading-[1.05]">
              <p className="text-[14.5px] font-semibold tracking-tight">Nexus</p>
              <p className="text-[11.5px] font-medium" style={{ color: "var(--text-2)" }}>Recursos Humanos</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="pill" style={{ background: "var(--purple-tint)", color: "var(--purple)" }}>
              Solo lectura
            </span>
            <ThemeToggle />
          </div>
        </nav>
        <main className="relative z-[1] max-w-[900px] mx-auto px-5 pb-16">{children}</main>
        <p className="relative z-[1] text-center text-[10.5px] pb-8" style={{ color: "var(--text-3)" }}>
          Hecho con ❤️ por Samu Chan
        </p>
      </div>
    </ToastProvider>
  );
}
