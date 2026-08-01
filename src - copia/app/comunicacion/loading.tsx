import { Skel, SkelList } from "@/components/os/ui";
import { DelayedFallback } from "@/components/os/delayed-fallback";

/** Skeleton de "Hoy" (colaborador) — se muestra mientras el server
    component junta jornada, semana, tareas y asistente. */
export default function Loading() {
  return (
    <DelayedFallback>
    <div className="space-y-5 pb-10">
      <header className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skel className="h-3 w-40" />
          <Skel className="h-7 w-44" />
          <Skel className="h-3 w-56" />
        </div>
        <div className="rounded-m px-4 py-3 bg-surface-2 space-y-2">
          <Skel className="h-2.5 w-20" />
          <Skel className="h-6 w-24" />
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skel key={i} className="h-16 rounded-sm" />
        ))}
      </div>

      <div className="rounded-m bg-card border border-border p-5">
        <Skel className="h-3.5 w-32 mb-4" />
        <SkelList rows={4} />
      </div>
    </div>
    </DelayedFallback>
  );
}
