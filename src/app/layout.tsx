import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://emet.uno";
const SITE_TITLE = "EMET | Sistema operativo para organizaciones";
const SITE_DESCRIPTION =
  "EMET es una plataforma web para organizaciones que centraliza la comunicación, la operación, la gestión del tiempo y la colaboración de los equipos en un solo lugar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  icons: {
    icon: [
      { url: "/logo-emet-isotipo.svg", type: "image/svg+xml" },
      { url: "/logo-emet-icon.png", sizes: "256x256", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "EMET",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo-emet-horizontal.png", width: 1084, height: 364, alt: "EMET" }],
    locale: "es_MX",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/logo-emet-horizontal.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
};

// JSON-LD: descripción estructurada de qué es EMET, independiente de que
// el crawler interprete bien el HTML visual. Apunta directo al motivo de
// rechazo "la portada no explica el propósito de la app".
const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "EMET",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  image: `${SITE_URL}/logo-emet-horizontal.png`,
  author: { "@type": "Person", name: "Samu Chan" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
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
