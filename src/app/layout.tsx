import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMET · Sistema operativo para organizaciones",
  description:
    "EMET centraliza la comunicación, la operación, la gestión del tiempo y la colaboración de los equipos en una sola plataforma.",
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
