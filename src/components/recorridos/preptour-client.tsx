"use client";
/**
 * PrepTour — panel del admin para gestionar los recorridos (demos).
 * Acciones rápidas por estado en el propio listado (menú ⋯): Ver, Vista
 * previa, Editar (metadatos), Duplicar, Publicar/Despublicar, Compartir y
 * Eliminar — sin obligar a entrar al detalle.
 */
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Dialog } from "@/components/os/ui";
import { Menu, MenuItem, useToast } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { SerPlayerFrame } from "@/components/recorridos/ser-player";

export type PrepTourDemo = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "borrador" | "publicado";
  target_role: string;
  created_at: string;
  updated_at: string;
};

type ScreenRow = { index: number; snapshot_url: string; thumbnail_url: string | null; interaction_ctx: Record<string, unknown> };

const ROLE_LABEL: Record<string, string> = {
  todos: "Todos", admin: "Admin", empleado: "Empleados",
  rh: "RH", coordinador: "Coordinadores", departamento: "Departamentos",
};
const ROLE_KEYS = ["todos", "admin", "empleado", "rh", "coordinador", "departamento"];

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

export function PrepTourClient({ initialDemos }: { initialDemos: PrepTourDemo[] }) {
  const [demos, setDemos] = useState<PrepTourDemo[]>(initialDemos);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PrepTourDemo | null>(null);
  const [editing, setEditing] = useState<PrepTourDemo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PrepTourDemo | null>(null);
  const toast = useToast();

  const run = async (fn: () => Promise<boolean>, demoId: string) => {
    setBusy(demoId);
    setError(null);
    try {
      const ok = await fn();
      if (!ok) setError("No se pudo completar la acción.");
      return ok;
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (demo: PrepTourDemo) => {
    const next = demo.status === "publicado" ? "borrador" : "publicado";
    const ok = await run(async () => {
      const res = await fetch("/api/demos/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo_id: demo.id, status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo cambiar el estado.");
        return false;
      }
      return true;
    }, demo.id);
    if (ok) {
      setDemos((prev) => prev.map((d) => (d.id === demo.id ? { ...d, status: next } : d)));
      toast(next === "publicado" ? "Recorrido publicado" : "Recorrido despublicado", "ok");
    }
  };

  const duplicate = async (demo: PrepTourDemo) => {
    const ok = await run(async () => {
      const res = await fetch(`/api/demos/${demo.id}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo duplicar.");
        return false;
      }
      const data = await res.json();
      const copy: PrepTourDemo = {
        id: data.demo_id, slug: data.slug,
        title: `${demo.title} (copia)`, description: demo.description,
        status: "borrador", target_role: demo.target_role,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      setDemos((prev) => [copy, ...prev]);
      return true;
    }, demo.id);
    if (ok) toast("Recorrido duplicado como borrador", "ok");
  };

  const remove = async (demo: PrepTourDemo) => {
    const ok = await run(async () => {
      const res = await fetch(`/api/demos/${demo.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo eliminar.");
        return false;
      }
      return true;
    }, demo.id);
    if (ok) {
      setDemos((prev) => prev.filter((d) => d.id !== demo.id));
      toast("Recorrido eliminado", "ok");
    }
  };

  const share = async (demo: PrepTourDemo) => {
    const url = `${window.location.origin}/r/${demo.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Enlace copiado al portapapeles", "ok");
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-[15px] font-bold text-text-1 mb-2">Cómo crear un recorrido</h2>
        <ol className="text-[13.5px] text-text-2 space-y-1 list-decimal list-inside">
          <li>Abre la extensión Recorridos en Chrome y pulsa «Grabar un nuevo demo».</li>
          <li>Navega por la app: cada paso se guarda como pantalla.</li>
          <li>Detén la grabación; el tour quedará como borrador aquí abajo.</li>
          <li>Pulsa «Publicar» cuando esté listo para que aparezca en el onboarding de los empleados.</li>
        </ol>
      </Card>

      {error && (
        <div className="text-[13.5px] text-white px-3 py-2 rounded-sm" style={{ background: "var(--danger)" }}>
          {error}
        </div>
      )}

      {demos.length === 0 ? (
        <EmptyState
          icon="layers"
          title="Todavía no hay recorridos"
          hint="Graba tu primer demo con la extensión y aparecerá aquí."
        />
      ) : (
        <div className="grid gap-3">
          {demos.map((d) => (
            <Card key={d.id} className="flex items-center gap-4" pad={false}>
              <div className="flex-1 min-w-0 px-5 py-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-1 truncate">{d.title}</span>
                  <Badge tone={d.status === "publicado" ? "ok" : "neutral"}>
                    {d.status === "publicado" ? "Publicado" : "Borrador"}
                  </Badge>
                  <Badge tone="accent">{ROLE_LABEL[d.target_role] ?? d.target_role}</Badge>
                </div>
                {d.description && (
                  <p className="text-[12.5px] text-text-2 mt-1 line-clamp-1">{d.description}</p>
                )}
                <p className="text-[12px] text-text-3 mt-1">
                  {d.slug} · actualizado {fmt(d.updated_at)}
                </p>
              </div>
              <div className="pr-2 flex items-center gap-1">
                {d.status === "borrador" && (
                  <Button
                    variant="primary" size="sm"
                    disabled={busy === d.id}
                    onClick={() => toggle(d)}
                  >
                    Publicar
                  </Button>
                )}
                <Menu
                  trigger={({ onClick, open }) => (
                    <button
                      type="button" onClick={onClick} aria-label="Acciones" aria-expanded={open}
                      className="grid place-items-center w-9 h-9 rounded-full transition-colors hover:bg-hover"
                      style={{ color: "var(--text-2)" }}
                    >
                      <Icon name="more" size={18} />
                    </button>
                  )}
                >
                  {d.status === "publicado" ? (
                    <MenuItem icon={<Icon name="video" size={17} />} href={`/r/${d.slug}`}>
                      Ver
                    </MenuItem>
                  ) : null}
                  <MenuItem icon={<Icon name="search" size={17} />} onClick={() => setPreview(d)}>
                    Vista previa
                  </MenuItem>
                  <MenuItem icon={<Icon name="pencil" size={17} />} onClick={() => setEditing(d)}>
                    Editar
                  </MenuItem>
                  <MenuItem icon={<Icon name="copy" size={17} />} onClick={() => duplicate(d)}>
                    Duplicar
                  </MenuItem>
                  {d.status === "publicado" ? (
                    <MenuItem icon={<Icon name="archive" size={17} />} onClick={() => toggle(d)}>
                      Despublicar
                    </MenuItem>
                  ) : (
                    <MenuItem icon={<Icon name="check" size={17} />} onClick={() => toggle(d)}>
                      Publicar
                    </MenuItem>
                  )}
                  {d.status === "publicado" && (
                    <MenuItem icon={<Icon name="link" size={17} />} onClick={() => share(d)}>
                      Compartir
                    </MenuItem>
                  )}
                  <MenuItem icon={<Icon name="trash" size={17} />} danger onClick={() => setConfirmDelete(d)}>
                    Eliminar
                  </MenuItem>
                </Menu>
              </div>
            </Card>
          ))}
        </div>
      )}

      {preview && (
        <PreviewOverlay demo={preview} onClose={() => setPreview(null)} />
      )}

      {editing && (
        <EditSheet
          demo={editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setDemos((prev) => prev.map((d) => (d.id === next.id ? { ...d, ...next } : d)));
            setEditing(null);
            toast("Cambios guardados", "ok");
          }}
        />
      )}

      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          remove(confirmDelete);
          setConfirmDelete(null);
        }}
        variant="danger"
        title="¿Eliminar este recorrido?"
        description="Se borrarán las pantallas y los archivos publicados. No se puede deshacer."
        confirmLabel="Eliminar"
      />
    </div>
  );
}

/* ── Vista previa: reproduce el recorrido en un overlay ── */
function PreviewOverlay({ demo, onClose }: { demo: PrepTourDemo; onClose: () => void }) {
  const [screens, setScreens] = useState<ScreenRow[] | null>(null);
  const [screenIdx, setScreenIdx] = useState(0);
  const [fail, setFail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/demos/${demo.id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setScreens((data.screens ?? []) as ScreenRow[]);
      } catch {
        if (!cancelled) setFail(true);
      }
    })();
    return () => { cancelled = true; };
  }, [demo.id]);

  const total = screens?.length ?? 0;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 nx-fade" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-m shadow-nx overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-bold text-text-1">{demo.title}</span>
            <Badge tone={demo.status === "publicado" ? "ok" : "neutral"}>
              {demo.status === "publicado" ? "Publicado" : "Borrador"}
            </Badge>
          </div>
          <button className="text-[12.5px] text-text-3 hover:text-text-1 transition-colors" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="px-5 py-4">
          {fail ? (
            <div className="aspect-[16/9] w-full rounded-m grid place-items-center border border-border text-[13.5px] text-text-3">
              No se pudo cargar la vista previa
            </div>
          ) : !screens ? (
            <div className="aspect-[16/9] w-full rounded-m grid place-items-center border border-border text-[12.5px] text-text-3">
              Cargando…
            </div>
          ) : (
            <div className="aspect-[16/9] w-full rounded-m overflow-hidden bg-white border border-border">
              <SerPlayerFrame
                key={`${demo.id}:${total}`}
                screens={screens}
                screenIdx={screenIdx}
                className="w-full h-full"
              />
            </div>
          )}
          {screens && total > 0 && (
            <p className="text-[12px] text-text-3 text-center mt-3">
              Pantalla {screenIdx + 1} de {total}
            </p>
          )}
        </div>

        {screens && total > 0 && (
          <>
            <div className="flex justify-center gap-1.5 pb-3">
              {screens.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-200 ${i === screenIdx ? "w-5 bg-accent" : "w-1.5 bg-text-3 opacity-40"}`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t border-border">
              <Button variant="subtle" size="sm" disabled={screenIdx === 0} onClick={() => setScreenIdx((i) => Math.max(0, i - 1))}>
                Anterior
              </Button>
              <Button variant="primary" size="sm" onClick={() => setScreenIdx((i) => Math.min(total - 1, i + 1))}>
                {screenIdx === total - 1 ? "Fin" : "Siguiente"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Edición de metadatos (título, descripción, rol destino) ── */
function EditSheet({ demo, onClose, onSaved }: {
  demo: PrepTourDemo; onClose: () => void; onSaved: (d: Partial<PrepTourDemo>) => void;
}) {
  const [title, setTitle] = useState(demo.title);
  const [description, setDescription] = useState(demo.description ?? "");
  const [targetRole, setTargetRole] = useState(demo.target_role);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/demos/${demo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, target_role: targetRole }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "No se pudo guardar.");
      return;
    }
    const data = await res.json();
    onSaved({ title: data.demo.title, description: data.demo.description, target_role: data.demo.target_role });
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center px-4 nx-fade" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-m shadow-nx overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <span className="text-[14px] font-bold text-text-1">Editar recorrido</span>
          <button className="text-[12.5px] text-text-3 hover:text-text-1 transition-colors" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {err && <p className="text-[12.5px] text-white px-3 py-1.5 rounded-sm" style={{ background: "var(--danger)" }}>{err}</p>}
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text-2">Título</span>
            <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text-2">Descripción</span>
            <textarea className="field-input resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text-2">Dirigido a</span>
            <select className="field-input" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
              {ROLE_KEYS.map((k) => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="subtle" size="sm" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
