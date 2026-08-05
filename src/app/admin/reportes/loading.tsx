import { Skel } from "@/components/os/ui";
import { DelayedFallback } from "@/components/os/delayed-fallback";

/** Skeleton de Reportes — replica la cuadrícula de tarjetas de la página
    real (PageHeader + grid de KPIs + grid de secciones) para que el
    loading no anuncie una estructura distinta a la que termina cargando. */
export default function Loading() {
  return (
    <DelayedFallback>
    <div className="pb-10">
      <header className="pt-8 pb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Skel className="h-8 w-44" />
          <Skel className="h-4 w-72 mt-2" />
        </div>
        <Skel className="h-9 w-28 rounded-sm" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Skel className="h-44 rounded-m" />
        <Skel className="h-28 rounded-m" />
        <Skel className="h-28 rounded-m" />
        <Skel className="h-28 rounded-m" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Skel className="h-32 rounded-m lg:col-span-2" />
        <Skel className="h-32 rounded-m" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Skel className="h-48 rounded-m" />
        <Skel className="h-48 rounded-m" />
      </div>

      <Skel className="h-44 rounded-m mb-6" />
      <Skel className="h-44 rounded-m mb-6" />
      <Skel className="h-64 rounded-m" />
    </div>
    </DelayedFallback>
  );
}
