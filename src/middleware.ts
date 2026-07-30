import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = ["/login", "/auth", "/legal", "/contact"];
// Coincidencia exacta (no prefijo) para la ra\u00edz: usar startsWith("/")
// har\u00eda p\u00fablica cualquier ruta, ya que todas empiezan con "/".
const PUBLIC_EXACT_PATHS = new Set(["/", "/robots.txt", "/sitemap.xml"]);

// Dominio canonico: la app vive en un solo lugar (emet.uno). Los alias
// *.vercel.app siguen existiendo en Vercel (utiles para preview/debug),
// pero cualquier trafico real que aterrice ahi se redirige aqui mismo -
// asi la sesion (cookies de Supabase, scoped por host) nunca queda
// fragmentada entre dominios distintos.
const CANONICAL_HOST = "emet.uno";
const OLD_HOSTS = new Set([
  "nexus-samu09.vercel.app",
  "nexus-cert01.vercel.app",
  "nexus-git-main-samu09.vercel.app",
  "www.emet.uno",
]);

// MFA obligatorio para Admin y RH (rutas con acceso a datos sensibles de
// todo el equipo — ver AskUserQuestion respondida por defecto: TOTP +
// Admin/RH, ninguna respuesta explícita llegó, así que se documenta como
// decisión tomada, redirigible si el usuario prefiere otro alcance).
const MFA_REQUIRED_ROLES = new Set(["admin", "rh"]);
// /mfa/* nunca entra en el propio gate de MFA (evita el loop de redirect),
// pero SÍ exige sesión de primer factor como cualquier ruta privada.
const MFA_PATHS = "/mfa";

export async function middleware(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (OLD_HOSTS.has(host)) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.hostname = CANONICAL_HOST;
    canonicalUrl.port = "";
    return NextResponse.redirect(canonicalUrl, 308);
  }

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
  const isPublic = PUBLIC_EXACT_PATHS.has(path) || PUBLIC_PATH_PREFIXES.some((p) => path.startsWith(p));

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

  // ── MFA gate (Admin/RH) ──
  // Corre en el middleware (no en cada layout) a propósito: un admin puede
  // aterrizar en /admin, /comunicacion, /coordinador o /chat (todas esas
  // rutas lo dejan pasar por ser superset), así que el candado tiene que
  // vivir en el único punto por el que pasa CUALQUIER ruta privada.
  if (user && !isPublic && !path.startsWith(MFA_PATHS)) {
    const { data: profile } = await supabase
      .from("users").select("role").eq("auth_id", user.id).maybeSingle();

    if (profile && MFA_REQUIRED_ROLES.has(profile.role)) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      // aal1/aal1 = sin factor enrolado todavía → forzar alta.
      // aal1/aal2 = factor enrolado pero no verificado en esta sesión → forzar reto.
      // aal2/aal2 = ya verificado → pasa.
      if (aal && aal.currentLevel === "aal1") {
        const mfaUrl = request.nextUrl.clone();
        mfaUrl.pathname = aal.nextLevel === "aal2" ? "/mfa/verify" : "/mfa/setup";
        mfaUrl.searchParams.set("next", path);
        return NextResponse.redirect(mfaUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
