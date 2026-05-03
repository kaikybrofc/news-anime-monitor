import { Space_Grotesk, Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "700"],
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

function resolveMetadataBase() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://omnizap.xyz");
  } catch {
    return new URL("https://omnizap.xyz");
  }
}

export const metadata = {
  metadataBase: resolveMetadataBase(),
  title: "OmniZap Anime Radar",
  description:
    "Portal base para notícias, tendências e inteligência do monitor de anime.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/icons/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/favicon-48x48.png", type: "image/png", sizes: "48x48" },
      { url: "/icons/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    siteName: "OmniZap Anime Radar",
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/brand/og-image.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://animenew.com.br" crossOrigin="" />
        <link rel="preconnect" href="https://www.animenewsnetwork.com" crossOrigin="" />
      </head>
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <SiteHeader />
        <main className="site-container main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
