// Wordmark de EMET: la app no ten\u00eda un logo propio (solo el logo de
// CERT, cliente institucional, en public/logo-cert-*.png). Este marcador
// tipogr\u00e1fico cubre la superficie p\u00fablica (landing, login, legal,
// contacto) sin depender de un archivo de imagen que no existe.
export function EmetMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="inline-flex items-center justify-center rounded-2xl font-bold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, var(--accent), #0044CC)",
        color: "#fff",
        fontSize: size * 0.42,
        letterSpacing: "-0.02em",
      }}
      aria-hidden="true"
    >
      E
    </div>
  );
}
