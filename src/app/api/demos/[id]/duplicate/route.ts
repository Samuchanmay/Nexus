import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/errors";

/**
 * Duplica un demo (recorrido) manteniendo pantallas y contenido. Solo admin.
 * El clon nace como borrador con slug único (`<slug>-copia[-N]`); los
 * snapshots se copian al bucket privado del nuevo id.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Requiere rol admin." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Service role no configurado." }, { status: 500 });
  }
  const admin = createServiceClient(url, key);

  try {
    const { data: demo, error: demErr } = await admin
      .from("demos").select("id, slug, title, description, target_role").eq("id", id).single();
    if (demErr || !demo) {
      return NextResponse.json({ error: demErr?.message ?? "Demo no encontrada." }, { status: 404 });
    }

    const { data: screens } = await admin
      .from("demo_screens")
      .select("screen_index, snapshot_url, thumbnail_url, interaction_ctx")
      .eq("demo_id", demo.id)
      .order("screen_index");

    // Slug único: `<slug>-copia`, o `-copia-2`, etc.
    const baseSlug = `${demo.slug}-copia`;
    let slug = baseSlug;
    let n = 2;
    while (true) {
      const { data: clash } = await admin.from("demos").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${baseSlug}-${n++}`;
    }

    const newId = crypto.randomUUID();
    const storageBase = `demos/${newId}`;

    const copied: { snapshot_url: string; thumbnail_url: string | null; interaction_ctx: Record<string, unknown> }[] = [];
    for (const s of screens ?? []) {
      const srcPath = `demos/${demo.id}/screen_${s.screen_index}.json`;
      const dstPath = `${storageBase}/screen_${s.screen_index}.json`;
      const { data: blob, error: dlErr } = await admin.storage.from("demos").download(srcPath);
      if (dlErr || !blob) throw new Error(`leer snapshot ${srcPath}`);
      await admin.storage.from("demos").upload(dstPath, blob, {
        contentType: "application/json",
        upsert: true,
      });
      const { data: signed } = await admin.storage.from("demos").createSignedUrl(dstPath, 60 * 60 * 24 * 30);

      let thumbPath: string | null = null;
      if (s.thumbnail_url) {
        const srcThumb = `demos/${demo.id}/thumb_${s.screen_index}.png`;
        const dstThumb = `${storageBase}/thumb_${s.screen_index}.png`;
        const { data: thumbBlob } = await admin.storage.from("demos").download(srcThumb);
        if (thumbBlob) {
          await admin.storage.from("demos").upload(dstThumb, thumbBlob, { contentType: "image/png", upsert: true });
          thumbPath = dstThumb;
        }
      }

      copied.push({
        snapshot_url: signed?.signedUrl ?? dstPath,
        thumbnail_url: thumbPath,
        interaction_ctx: s.interaction_ctx ?? {},
      });
    }

    const { data: newDemo, error: insErr } = await admin
      .from("demos")
      .insert({
        id: newId,
        slug,
        title: `${demo.title} (copia)`,
        description: demo.description,
        target_role: demo.target_role,
        status: "borrador",
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`insert demo: ${insErr.message}`);

    if (copied.length > 0) {
      const { error: scrErr } = await admin.from("demo_screens").insert(
        copied.map((u, i) => ({
          demo_id: newId,
          screen_index: i,
          snapshot_url: u.snapshot_url,
          thumbnail_url: u.thumbnail_url,
          interaction_ctx: u.interaction_ctx,
        })),
      );
      if (scrErr) throw new Error(`insert screens: ${scrErr.message}`);
    }

    return NextResponse.json({ ok: true, demo_id: newDemo.id, slug, screens: copied.length });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err, "Error interno.") }, { status: 500 });
  }
}
