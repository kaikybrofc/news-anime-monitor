export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <div className="flex flex-col gap-2">
          <p className="font-bold text-[#0f172a]">OmniZap Anime Radar</p>
          <p className="max-w-xs text-xs">
            Monitor de noticias e tendencias anime com inteligência de pipeline.
          </p>
        </div>
        <div className="flex flex-col justify-end gap-2 md:text-right">
          <p>© {currentYear} OmniZap</p>
          <div className="flex gap-4 md:justify-end">
            <a href="#" className="hover:text-[#e11d48]">Privacidade</a>
            <a href="#" className="hover:text-[#e11d48]">Termos</a>
            <a href="#" className="hover:text-[#e11d48]">Contato</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
