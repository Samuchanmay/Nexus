/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cabeceras de seguridad (auditoría MEJORAS-GENERALES.md §1.4) — Emet
  // guarda datos de RH/asistencia, así que estas cabeceras básicas cuestan
  // cero y cierran clases enteras de ataque (clickjacking, sniffing de
  // tipo MIME, filtración de referrer entre orígenes).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};
export default nextConfig;
