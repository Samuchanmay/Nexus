import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Punto de entrada autenticado. Antes vivía en "/", pero la raíz del
// sitio ahora es la landing pública (ver src/app/page.tsx) - requisito de
// verificación de Google OAuth: Google necesita cargar https://emet.uno
// sin iniciar sesión. Login y cualquier guardia de rol redirigen aquí
// ("/app"), nunca a "/".
export default async function AppEntry() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users").select("role, onboarded").eq("auth_id", user.id).single();

  if (!profile) redirect("/login?error=no-autorizado");
  if (!profile.onboarded) redirect("/onboarding");
  switch (profile.role) {
    case "admin": redirect("/admin");
    case "rh": redirect("/rh");
    case "coordinador":
    case "departamento": redirect("/coordinador");
    default: redirect("/comunicacion");
  }
}
