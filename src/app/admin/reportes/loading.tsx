import { Skel } from "@/components/os/ui";
import { DelayedFallback } from "@/components/os/delayed-fallback";

/** Skeleton de Reportes — replica la landing de 4 pestañas (PageHeader +
    toolbar de filtros + pills + tarjetas + tabla) para que el loading no
    anuncie una estructura distinta a la que termina cargando. */
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

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Skel className="h-9 w-[220px] rounded-sm" />
        <Skel className="h-9 w-[150px] rounded-sm" />
        <Skel className="h-9 w-[170px] rounded-sm" />
        <Skel className="h-9 w-[150px] rounded-sm" />
        <Skel className="h-9 w-[130px] rounded-sm" />
        <div className="flex-1" />
        <Skel className="h-9 w-[150px] rounded-sm" />
        <Skel className="h-9 w-[150px] rounded-sm" />
      </div>

      <Skel className="h-10 w-96 rounded-sm mb-4" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Skel className="h-28 rounded-m" />
        <Skel className="h-28 rounded-m" />
        <Skel className="h-28 rounded-m" />
        <Skel className="h-28 rounded-m" />
      </div>

      <Skel className="h-72 rounded-m" />
    </div>
    </DelayedFallback>
  );
}
