import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Proxy de assets capturados por la extensión. El reproductor resuelve las
 * URLs originales de la app a través de aquí para no depender de los
 * orígenes de origen ni de CORS. Requiere sesión y solo admite http(s).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const target = new URL(request.url).searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Parámetro url requerido." }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "URL inválida." }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Solo se permiten URLs http(s)." }, { status: 400 });
  }

  try {
    const fetched = await fetch(parsed, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!fetched.ok) {
      return new NextResponse(`El origen respondió ${fetched.status}`, { status: 502 });
    }
    const body = await fetched.arrayBuffer();
    const headers = new Headers();
    headers.set("Content-Type", fetched.headers.get("content-type") ?? "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("X-Content-Type-Options", "nosniff");
    return new NextResponse(body, { status: 200, headers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error en el proxy." },
      { status: 500 },
    );
  }
}
