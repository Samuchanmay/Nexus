import { NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Cambia el estado de un demo (borrador <-> publicado). Solo admin.
 * Usado por /preptour para publicar/despublicar recorridos.
 */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Requiere rol admin." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { demo_id?: string; status?: string } | null;
  if (!body?.demo_id || !body.status) {
    return NextResponse.json({ error: "Faltan campos: demo_id, status." }, { status: 400 });
  }
  if (!["borrador", "publicado"].includes(body.status)) {
    return NextResponse.json({ error: "status inválido." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Service role no configurado." }, { status: 500 });
  }
  const admin = createServiceClient(url, key);

  const { data: demo, error: fetchErr } = await admin
    .from("demos").select("id, slug, title, status").eq("id", body.demo_id).single();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  if (!demo) return NextResponse.json({ error: "Demo no encontrada." }, { status: 404 });

  if (body.status === "publicado") {
    await publishToPublic(admin, demo);
  } else {
    await unpublishFromPublic(admin, demo);
  }

  const { data, error } = await admin
    .from("demos")
    .update({
      status: body.status,
      published_at: body.status === "publicado" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.demo_id)
    .select("id, title, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Demo no encontrada." }, { status: 404 });

  return NextResponse.json({ ok: true, demo: data });
}

/**
 * Copia snapshots y miniaturas del bucket privado al público para que el
 * reproductor del onboarding (empleados) pueda verlos sin firmar URLs.
 * Layout público: ptour/<slug>/screen_<i>.json y ptour/<slug>/thumb_<i>.png
 */
async function publishToPublic(
  admin: SupabaseClient,
  demo: { id: string; slug: string },
) {
  const { data: screens, error: scrErr } = await admin
    .from("demo_screens")
    .select("id, screen_index, snapshot_url, thumbnail_url")
    .eq("demo_id", demo.id)
    .order("screen_index");
  if (scrErr) throw new Error(`leer pantallas: ${scrErr.message}`);

  for (const s of screens ?? []) {
    const base = `demos/${demo.id}`;
    const privSnapshot = `${base}/screen_${s.screen_index}.json`;
    const privThumb = `${base}/thumb_${s.screen_index}.png`;

    const pubBase = `ptour/${demo.slug}`;
    const pubSnapshotPath = `${pubBase}/screen_${s.screen_index}.json`;
    const pubThumbPath = `${pubBase}/thumb_${s.screen_index}.png`;

    const { data: blob } = await admin.storage.from("demos").download(privSnapshot);
    if (blob) {
      await admin.storage.from("demos-public").upload(pubSnapshotPath, blob, {
        contentType: "application/json",
        upsert: true,
      });
    }
    const { data: thumbBlob } = await admin.storage.from("demos").download(privThumb);
    if (thumbBlob) {
      await admin.storage.from("demos-public").upload(pubThumbPath, thumbBlob, {
        contentType: "image/png",
        upsert: true,
      });
    }

    const pubSnapshot = admin.storage.from("demos-public").getPublicUrl(pubSnapshotPath).data.publicUrl;
    const pubThumb = admin.storage.from("demos-public").getPublicUrl(pubThumbPath).data.publicUrl;

    await admin
      .from("demo_screens")
      .update({
        snapshot_url: pubSnapshot,
        thumbnail_url: thumbBlob ? pubThumb : s.thumbnail_url,
      })
      .eq("id", s.id);
  }
}

/** Al despublicar se quitan las copias públicas y se vuelven a referenciar
    los archivos privados (miniatura como ruta; snapshot con URL firmada). */
async function unpublishFromPublic(
  admin: SupabaseClient,
  demo: { id: string; slug: string },
) {
  const { data: screens, error: scrErr } = await admin
    .from("demo_screens")
    .select("id, screen_index, snapshot_url, thumbnail_url")
    .eq("demo_id", demo.id)
    .order("screen_index");
  if (scrErr) throw new Error(`leer pantallas: ${scrErr.message}`);

  const pubBase = `ptour/${demo.slug}`;
  await admin.storage.from("demos-public").remove([
    ...(screens ?? []).map((s) => `${pubBase}/screen_${s.screen_index}.json`),
    ...(screens ?? []).map((s) => `${pubBase}/thumb_${s.screen_index}.png`),
  ]);

  for (const s of screens ?? []) {
    const base = `demos/${demo.id}`;
    const privSnapshot = `${base}/screen_${s.screen_index}.json`;
    const privThumb = `${base}/thumb_${s.screen_index}.png`;

    const { data: signed } = await admin.storage.from("demos").createSignedUrl(privSnapshot, 60 * 60 * 24 * 30);
    await admin
      .from("demo_screens")
      .update({
        snapshot_url: signed?.signedUrl ?? s.snapshot_url,
        thumbnail_url: privThumb,
      })
      .eq("id", s.id);
  }
}
