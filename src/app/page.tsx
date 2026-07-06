import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users").select("role, onboarded").eq("auth_id", user.id).single();

  if (!profile) redirect("/login?error=no-autorizado");
  switch (profile.role) {
    case "admin": redirect("/admin");
    case "rh": redirect("/rh");
    case "coordinador":
    case "departamento": redirect("/coordinador");
    default: redirect("/empleado");
  }
}
