import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/errors";
import { BACKUP_TABLES } from "@/lib/backups/tables";

/**
 * Backups (FASE W8.1) — GET lista los respaldos existentes con URL firmada
 * de descarga; POST genera uno nuevo. Ambos exigen rol admin (la RLS de
 * `backups` ya lo exige, pero se valida aquí también para devolver un
 * error 403 claro en vez de una lista vacía silenciosa).
 */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) } as const;
  const { data: profile } = await supabase
    .from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Requiere rol admin." }, { status: 403 }) } as const;
  }
  return { supabase, profile } as const;
}

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { supabase } = gate;

  const { data: rows, error } = await supabase
    .from("backups")
    .select("id, created_by, created_at, storage_path, size_bytes, tables, row_counts, status, error_message")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    return NextResponse.json({ error: getErrorMessage(error, "No se pudieron listar los respaldos.") }, { status: 500 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = url && key ? createServiceClient(url, key) : null;

  const withUrls = await Promise.all((rows ?? []).map(async (r) => {
    let downloadUrl: string | null = null;
    if (admin && r.status === "completo") {
      const { data: signed } = await admin.storage.from("backups").createSignedUrl(r.storage_path, 60 * 10);
      downloadUrl = signed?.signedUrl ?? null;
    }
    return { ...r, download_url: downloadUrl };
  }));

  return NextResponse.json({ backups: withUrls });
}

export async function POST() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { profile } = gate;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Service role no configurado." }, { status: 500 });
  }
  const admin = createServiceClient(url, key);

  try {
    // Lee todas las tablas del catálogo con el cliente de service role: un
    // respaldo debe capturar TODO, sin quedar recortado por la RLS de cada
    // tabla individual (que está pensada para el uso normal de la app, no
    // para exportación administrativa completa).
    //
    // Paginado explícito con .range(): PostgREST corta cualquier select sin
    // límite en 1000 filas por defecto. Con las ~123 filas de hoy en
    // `attendance` no se nota, pero en unos meses sí — sin esto el
    // respaldo se vería "completo" y en realidad estaría silenciosamente
    // truncado, el peor tipo de bug para algo que existe para poder
    // confiar en él el día que se necesite restaurar.
    const PAGE = 1000;
    const dump: Record<string, unknown[]> = {};
    const rowCounts: Record<string, number> = {};
    for (const table of BACKUP_TABLES) {
      const rows: unknown[] = [];
      let from = 0;
      for (;;) {
        const { data, error } = await admin.from(table).select("*").range(from, from + PAGE - 1);
        if (error) throw new Error(`lectura de ${table}: ${error.message}`);
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      dump[table] = rows;
      rowCounts[table] = rows.length;
    }

    const payload = {
      generated_at: new Date().toISOString(),
      generated_by: profile.id,
      tables: dump,
    };
    const json = JSON.stringify(payload);
    const sizeBytes = new TextEncoder().encode(json).length;

    const backupId = crypto.randomUUID();
    const storagePath = `backups/${backupId}.json`;
    const { error: upErr } = await admin.storage.from("backups").upload(storagePath, json, {
      contentType: "application/json",
      upsert: true,
    });
    if (upErr) throw new Error(`subida a storage: ${upErr.message}`);

    const { data: row, error: insErr } = await admin
      .from("backups")
      .insert({
        id: backupId,
        created_by: profile.id,
        storage_path: storagePath,
        size_bytes: sizeBytes,
        tables: BACKUP_TABLES as unknown as string[],
        row_counts: rowCounts,
        status: "completo",
      })
      .select("id, created_at, storage_path, size_bytes, tables, row_counts, status")
      .single();
    if (insErr) throw new Error(`registro del respaldo: ${insErr.message}`);

    return NextResponse.json({ ok: true, backup: row });
  } catch (err) {
    // Registra el intento fallido para que quede visible en la lista (en
    // vez de desaparecer silenciosamente) — mismo criterio de "nunca
    // ocultar el error real" del resto de la sesión.
    const message = getErrorMessage(err, "No se pudo generar el respaldo.");
    await admin.from("backups").insert({
      created_by: profile.id,
      storage_path: "",
      tables: BACKUP_TABLES as unknown as string[],
      status: "error",
      error_message: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
