import { redirect } from "next/navigation";
import { createClient, getAuthedUser } from "@/lib/supabase/server";
import BackupsClient from "./client";

// Server component mínimo: solo valida rol admin y monta el cliente — la
// lista de respaldos se carga del lado del cliente contra la API (así el
// botón "Generar respaldo ahora" puede refrescarla sin recargar la página).
export default async function BackupsPage() {
  const supabase = await createClient();
  const user = await getAuthedUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/app");

  return <BackupsClient adminId={profile.id} />;
}
