import { Space_Grotesk, Fraunces } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "700"],
});

const bodyFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "OmniZap Anime Radar",
  description:
    "Portal base para noticias, tendencias e inteligencia do monitor de anime.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <div className="page-glow" aria-hidden="true" />
        <SiteHeader />
        <main className="container main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
