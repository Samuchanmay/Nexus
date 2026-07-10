import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Whitelist: si el correo no está en public.users, negar acceso
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let { data: profile } = await supabase
          .from("users").select("id").eq("auth_id", user.id).single();

        const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const admin = serviceUrl && serviceKey ? createServiceClient(serviceUrl, serviceKey) : null;

        // BUG 001 — primer login de una persona invitada de antemano: el
        // admin ya creó su perfil con su correo oficial (para asignarle
        // rol, coordinación, etc.) pero todavía no tiene cuenta de Google
        // vinculada (auth_id vacío). Si no la encontramos por auth_id,
        // buscamos por correo y vinculamos esta cuenta a ese perfil ya
        // existente, en vez de rechazarla. Usa la llave de servicio porque
        // el perfil, antes de vincularse, no le pertenece todavía a este
        // usuario según las políticas normales (RLS).
        if (!profile && user.email && admin) {
          const { data: preloaded } = await admin
            .from("users").select("id")
            .ilike("email", user.email)
            .is("auth_id", null)
            .maybeSingle();
          if (preloaded) {
            const { data: linked } = await admin
              .from("users").update({ auth_id: user.id }).eq("id", preloaded.id)
              .select("id").single();
            profile = linked;
          }
        }

        if (!profile) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=no-autorizado`);
        }

        // Guardamos el "permiso permanente" de Google (refresh token) para poder
        // crear eventos de Calendar y subir archivos a Drive más adelante sin que
        // la persona tenga que volver a iniciar sesión. Se guarda en una tabla que
        // NADIE puede leer desde el navegador (solo el backend con la llave de
        // servicio), así que el permiso nunca queda expuesto.
        const session = data.session as typeof data.session & {
          provider_refresh_token?: string | null;
          provider_token?: string | null;
        };
        const refreshToken = session?.provider_refresh_token;
        const accessToken = session?.provider_token;

        if (refreshToken && admin) {
          await admin.from("google_oauth_tokens").upsert(
            {
              user_id: profile.id,
              refresh_token: refreshToken,
              access_token: accessToken ?? null,
              access_token_expires_at: accessToken
                ? new Date(Date.now() + 55 * 60 * 1000).toISOString()
                : null,
              scope:
                "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file",
            },
            { onConflict: "user_id" },
          );
        }
      }
      return NextResponse.redirect(origin);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
