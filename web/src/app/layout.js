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

export const metadata = {
  title: "OmniZap Anime Radar",
  description:
    "Portal base para notícias, tendências e inteligência do monitor de anime.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <SiteHeader />
        <main className="site-container main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
