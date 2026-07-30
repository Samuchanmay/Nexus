import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://emet.uno";
const SITE_TITLE = "EMET \u00b7 Sistema operativo para organizaciones";
const SITE_DESCRIPTION =
  "EMET centraliza la comunicaci\u00f3n, la operaci\u00f3n, la gesti\u00f3n del tiempo y la colaboraci\u00f3n de los equipos en una sola plataforma.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: { icon: "/logo-emet-icon.png" },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "EMET",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo-emet-horizontal.png", width: 542, height: 132, alt: "EMET" }],
    locale: "es_MX",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/logo-emet-horizontal.png"],
  },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('nexus-theme');
            if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches))
              document.documentElement.setAttribute('data-theme','dark');
          } catch {}
        `}} />
        {children}
      </body>
    </html>
  );
}
