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
        const { data: profile } = await supabase
          .from("users").select("id").eq("auth_id", user.id).single();
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

        if (refreshToken) {
          const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (serviceUrl && serviceKey) {
            const admin = createServiceClient(serviceUrl, serviceKey);
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
      }
      return NextResponse.redirect(origin);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
