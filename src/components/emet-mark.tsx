// Isotipo real de EMET: SVG vectorial puro (no un recorte de imagen).
// Tres trazos que convergen en un punto central, en el gradiente morado
// del brand book. Al ser SVG escala sin pixelarse y no arrastra ningun
// residuo de fondo, a diferencia del PNG recortado que usaba esta ronda
// anterior.
export function EmetMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/logo-emet-isotipo.svg"
      alt="EMET"
      width={size}
      height={size}
      className="inline-block shrink-0 select-none object-contain"
      style={{ width: size, height: size }}
    />
  );
}
