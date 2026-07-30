import type { MetadataRoute } from "next";

// Publico por diseno (ver middleware.ts: "/sitemap.xml" esta en
// PUBLIC_EXACT_PATHS). Solo lista las rutas realmente publicas - las
// privadas no deben aparecer en un sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://emet.uno";
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
