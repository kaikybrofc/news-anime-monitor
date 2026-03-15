import Link from "next/link";
import { MainNav } from "@/components/main-nav";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="Ir para Home">
          <span className="brand-dot" aria-hidden="true" />
          OmniZap Anime Radar
        </Link>
        <MainNav />
      </div>
    </header>
  );
}
