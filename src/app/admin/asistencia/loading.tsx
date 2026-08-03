import { Skel, SkelList } from "@/components/os/ui";
import { DelayedFallback } from "@/components/os/delayed-fallback";

/** Skeleton genérico de lista/tabla — se muestra mientras el server
    component resuelve sus consultas reales. */
export default function Loading() {
  return (
    <DelayedFallback>
    <div className="space-y-5 pb-10">
      <header className="flex items-center justify-between gap-3">
        <Skel className="h-6 w-40" />
        <Skel className="h-9 w-28 rounded-sm" />
      </header>
      <div className="rounded-m bg-card border border-border p-5">
        <SkelList rows={6} avatar />
      </div>
    </div>
    </DelayedFallback>
  );
}
