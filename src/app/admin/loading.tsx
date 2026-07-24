import { Skel, SkelStatCard, SkelList } from "@/components/os/ui";
import { DelayedFallback } from "@/components/os/delayed-fallback";

/** Skeleton de "Hoy" (admin) — se muestra mientras el server component
    junta las consultas reales (actividades, solicitudes, presencia, etc.). */
export default function Loading() {
  return (
    <DelayedFallback>
    <div className="space-y-7 md:space-y-6 pb-10">
      <header className="pt-3 md:pt-2 space-y-2">
        <Skel className="h-3 w-32" />
        <Skel className="h-7 w-56" />
        <Skel className="h-3 w-64" />
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkelStatCard key={i} />)}
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 md:gap-4">
        <div className="rounded-m bg-card border border-border p-5">
          <Skel className="h-3.5 w-28 mb-4" />
          <SkelList rows={4} />
        </div>
        <div className="rounded-m bg-card border border-border p-5">
          <Skel className="h-3.5 w-24 mb-4" />
          <SkelList rows={4} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 md:gap-4">
        <div className="rounded-m bg-card border border-border p-5 space-y-3">
          <Skel className="h-3.5 w-32" />
          <Skel className="h-8 w-24" />
          <Skel className="h-1.5 w-full" />
        </div>
        <div className="rounded-m bg-card border border-border p-5">
          <Skel className="h-3.5 w-24 mb-4" />
          <SkelList rows={3} avatar />
        </div>
      </div>
    </div>
    </DelayedFallback>
  );
}
