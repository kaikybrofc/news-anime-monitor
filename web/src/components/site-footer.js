import Link from "next/link";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <div className="flex flex-col gap-2">
          <p className="font-bold">OmniZap Anime Radar</p>
          <p className="max-w-xs text-xs">
            Monitor de notícias e tendências de anime com inteligência de pipeline.
          </p>
        </div>
        <div className="flex flex-col justify-end gap-2 md:text-right">
          <p>© {currentYear} OmniZap</p>
          <div className="flex gap-4 md:justify-end">
            <Link href="/privacidade" className="hover:text-[#e11d48]">Privacidade</Link>
            <Link href="/termos" className="hover:text-[#e11d48]">Termos</Link>
            <Link href="/contato" className="hover:text-[#e11d48]">Contato</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
