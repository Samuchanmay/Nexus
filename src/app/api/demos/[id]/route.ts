import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/errors";

/**
 * CRUD de un demo (recorrido) por id. Solo admin.
 * - GET: demo + pantallas (para vista previa del admin, borradores incluidos).
 * - PUT: actualiza metadatos (title, description, target_role).
 * - DELETE: borra assets privados (demos/<id>/) y públicos (ptour/<slug>/ si
 *   estaba publicado) + las filas de demo_screens y demos.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { data: profile } = await supabase
    .from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Requiere rol admin." }, { status: 403 });
  }

  const admin = serviceClient();
  const { data: demo, error: demErr } = await admin
    .from("demos").select("*").eq("id", id).single();
  if (demErr || !demo) {
    return NextResponse.json({ error: demErr?.message ?? "Demo no encontrada." }, { status: 404 });
  }

  const { data: screens } = await admin
    .from("demo_screens")
    .select("screen_index, snapshot_url, thumbnail_url, interaction_ctx")
    .eq("demo_id", demo.id)
    .order("screen_index");

  return NextResponse.json({ ok: true, demo, screens: screens ?? [] });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { data: profile } = await supabase
    .from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Requiere rol admin." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string; description?: string | null; target_role?: string;
  } | null;
  if (!body || (body.title === undefined && body.description === undefined && body.target_role === undefined)) {
    return NextResponse.json({ error: "Sin campos para actualizar." }, { status: 400 });
  }
  if (body.title !== undefined && typeof body.title !== "string") {
    return NextResponse.json({ error: "title inválido." }, { status: 400 });
  }
  if (body.target_role !== undefined && !["todos", "admin", "empleado", "rh", "coordinador", "departamento"].includes(body.target_role)) {
    return NextResponse.json({ error: "target_role inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = body.title.trim() || null;
  if (body.description !== undefined) patch.description = body.description;
  if (body.target_role !== undefined) patch.target_role = body.target_role;
  if (!patch.title) return NextResponse.json({ error: "El título no puede quedar vacío." }, { status: 400 });

  const admin = serviceClient();
  const { data, error } = await admin
    .from("demos")
    .update(patch)
    .eq("id", id)
    .select("id, title, description, target_role, status")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Demo no encontrada." }, { status: 404 });

  return NextResponse.json({ ok: true, demo: data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { data: profile } = await supabase
    .from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Requiere rol admin." }, { status: 403 });
  }

  const admin = serviceClient();
  const { data: demo, error: demErr } = await admin
    .from("demos").select("id, slug, status").eq("id", id).single();
  if (demErr || !demo) {
    return NextResponse.json({ error: demErr?.message ?? "Demo no encontrada." }, { status: 404 });
  }

  try {
    const { data: screens } = await admin
      .from("demo_screens")
      .select("screen_index")
      .eq("demo_id", demo.id);

    const base = `demos/${demo.id}`;
    const privPaths = (screens ?? []).flatMap((s) => [
      `${base}/screen_${s.screen_index}.json`,
      `${base}/thumb_${s.screen_index}.png`,
    ]);
    await admin.storage.from("demos").remove(privPaths);

    if (demo.status === "publicado") {
      const pubBase = `ptour/${demo.slug}`;
      await admin.storage.from("demos-public").remove(
        (screens ?? []).flatMap((s) => [
          `${pubBase}/screen_${s.screen_index}.json`,
          `${pubBase}/thumb_${s.screen_index}.png`,
        ]),
      );
    }

    await admin.from("demo_screens").delete().eq("demo_id", demo.id);
    await admin.from("demos").delete().eq("id", demo.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err, "Error interno.") }, { status: 500 });
  }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Service role no configurado.");
  }
  return createServiceClient(url, key);
}
