// Isotipo oficial de EMET — logo aprobado (archivo entregado por Samu),
// no una reinterpretación. Recorte con transparencia real desde el PNG
// original, sin residuo de fondo.
export function EmetMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/logo-emet-icon.png"
      alt="EMET"
      width={size}
      height={size}
      className="inline-block shrink-0 select-none object-contain"
      style={{ width: size, height: size }}
    />
  );
}
