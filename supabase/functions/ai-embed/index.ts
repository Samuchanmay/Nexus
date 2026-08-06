// EMET · Edge Function: ai-embed
// Genera embeddings de mensajes para búsqueda semántica usando OpenAI.
// Lee la configuración de IA desde app_settings.
// Si no hay API key configurada, devuelve error 503 (servicio no disponible).
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

async function getAIConfig(admin: ReturnType<typeof createClient>) {
  const { data: rows } = await admin.rpc("nx_get_ai_config");
  const config: Record<string, string> = {};
  if (rows) {
    for (const row of rows) {
      config[row.key] = row.value;
    }
  }
  return config;
}

async function generateEmbedding(
  apiKey: string,
  model: string,
  text: string,
): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { message_ids, force } = await req.json();
    if (!Array.isArray(message_ids) || message_ids.length === 0) {
      return Response.json({ error: "Falta message_ids (array)" }, { status: 400, headers: cors });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verificar autenticación (solo admin puede generar embeddings masivamente)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "No autenticado" }, { status: 401, headers: cors });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return Response.json({ error: "No autenticado" }, { status: 401, headers: cors });
    }

    const { data: profile } = await admin
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return Response.json({ error: "Solo administradores pueden generar embeddings" }, { status: 403, headers: cors });
    }

    // Obtener configuración de IA
    const config = await getAIConfig(admin);
    const apiKey = config.ai_openai_api_key;
    const model = config.ai_openai_embeddings_model || "text-embedding-3-small";

    if (!apiKey) {
      return Response.json(
        { error: "No hay API key de OpenAI configurada. Ve a /admin/config/ia para configurarla." },
        { status: 503, headers: cors },
      );
    }

    // Obtener mensajes que necesitan embeddings
    const { data: messages } = await admin
      .from("messages")
      .select("id, content, type")
      .in("id", message_ids)
      .eq("type", "text");

    if (!messages || messages.length === 0) {
      return Response.json({ processed: 0, message: "No hay mensajes para procesar" }, { headers: cors });
    }

    // Verificar cuáles ya tienen embeddings (si no es force)
    let toProcess = messages;
    if (!force) {
      const { data: existing } = await admin
        .from("message_embeddings")
        .select("message_id, content_hash")
        .in("message_id", message_ids);

      const existingMap = new Map((existing ?? []).map((e) => [e.message_id, e.content_hash]));
      
      toProcess = [];
      for (const msg of messages) {
        const hash = await hashContent(msg.content ?? "");
        const existingHash = existingMap.get(msg.id);
        if (!existingHash || existingHash !== hash) {
          toProcess.push({ ...msg, content_hash: hash });
        }
      }
    } else {
      // Calcular hashes para todos
      toProcess = await Promise.all(
        messages.map(async (msg) => ({
          ...msg,
          content_hash: await hashContent(msg.content ?? ""),
        })),
      );
    }

    if (toProcess.length === 0) {
      return Response.json({ processed: 0, message: "Todos los mensajes ya tienen embeddings actualizados" }, { headers: cors });
    }

    // Procesar en lotes de 20 (límite de OpenAI por request)
    let processed = 0;
    const batchSize = 20;

    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      
      // Generar embeddings para el lote
      const texts = batch.map((m) => m.content ?? "");
      
      // OpenAI permite múltiples inputs en un solo request
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: texts,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      const embeddings = data.data;

      // Guardar embeddings en la base de datos
      for (let j = 0; j < batch.length; j++) {
        const msg = batch[j];
        const embedding = embeddings[j].embedding;

        await admin
          .from("message_embeddings")
          .upsert({
            message_id: msg.id,
            content_hash: msg.content_hash,
            embedding,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "message_id",
          });
      }

      processed += batch.length;
    }

    return Response.json({ processed, total: messages.length }, { headers: cors });
  } catch (e) {
    console.error(`ai-embed: excepción — ${e instanceof Error ? e.message : String(e)}`);
    return Response.json(
      { error: e instanceof Error ? e.message : "Error del servidor" },
      { status: 500, headers: corsFor(req) },
    );
  }
});
