import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://if-en-vivo-lret.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "FOCOS — Detección de incendios en tiempo real en España",
  description:
    "Mapa en tiempo real de incendios forestales en España a partir de datos satelitales NASA FIRMS (satélite VIIRS). Detección automática, actualización cada hora, sin listas manuales. No sustituye al 112.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "FOCOS",
    title: "FOCOS — Incendios en tiempo real en España",
    description:
      "Mapa de incendios forestales en España a partir de datos satelitales NASA FIRMS. Detección automática actualizada cada hora.",
    locale: "es_ES",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1024,
        height: 1024,
        alt: "FOCOS — Mapa de incendios forestales en España",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FOCOS — Incendios en tiempo real en España",
    description:
      "Mapa de incendios forestales en España a partir de datos satelitales NASA FIRMS. Detección automática actualizada cada hora.",
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Skip link — accesibilidad teclado */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-orange-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white focus:shadow"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
