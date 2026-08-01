import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingClient from "./client";
import type { Department } from "@/lib/types";

function roleHome(role: string) {
  switch (role) {
    case "admin": return "/admin";
    case "rh": return "/rh";
    case "coordinador":
    case "departamento": return "/coordinador";
    default: return "/comunicacion";
  }
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user.id).single();
  if (!profile) redirect("/login?error=no-autorizado");
  if (profile.onboarded) redirect(roleHome(profile.role));

  const tipo = profile.role === "coordinador" ? "coordinacion"
    : profile.role === "departamento" ? "departamento"
    : null;

  let areas: Department[] = [];
  if (tipo) {
    const { data } = await supabase
      .from("departments").select("*").eq("tipo", tipo).eq("activo", true).order("nombre");
    areas = (data ?? []) as Department[];
  }

  return <OnboardingClient profile={profile} areas={areas} redirectTo={roleHome(profile.role)} />;
}
