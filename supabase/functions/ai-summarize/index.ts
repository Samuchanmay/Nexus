// EMET · Edge Function: ai-summarize
// Genera resúmenes de conversaciones de chat usando IA (OpenAI/Anthropic/OpenRouter).
// Lee la configuración de IA desde app_settings (ai_provider, ai_*_api_key, ai_*_model).
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

async function summarizeWithOpenAI(
  apiKey: string,
  model: string,
  messages: { sender_name: string; content: string }[],
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.sender_name}: ${m.content}`)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "Eres un asistente que resume conversaciones de chat de trabajo. Genera resúmenes concisos en español (máximo 3-4 oraciones) que capturen los puntos clave, decisiones tomadas y acciones pendientes. Usa un tono profesional pero natural.",
        },
        {
          role: "user",
          content: `Resume esta conversación:\n\n${conversationText}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function summarizeWithAnthropic(
  apiKey: string,
  model: string,
  messages: { sender_name: string; content: string }[],
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.sender_name}: ${m.content}`)
    .join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      system: "Eres un asistente que resume conversaciones de chat de trabajo. Genera resúmenes concisos en español (máximo 3-4 oraciones) que capturen los puntos clave, decisiones tomadas y acciones pendientes. Usa un tono profesional pero natural.",
      messages: [
        {
          role: "user",
          content: `Resume esta conversación:\n\n${conversationText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.content[0].text.trim();
}

async function summarizeWithOpenRouter(
  apiKey: string,
  model: string,
  messages: { sender_name: string; content: string }[],
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.sender_name}: ${m.content}`)
    .join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "Eres un asistente que resume conversaciones de chat de trabajo. Genera resúmenes concisos en español (máximo 3-4 oraciones) que capturen los puntos clave, decisiones tomadas y acciones pendientes. Usa un tono profesional pero natural.",
        },
        {
          role: "user",
          content: `Resume esta conversación:\n\n${conversationText}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return Response.json({ error: "Falta conversation_id" }, { status: 400, headers: cors });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verificar autenticación y membresía
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

    // Verificar que el usuario es participante de la conversación
    const { data: participant } = await admin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversation_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!participant) {
      return Response.json({ error: "No eres participante de esta conversación" }, { status: 403, headers: cors });
    }

    // Obtener configuración de IA
    const config = await getAIConfig(admin);
    const provider = config.ai_provider || "openai";

    if (!config[`${provider}_api_key`]) {
      return Response.json(
        { error: `No hay API key configurada para ${provider}. Ve a /admin/config/ia para configurarla.` },
        { status: 503, headers: cors },
      );
    }

    // Obtener mensajes de la conversación (últimos 100)
    const { data: messages } = await admin
      .from("messages")
      .select("sender_id, content, type")
      .eq("conversation_id", conversation_id)
      .eq("type", "text")
      .order("created_at", { ascending: true })
      .limit(100);

    if (!messages || messages.length === 0) {
      return Response.json({ summary: "No hay mensajes en esta conversación." }, { headers: cors });
    }

    // Obtener nombres de los remitentes
    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    const { data: senders } = await admin
      .from("users_directory")
      .select("id, display_name")
      .in("id", senderIds);

    const senderMap = new Map((senders ?? []).map((s) => [s.id, s.display_name]));

    const messagesForAI = messages.map((m) => ({
      sender_name: senderMap.get(m.sender_id) ?? "Alguien",
      content: m.content ?? "",
    }));

    // Generar resumen con el proveedor configurado
    let summary: string;
    const apiKey = config[`${provider}_api_key`];
    const model = config[`${provider}_model`];

    if (provider === "openai") {
      summary = await summarizeWithOpenAI(apiKey, model, messagesForAI);
    } else if (provider === "anthropic") {
      summary = await summarizeWithAnthropic(apiKey, model, messagesForAI);
    } else if (provider === "openrouter") {
      summary = await summarizeWithOpenRouter(apiKey, model, messagesForAI);
    } else {
      return Response.json({ error: `Proveedor desconocido: ${provider}` }, { status: 400, headers: cors });
    }

    return Response.json({ summary }, { headers: cors });
  } catch (e) {
    console.error(`ai-summarize: excepción — ${e instanceof Error ? e.message : String(e)}`);
    return Response.json(
      { error: e instanceof Error ? e.message : "Error del servidor" },
      { status: 500, headers: corsFor(req) },
    );
  }
});
