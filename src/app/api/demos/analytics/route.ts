import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Actividad de los recorridos (demos): stats por demo y actividad reciente.
 * Solo admin. Lee demo_views (RLS permite solo insert; la lectura va por
 * service role) y agrega abiertas/clics/completadas, espectadores únicos,
 * tasa de completación y la actividad más reciente con nombre de usuario.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { data: profile } = await supabase
    .from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Requiere rol admin." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Service role no configurado." }, { status: 500 });
  }
  const admin = createServiceClient(url, key);

  const { data: demos, error: demErr } = await admin
    .from("demos")
    .select("id, slug, title, status, created_at")
    .order("created_at", { ascending: false });
  if (demErr) return NextResponse.json({ error: demErr.message }, { status: 400 });

  const { data: views, error: viewErr } = await admin
    .from("demo_views")
    .select("demo_id, user_id, event, created_at, users:user_id(full_name, display_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (viewErr) return NextResponse.json({ error: viewErr.message }, { status: 400 });

  type ViewRow = {
    demo_id: string;
    user_id: string | null;
    event: string;
    created_at: string;
    users: { full_name: string; display_name: string } | { full_name: string; display_name: string }[] | null;
  };

  const stats = new Map<string, {
    abiertas: number; clics: number; completadas: number;
    viewers: Set<string>; last_at: string | null;
  }>();
  for (const d of demos ?? []) {
    stats.set(d.id, { abiertas: 0, clics: 0, completadas: 0, viewers: new Set(), last_at: null });
  }

  const activity: {
    demo_id: string; demo_title: string; user: string | null; event: string; at: string;
  }[] = [];

  for (const v of (views ?? []) as ViewRow[]) {
    const s = stats.get(v.demo_id);
    if (s) {
      if (v.event === "abierta") s.abiertas += 1;
      else if (v.event === "clic") s.clics += 1;
      else if (v.event === "completada") s.completadas += 1;
      if (v.user_id) s.viewers.add(v.user_id);
      if (!s.last_at || v.created_at > s.last_at) s.last_at = v.created_at;
    }
    const title = (demos ?? []).find((d) => d.id === v.demo_id)?.title ?? "—";
    const u = Array.isArray(v.users) ? v.users[0] : v.users;
    activity.push({
      demo_id: v.demo_id,
      demo_title: title,
      user: u?.full_name ?? u?.display_name ?? null,
      event: v.event,
      at: v.created_at,
    });
  }

  const result = (demos ?? []).map((d) => {
    const s = stats.get(d.id)!;
    return {
      id: d.id,
      slug: d.slug,
      title: d.title,
      status: d.status,
      abiertas: s.abiertas,
      clics: s.clics,
      completadas: s.completadas,
      viewers: s.viewers.size,
      rate: s.abiertas > 0 ? Math.round((s.completadas / s.abiertas) * 100) : null,
      last_at: s.last_at,
    };
  });

  return NextResponse.json({ ok: true, demos: result, activity: activity.slice(0, 50) });
}
