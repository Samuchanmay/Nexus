import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Whitelist: si el correo no está en public.users, negar acceso
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users").select("id").eq("auth_id", user.id).single();
        if (!profile) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=no-autorizado`);
        }
      }
      return NextResponse.redirect(origin);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
