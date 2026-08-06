"use client";
// ══════════════════════════════════════════════════════════════════
//  Respaldos — panel de admin (FASE W8.1)
//  ══════════════════════════════════════════════════════════════════
//  Genera respaldos JSON bajo demanda (POST /api/admin/backups) y
//  permite restaurar UNA tabla de UN respaldo a la vez (POST
//  /api/admin/backups/[id]/restore). La restauración es upsert —
//  nunca borra filas nuevas que el respaldo no conocía — pero de
//  todos modos sobrescribe valores de las filas que sí coinciden, así
//  que el flujo exige escribir el nombre exacto de la tabla antes de
//  confirmar (mismo patrón de fricción deliberada que "eliminar
//  cuenta" en otros productos — un solo clic no debe poder sobrescribir
//  datos de producción).
// ══════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/shared";
import { Button } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { useToast } from "@/components/ui";
import { Select } from "@/components/select";
import { getErrorMessage } from "@/lib/errors";
import { TABLE_LABEL, type BackupTable } from "@/lib/backups/tables";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction } from "@/lib/admin-log";

type BackupRow = {
  id: string;
  created_by: string | null;
  created_at: string;
  storage_path: string;
  size_bytes: number;
  tables: string[];
  row_counts: Record<string, number>;
  status: "completo" | "error";
  error_message: string | null;
  download_url: string | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** dd/MM/yyyy HH:mm — mismo estándar de fecha del resto de EMET. */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function BackupsClient({ adminId }: { adminId: string }) {
  const toast = useToast();
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [restoreFor, setRestoreFor] = useState<BackupRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/backups");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setBackups(data.backups ?? []);
    } catch (err) {
      toast(getErrorMessage(err, "No se pudieron cargar los respaldos."), "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      toast("Respaldo generado", "ok");
      logAdminAction(createClient(), adminId, "Generó un respaldo", `${data.backup?.tables?.length ?? 0} tablas`);
      await load();
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo generar el respaldo."), "danger");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Respaldos"
        subtitle="Genera un respaldo de los datos operativos (asistencia, vacaciones, proyectos, catálogos…) y restaura tabla por tabla si algo se pierde. Restaurar nunca borra registros nuevos — solo inserta/actualiza lo que trae el respaldo."
      />

      <div className="mb-4">
        <Button variant="primary" icon="download" onClick={generate} disabled={generating}>
          {generating ? "Generando…" : "Generar respaldo ahora"}
        </Button>
      </div>

      {loading ? (
        <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Cargando…</p>
      ) : backups.length === 0 ? (
        <EmptyState icon={<Icon name="download" size={22} />} title="Sin respaldos todavía" hint="Genera el primero con el botón de arriba." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {backups.map((b) => (
            <div key={b.id} className="card px-5 py-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13.5px] font-bold">{formatDateTime(b.created_at)}</p>
                    <span
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: b.status === "completo" ? "var(--ok-tint)" : "var(--danger-tint)",
                        color: b.status === "completo" ? "var(--ok)" : "var(--danger)",
                      }}
                    >
                      {b.status === "completo" ? "Completo" : "Error"}
                    </span>
                  </div>
                  <p className="text-[12px] mt-1" style={{ color: "var(--text-3)" }}>
                    {b.status === "completo"
                      ? `${b.tables.length} tablas · ${formatSize(b.size_bytes)}`
                      : (b.error_message ?? "El respaldo no terminó correctamente.")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {b.download_url && (
                    <a
                      href={b.download_url}
                      className="text-[12.5px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5"
                      style={{ background: "var(--surface-2)", color: "var(--text-1)" }}
                    >
                      <Icon name="download" size={13} /> Descargar
                    </a>
                  )}
                  {b.status === "completo" && (
                    <Button variant="subtle" size="sm" onClick={() => setRestoreFor(restoreFor?.id === b.id ? null : b)}>
                      Restaurar…
                    </Button>
                  )}
                </div>
              </div>

              {restoreFor?.id === b.id && (
                <RestorePanel
                  backup={b}
                  adminId={adminId}
                  onDone={() => setRestoreFor(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RestorePanel({ backup, adminId, onDone }: { backup: BackupRow; adminId: string; onDone: () => void }) {
  const toast = useToast();
  const [table, setTable] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);

  const options = backup.tables.map((t) => ({
    value: t,
    label: TABLE_LABEL[t as BackupTable] ?? t,
    sublabel: `${backup.row_counts[t] ?? 0} filas en el respaldo`,
  }));

  const canConfirm = table.length > 0 && confirmText.trim() === table;

  const restore = async () => {
    if (!canConfirm) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/admin/backups/${backup.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      toast(`Restaurado: ${data.restored} fila(s) de "${TABLE_LABEL[table as BackupTable] ?? table}"`, "ok");
      logAdminAction(createClient(), adminId, "Restauró tabla desde un respaldo", `${table} — ${data.restored} filas`);
      onDone();
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo restaurar."), "danger");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="mt-3 pt-3 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "var(--warn-tint)" }}>
        <Icon name="alert" size={15} style={{ color: "var(--warn)", flexShrink: 0 }} />
        <p className="text-[12px] font-semibold" style={{ color: "var(--warn)" }}>
          Sobrescribe con los valores del respaldo cualquier fila que coincida por id. No borra filas nuevas.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
        <label className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
          Tabla a restaurar
          <Select
            value={table}
            onChange={(v) => { setTable(v); setConfirmText(""); }}
            options={options}
            placeholder="Elegir tabla…"
            searchable={options.length > 6}
            className="mt-1"
          />
        </label>
        {table && (
          <label className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
            Escribe "{table}" para confirmar
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={table}
              className="mt-1 w-full h-9 px-3 rounded-md text-[13px]"
              style={{ border: "1px solid var(--border)", background: "var(--bg)" }}
            />
          </label>
        )}
        <Button variant="danger" size="sm" disabled={!canConfirm || restoring} onClick={restore}
          style={{ background: "var(--danger)" }}>
          {restoring ? "Restaurando…" : "Restaurar tabla"}
        </Button>
      </div>
    </div>
  );
}
