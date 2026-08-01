import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Proxy de assets capturados por la extension.
// Recibe ?url=<original> y devuelve el recurso proxy-ando hacia el bucket privado
// para que el reproductor no dependa de los orígenes originales de la app.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response("Metodo no permitido", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const target = url.searchParams.get("url");
  if (!target) {
    return new Response(JSON.stringify({ error: "Parametro url requerido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Requiere sesion valida — sin esto, cualquiera podia usar esta funcion
  // como proxy abierto (SSRF) hacia cualquier host, autenticado o no.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("authorization") ?? "" } } },
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Solo http(s) — mismo criterio que src/app/api/proxy/route.ts.
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response(JSON.stringify({ error: "URL invalida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new Response(JSON.stringify({ error: "Solo se permiten URLs http(s)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const fetched = await fetch(parsed, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!fetched.ok) {
      return new Response(`Origen respondio ${fetched.status}`, {
        status: 502,
        headers: corsHeaders,
      });
    }
    const body = await fetched.arrayBuffer();
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", fetched.headers.get("content-type") ?? "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(body, { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error proxy" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
