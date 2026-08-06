import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/os/app-shell";
import { roleLabel } from "@/lib/nav";
import AIConfigClient from "./client";

export const metadata = { title: "Configuración de IA · Emet" };

export default async function AIConfigPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  if (profile.role !== "admin") redirect("/app");

  // Cargar configuración actual
  const { data: configRows } = await supabase.rpc("nx_get_ai_config");
  
  const config = {
    ai_openai_api_key: "",
    ai_openai_model: "gpt-4o-mini",
    ai_openai_embeddings_model: "text-embedding-3-small",
    ai_anthropic_api_key: "",
    ai_anthropic_model: "claude-3-5-sonnet-20241022",
    ai_openrouter_api_key: "",
    ai_openrouter_model: "openai/gpt-4o-mini",
    ai_provider: "openai" as const,
  };

  if (configRows) {
    for (const row of configRows) {
      if (row.key in config) {
        (config as any)[row.key] = row.value;
      }
    }
  }

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
        <div className="max-w-3xl mx-auto py-6">
          <header className="mb-6">
            <h1 className="text-[28px] font-bold tracking-tight text-text-1 leading-none">
              Configuración de IA
            </h1>
            <p className="text-[15px] mt-2" style={{ color: "var(--text-2)" }}>
              Configura los proveedores de IA para resúmenes y búsqueda semántica
            </p>
          </header>
          <AIConfigClient initialConfig={config} />
        </div>
      </AppShell>
    </ToastProvider>
  );
}
