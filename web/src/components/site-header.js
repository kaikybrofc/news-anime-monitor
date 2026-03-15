import Link from "next/link";
import { MainNav } from "@/components/main-nav";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <div className="flex items-center gap-4">
          <Link href="/" className="brand" aria-label="Ir para a página inicial">
            <img
              src="/brand/logo-64.png"
              alt="OmniZap Anime Radar"
              className="brand-logo"
              width="28"
              height="28"
            />
            <span>Anime Radar</span>
          </Link>
        </div>
        <MainNav />
      </div>
    </header>
  );
}
