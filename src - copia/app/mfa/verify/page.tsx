import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MfaVerifyClient from "./client";

export default async function MfaVerifyPage({
  searchParams,
}: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { next } = await searchParams;
  // Sin factor enrolado — no debería estar aquí (sería /mfa/setup).
  if (aal?.currentLevel === "aal1" && aal.nextLevel === "aal1") redirect(`/mfa/setup?next=${encodeURIComponent(next ?? "/")}`);
  if (aal?.currentLevel === "aal2") redirect(next ?? "/");

  return <MfaVerifyClient redirectTo={next ?? "/"} />;
}
