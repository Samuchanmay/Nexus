import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

    const { userId, subscription } = await req.json();
    if (userId !== user.id) return NextResponse.json({ error: "mismatch" }, { status: 403 });

    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: userId, subscription: JSON.stringify(subscription), updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
