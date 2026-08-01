import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth", "/legal"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response; // sin credenciales aún: no bloquear (modo demo)

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Carrera de refresh token: cuando el navegador dispara varias peticiones
  // casi al mismo tiempo (ej. la lista de Chat + la conversación abierta),
  // cada una pasa por este middleware y cada una intenta refrescar el mismo
  // refresh token si el access token ya expiró. La primera lo logra y lo
  // rota; las demás llegan con el token viejo y Supabase las rechaza con
  // "Refresh Token Already Used" o "Refresh Token Not Found". Eso NO es una
  // sesión inválida real — es una condición transitoria que se resuelve
  // sola en la siguiente petición (la cookie ya rotada por la que sí ganó
  // la carrera). Forzar login aquí expulsaba a gente con sesión válida en
  // pleno uso ("me lleva a otro enlace"). Cualquier otro caso de "no user"
  // (sesión de verdad ausente/expirada) sigue redirigiendo a /login.
  const isRefreshRace = error?.code === "refresh_token_already_used" || error?.code === "refresh_token_not_found";

  if (!user && !isPublic && !isRefreshRace) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
