"use client";
/**
 * PrepTour — panel del admin para gestionar los recorridos (demos).
 * Lista borradores/publicados y permite publicar/despublicar. La captura
 * real se hace con la extensión; este panel es el punto de control.
 */
import { useState } from "react";
import { Badge, Button, Card, EmptyState } from "@/components/os/ui";

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

const ROLE_LABEL: Record<string, string> = {
  todos: "Todos", admin: "Admin", empleado: "Empleados",
  rh: "RH", coordinador: "Coordinadores", departamento: "Departamentos",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

export function PrepTourClient({ initialDemos }: { initialDemos: PrepTourDemo[] }) {
  const [demos, setDemos] = useState<PrepTourDemo[]>(initialDemos);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (demo: PrepTourDemo) => {
    setBusy(demo.id);
    setError(null);
    const next = demo.status === "publicado" ? "borrador" : "publicado";
    const res = await fetch("/api/demos/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demo_id: demo.id, status: next }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo cambiar el estado.");
      return;
    }
    setDemos((prev) =>
      prev.map((d) => (d.id === demo.id ? { ...d, status: next } : d)));
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
              <div className="pr-4">
                <Button
                  variant={d.status === "publicado" ? "subtle" : "primary"}
                  size="sm"
                  disabled={busy === d.id}
                  onClick={() => toggle(d)}
                >
                  {d.status === "publicado" ? "Despublicar" : "Publicar"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
