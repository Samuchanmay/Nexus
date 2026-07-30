import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Punto de entrada autenticado. Antes viv\u00eda en "/", pero la ra\u00edz del
// sitio ahora es la landing p\u00fablica (ver src/app/page.tsx) - requisito de
// verificaci\u00f3n de Google OAuth: Google necesita cargar https://emet.uno
// sin iniciar sesi\u00f3n. Login y cualquier guardia de rol redirigen aqu\u00ed
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
