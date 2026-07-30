import type { MetadataRoute } from "next";

// Publico por diseno (ver middleware.ts: "/robots.txt" esta en
// PUBLIC_EXACT_PATHS) - Google necesita poder leerlo sin sesion.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/legal/", "/contact"],
        disallow: ["/admin", "/rh", "/coordinador", "/comunicacion", "/chat", "/app", "/onboarding", "/mfa", "/api"],
      },
    ],
    sitemap: "https://emet.uno/sitemap.xml",
  };
}
