// EMET · Edge Function: generate-sticker
// FASE W7 — Stickers "Emu" con IA real. Genera una imagen de sticker a
// partir de un prompt del usuario (mascota Emu + lo que describa), la sube
// a Storage y la registra en chat_stickers. Nunca corre en el cliente:
// necesita la API key de OpenAI (ai_openai_api_key, misma config que
// ai-summarize/ai-embed — no se agrega un proveedor de IA nuevo) y así
// queda un solo punto de control de costo/abuso/moderación.
//
// Por qué OpenAI específicamente (y no "el proveedor configurado" como en
// ai-summarize): de los 3 proveedores que ya soporta /admin/config/ia
// (OpenAI/Anthropic/OpenRouter), solo OpenAI tiene una API de generación de
// imágenes directa y estable (gpt-image-1). Si el usuario configuró
// Anthropic u OpenRouter como proveedor de texto, igual puede tener guardada
// una clave de OpenAI aparte — se lee siempre config.openai_api_key,
// independientemente de cuál sea el `ai_provider` activo para texto.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://nexus-cert01.vercel.app",
  "https://nexus-samu09.vercel.app",
  "https://emet.uno",
  ...(Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
];

function corsFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Vary": "Origin",
  };
}

// Límite simple de uso por persona — evita que una cuenta comprometida o un
// loop de UI dispare gasto sin control. 20/día es generoso para uso real de
// chat interno y barato de calcular (un count, sin tabla nueva).
const DAILY_LIMIT_PER_USER = 20;

// Estilo fijo de la mascota Emu — el usuario solo describe la escena/acción,
// nunca controla el personaje en sí, para que todos los stickers generados
// se vean parte de un mismo "pack" coherente.
const STYLE_PREFIX =
  "Cute cartoon emu bird mascot character named Emu, big friendly eyes, chat sticker illustration style, " +
  "thick bold black outline, flat vibrant colors, simple shading, centered composition, plain white background, " +
  "no text, no watermark. Scene: ";

async function generateWithOpenAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: `${STYLE_PREFIX}${prompt}`,
      size: "1024x1024",
      quality: "low", // sticker, no necesita alta resolución — más rápido y barato
      n: 1,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Images API error: ${response.status} - ${err}`);
  }
  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI no devolvió una imagen (respuesta sin b64_json).");
  return b64;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { prompt } = await req.json();
    const cleanPrompt = typeof prompt === "string" ? prompt.trim().slice(0, 200) : "";
    if (!cleanPrompt) {
      return Response.json({ error: "Escribe qué quieres que haga Emu." }, { status: 400, headers: cors });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return Response.json({ error: "No autenticado" }, { status: 401, headers: cors });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "No autenticado" }, { status: 401, headers: cors });

    const { data: me } = await admin.from("users").select("id").eq("auth_id", user.id).single();
    if (!me) return Response.json({ error: "Usuario no encontrado" }, { status: 404, headers: cors });

    // Límite diario — cuenta lo generado por esta persona en las últimas 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("chat_stickers")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", me.id)
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_LIMIT_PER_USER) {
      return Response.json(
        { error: `Llegaste al límite de ${DAILY_LIMIT_PER_USER} stickers generados por día. Probá mañana.` },
        { status: 429, headers: cors },
      );
    }

    // Config de IA — reusa ai_openai_api_key aunque el proveedor de TEXTO
    // configurado sea otro (ver comentario arriba del archivo).
    const { data: rows } = await admin.rpc("nx_get_ai_config");
    const config: Record<string, string> = {};
    for (const row of rows ?? []) config[row.key] = row.value;
    const apiKey = config.ai_openai_api_key;
    if (!apiKey) {
      return Response.json(
        { error: "No hay una clave de OpenAI configurada. Ve a /admin/config/ia para agregarla — los stickers con IA la necesitan aunque uses otro proveedor para el resumen de chat." },
        { status: 503, headers: cors },
      );
    }

    const b64 = await generateWithOpenAI(apiKey, cleanPrompt);
    const bytes = base64ToBytes(b64);

    const path = `stickers/${crypto.randomUUID()}.png`;
    const { error: uploadErr } = await admin.storage.from("chat-files").upload(path, bytes, {
      contentType: "image/png",
      upsert: false,
    });
    if (uploadErr) throw new Error(`No se pudo subir el sticker: ${uploadErr.message}`);

    const { data: sticker, error: insertErr } = await admin
      .from("chat_stickers")
      .insert({ creator_id: me.id, prompt: cleanPrompt, image_path: path })
      .select("id, image_path, prompt, created_at")
      .single();
    if (insertErr || !sticker) throw new Error(`No se pudo registrar el sticker: ${insertErr?.message ?? "sin datos"}`);

    const { data: signed } = await admin.storage.from("chat-files").createSignedUrl(path, 1800);

    return Response.json(
      { id: sticker.id, image_path: sticker.image_path, prompt: sticker.prompt, url: signed?.signedUrl ?? null },
      { headers: cors },
    );
  } catch (e) {
    console.error(`generate-sticker: excepción — ${e instanceof Error ? e.message : String(e)}`);
    return Response.json(
      { error: e instanceof Error ? e.message : "Error del servidor" },
      { status: 500, headers: corsFor(req) },
    );
  }
});
