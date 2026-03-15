import Link from "next/link";
import { MainNav } from "@/components/main-nav";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <div className="flex items-center gap-4">
          <Link href="/" className="brand" aria-label="Ir para Home">
            <span className="brand-dot" aria-hidden="true" />
            <span>Anime Radar</span>
          </Link>
        </div>
        <MainNav />
      </div>
    </header>
  );
}
