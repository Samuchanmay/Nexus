import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/errors";
import { isBackupTable, primaryKeyOf } from "@/lib/backups/tables";

/**
 * Restaura UNA tabla de UN respaldo (FASE W8.1). Nunca borra: solo hace
 * upsert (insert/update por llave primaria) de las filas que vienen en el
 * JSON del respaldo. Una fila que exista hoy en la tabla y no esté en el
 * respaldo se queda intacta — restaurar un respaldo viejo jamás hace
 * retroceder ni desaparecer datos más nuevos que el propio respaldo no
 * conocía. Por eso el admin puede restaurar con confianza sin arriesgar
 * el trabajo hecho después de la fecha del respaldo.
 *
 * Body: { table: string } — debe estar en el catálogo de BACKUP_TABLES
 * (src/lib/backups/tables.ts) Y en el arreglo `tables` de ese respaldo
 * específico. Nunca se acepta un nombre de tabla fuera de ese catálogo,
 * ni del body ni del contenido del propio JSON — evita que un respaldo
 * corrupto o manipulado pueda escribir en una tabla arbitraria.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Requiere rol admin." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { table?: string } | null;
  const table = body?.table;
  if (!table || !isBackupTable(table)) {
    return NextResponse.json({ error: "Tabla inválida o fuera del catálogo de respaldos." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Service role no configurado." }, { status: 500 });
  }
  const admin = createServiceClient(url, key);

  try {
    const { data: backupRow, error: rowErr } = await admin
      .from("backups").select("id, storage_path, tables, status").eq("id", id).maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!backupRow) return NextResponse.json({ error: "Respaldo no encontrado." }, { status: 404 });
    if (backupRow.status !== "completo") {
      return NextResponse.json({ error: "Este respaldo no terminó correctamente y no se puede restaurar." }, { status: 400 });
    }
    if (!(backupRow.tables as string[]).includes(table)) {
      return NextResponse.json({ error: `Este respaldo no incluye la tabla "${table}".` }, { status: 400 });
    }

    const { data: fileBlob, error: dlErr } = await admin.storage.from("backups").download(backupRow.storage_path);
    if (dlErr) throw new Error(`descarga del respaldo: ${dlErr.message}`);
    const text = await fileBlob.text();
    const parsed = JSON.parse(text) as { tables?: Record<string, unknown[]> };
    const rows = parsed.tables?.[table];
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: `El respaldo no trae filas válidas para "${table}".` }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, table, restored: 0, note: "El respaldo tenía 0 filas para esta tabla — nada que restaurar." });
    }

    const pk = primaryKeyOf(table);
    // Lotes de 500 — evita mandar un solo upsert gigante si la tabla es
    // grande (asistencia puede acumular miles de filas con el tiempo).
    const BATCH = 500;
    let restored = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error: upErr } = await admin.from(table).upsert(batch, { onConflict: pk });
      if (upErr) throw new Error(`upsert en ${table} (lote ${i / BATCH + 1}): ${upErr.message}`);
      restored += batch.length;
    }

    return NextResponse.json({ ok: true, table, restored });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err, "No se pudo restaurar la tabla.") }, { status: 500 });
  }
}
