import { notFound } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { PublicTour } from "@/components/recorridos/public-tour";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

type ScreenRow = { index: number; snapshot_url: string; thumbnail_url: string | null; interaction_ctx: Record<string, unknown> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const demo = await fetchDemo(slug);
  return {
    title: demo ? `${demo.demo.title} · Recorrido EMET` : "Recorrido no disponible",
    description: demo?.demo.description ?? undefined,
  };
}

async function fetchDemo(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createServiceClient(url, key);
  const { data } = await admin.rpc("get_public_demo", { p_slug: slug });
  if (!data || !data.demo) return null;
  return { demo: data.demo as { title: string; description: string | null }, screens: (data.screens ?? []) as ScreenRow[] };
}

export default async function PublicTourPage({ params }: Props) {
  const { slug } = await params;
  const loaded = await fetchDemo(slug);
  if (!loaded) notFound();

  return (
    <main className="min-h-dvh grid place-items-center p-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-2xl">
        <PublicTour title={loaded.demo.title} description={loaded.demo.description} screens={loaded.screens} slug={slug} />
      </div>
    </main>
  );
}
