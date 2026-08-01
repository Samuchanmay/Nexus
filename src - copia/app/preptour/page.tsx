import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/os/app-shell";
import { roleLabel } from "@/lib/nav";
import { PrepTourClient } from "@/components/recorridos/preptour-client";

export const metadata = { title: "Recorridos · Emet" };

type DemoRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "borrador" | "publicado";
  target_role: string;
  created_at: string;
  updated_at: string;
};

export default async function PrepTourPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  if (profile.role !== "admin") redirect("/app");

  const { data: demos } = await supabase
    .from("demos")
    .select("id, slug, title, description, status, target_role, created_at, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <ToastProvider>
      <AppShell
        role="admin"
        user={{
          id: profile.id,
          name: profile.display_name,
          avatarUrl: profile.avatar_url ?? null,
          birthDate: profile.birth_date ?? null,
          area: profile.area ?? "",
          color: profile.nexus_color ?? "#5856D6",
          roleLabel: roleLabel("admin"),
        }}
      >
        <div className="max-w-3xl mx-auto">
          <PrepTourClient initialDemos={(demos ?? []) as DemoRow[]} />
        </div>
      </AppShell>
    </ToastProvider>
  );
}
