import Link from "next/link";

/* 404 con la identidad visual de Nexus — antes se veía la página cruda de
   Next.js (fondo negro plano, tipografía default), rompiendo el Design
   System en cuanto alguien llegaba a un enlace roto o viejo. */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="text-center max-w-[360px]">
        <p className="text-[56px] font-bold tracking-tight" style={{ color: "var(--text-1)" }}>404</p>
        <p className="text-[16px] font-bold mt-1" style={{ color: "var(--text-1)" }}>No encontramos esta página</p>
        <p className="text-[13.5px] mt-2" style={{ color: "var(--text-2)" }}>
          El enlace puede estar roto o ya no existir. Regresa al inicio para continuar.
        </p>
        <Link href="/"
          className="inline-flex items-center justify-center h-10 px-5 mt-6 rounded-sm text-[14px] font-semibold text-white hover:brightness-110 shadow-sm transition-all duration-150"
          style={{ background: "var(--accent)" }}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
