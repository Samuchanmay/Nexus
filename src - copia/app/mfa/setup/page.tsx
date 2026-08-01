import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MfaSetupClient from "./client";

export default async function MfaSetupPage({
  searchParams,
}: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users").select("role, display_name").eq("auth_id", user.id).maybeSingle();
  if (!profile) redirect("/login?error=no-autorizado");

  // Ya tiene un factor enrolado — no debería estar aquí (sería /mfa/verify).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") redirect(`/mfa/verify?next=${encodeURIComponent((await searchParams).next ?? "/")}`);
  if (aal?.currentLevel === "aal2") redirect((await searchParams).next ?? "/");

  const { next } = await searchParams;
  return <MfaSetupClient displayName={profile.display_name} redirectTo={next ?? "/"} />;
}
