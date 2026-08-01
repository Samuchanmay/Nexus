import { createClient } from "jsr:@supabase/supabase-js@2";

// CORREO DE ORIGEN DE ESTA FUNCION (configura en Supabase -> Edge Functions)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Metodo no permitido", { status: 405, headers: corsHeaders });
  }

  try {
    // 1. Verificar que el llamador es admin
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: user, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await supabaseUser
      .from("users")
      .select("id, role")
      .eq("auth_id", user.user.id)
      .single();
    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Requiere rol admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parsear payload
    const body = await req.json();
    const { title, slug, description, target_role = "todos", screens } = body;
    if (!title || !slug || !Array.isArray(screens) || screens.length === 0) {
      return new Response(JSON.stringify({ error: "Faltan campos: title, slug, screens" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = adminClient();
    const demoId = crypto.randomUUID();
    const storageBase = `demos/${demoId}`;

    // 3. Subir snapshots a Storage
    const uploaded: { snapshot_url: string; thumbnail_url: string | null; interaction_ctx: Record<string, unknown> }[] = [];
    for (let i = 0; i < screens.length; i++) {
      const s = screens[i];
      const path = `${storageBase}/screen_${i}.json`;
      const { error: upErr } = await sb.storage
        .from("demos")
        .upload(path, JSON.stringify(s.snapshot ?? {}), {
          contentType: "application/json",
          upsert: true,
        });
      if (upErr) throw new Error(`storage upload ${path}: ${upErr.message}`);

      let thumbUrl: string | null = null;
      if (s.thumbnail) {
        const thumbPath = `${storageBase}/thumb_${i}.png`;
        const { error: tErr } = await sb.storage
          .from("demos")
          .upload(thumbPath, s.thumbnail, { contentType: "image/png", upsert: true });
        if (!tErr) {
          // Ruta en bucket privado; el reproductor la firma con su sesion.
          thumbUrl = thumbPath;
        }
      }

      const { data: signed } = await sb.storage.from("demos").createSignedUrl(path, 60 * 60 * 24 * 30);
      uploaded.push({
        snapshot_url: signed?.signedUrl ?? path,
        thumbnail_url: thumbUrl,
        interaction_ctx: s.interaction_ctx ?? {},
      });
    }

    // 4. Insertar demo + pantallas
    const { data: demoRow, error: demErr } = await sb
      .from("demos")
      .insert({
        id: demoId,
        slug,
        title,
        description,
        target_role,
        status: "borrador",
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (demErr) throw new Error(`insert demo: ${demErr.message}`);

    const { error: scrErr } = await sb.from("demo_screens").insert(
      uploaded.map((u, i) => ({
        demo_id: demoId,
        screen_index: i,
        snapshot_url: u.snapshot_url,
        thumbnail_url: u.thumbnail_url,
        interaction_ctx: u.interaction_ctx,
      })),
    );
    if (scrErr) throw new Error(`insert screens: ${scrErr.message}`);

    return new Response(JSON.stringify({ ok: true, demo_id: demoRow.id, screens: uploaded.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
