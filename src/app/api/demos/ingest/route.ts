import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/errors";

/**
 * Crea (o actualiza) un demo capturado con la extensión.
 * Solo admin. Recibe { title, slug, description?, target_role?, status?,
 * screens: [{ snapshot, thumbnail?, interaction_ctx? }] }.
 *
 * Los snapshots JSON y thumbnails se suben al bucket privado "demos" y se
 * guardan referencias en demos / demo_screens. Con status='publicado' queda
 * visible en el onboarding de los empleados.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { data: profile, error: profileErr } = await supabase
    .from("users").select("id, role").eq("auth_id", user.id).single();
  if (profileErr || !profile) {
    return NextResponse.json({ error: "Perfil no encontrado." }, { status: 403 });
  }
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Requiere rol admin." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string; slug?: string; description?: string;
    target_role?: string; status?: string;
    screens?: { snapshot?: unknown; thumbnail?: string; interaction_ctx?: Record<string, unknown> }[];
  } | null;

  if (!body || !body.title || !body.slug || !Array.isArray(body.screens) || body.screens.length === 0) {
    return NextResponse.json({ error: "Faltan campos: title, slug, screens." }, { status: 400 });
  }

  const targetRole = body.target_role ?? "todos";
  if (!["todos", "admin", "empleado", "rh", "coordinador", "departamento"].includes(targetRole)) {
    return NextResponse.json({ error: "target_role inválido." }, { status: 400 });
  }
  const status = body.status === "publicado" ? "publicado" : "borrador";
  const slug = (body.slug ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!slug) return NextResponse.json({ error: "slug inválido." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Service role no configurado." }, { status: 500 });
  }
  const admin = createServiceClient(url, key);

  const demoId = crypto.randomUUID();
  const storageBase = `demos/${demoId}`;

  try {
    const uploaded: { snapshot_url: string; thumbnail_url: string | null; interaction_ctx: Record<string, unknown> }[] = [];

    for (let i = 0; i < body.screens.length; i++) {
      const s = body.screens[i];
      const path = `${storageBase}/screen_${i}.json`;
      const { error: upErr } = await admin.storage
        .from("demos")
        .upload(path, JSON.stringify(s.snapshot ?? {}), {
          contentType: "application/json",
          upsert: true,
        });
      if (upErr) throw new Error(`storage upload ${path}: ${upErr.message}`);

      let thumbUrl: string | null = null;
      if (s.thumbnail) {
        const thumbPath = `${storageBase}/thumb_${i}.png`;
        let thumbBody: string | Uint8Array = s.thumbnail;
        if (typeof s.thumbnail === "string" && s.thumbnail.startsWith("data:")) {
          const b64 = s.thumbnail.split(",")[1] ?? "";
          thumbBody = Buffer.from(b64, "base64");
        }
        const { error: tErr } = await admin.storage
          .from("demos")
          .upload(thumbPath, thumbBody, { contentType: "image/png", upsert: true });
        if (!tErr) {
          // Guardamos la RUTA (bucket privado); el reproductor la firma con
          // su sesión para obtener una URL temporal.
          thumbUrl = thumbPath;
        }
      }

      const { data: signed } = await admin.storage.from("demos").createSignedUrl(path, 60 * 60 * 24 * 30);
      uploaded.push({
        snapshot_url: signed?.signedUrl ?? path,
        thumbnail_url: thumbUrl,
        interaction_ctx: s.interaction_ctx ?? {},
      });
    }

    const { data: demoRow, error: demErr } = await admin
      .from("demos")
      .insert({
        id: demoId,
        slug,
        title: body.title,
        description: body.description ?? null,
        target_role: targetRole,
        status,
        created_by: profile.id,
        published_at: status === "publicado" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (demErr) throw new Error(`insert demo: ${demErr.message}`);

    const { error: scrErr } = await admin.from("demo_screens").insert(
      uploaded.map((u, i) => ({
        demo_id: demoId,
        screen_index: i,
        snapshot_url: u.snapshot_url,
        thumbnail_url: u.thumbnail_url,
        interaction_ctx: u.interaction_ctx,
      })),
    );
    if (scrErr) throw new Error(`insert screens: ${scrErr.message}`);

    return NextResponse.json({ ok: true, demo_id: demoRow.id, screens: uploaded.length, status });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Error interno.") },
      { status: 500 },
    );
  }
}
