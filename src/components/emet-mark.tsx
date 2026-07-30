// Wordmark real de EMET (icono provisto por Samu). Reemplaza el
// placeholder tipogr\u00e1fico de la ronda anterior por la imagen real.
export function EmetMark({ size = 40 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
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
