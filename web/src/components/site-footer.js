import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShieldHalved,
  faFileContract,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <div className="flex max-w-md flex-col gap-3">
          <span className="page-kicker">Anime Radar</span>
          <p className="text-2xl font-semibold tracking-tight text-[var(--title)]" style={{ fontFamily: "var(--font-heading), ui-serif, Georgia, serif" }}>
            Inteligência editorial para navegar o fluxo de notícias do universo anime.
          </p>
          <p className="text-sm">
            Um portal construído para transformar cobertura dispersa em leitura priorizada, contexto acionável e descoberta contínua.
          </p>
        </div>

        <div className="flex flex-col gap-6 md:items-end md:text-right">
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-semibold text-[var(--title)]">OmniZap Anime Radar</p>
            <p>© {currentYear} OmniZap. Todos os direitos reservados.</p>
          </div>

          <div className="flex flex-wrap gap-3 md:justify-end">
            <Link href="/privacidade" className="btn btn-secondary !px-5 !py-2 text-xs">
              <FontAwesomeIcon icon={faShieldHalved} className="mr-2" />
              Privacidade
            </Link>
            <Link href="/termos" className="btn btn-secondary !px-5 !py-2 text-xs">
              <FontAwesomeIcon icon={faFileContract} className="mr-2" />
              Termos
            </Link>
            <Link href="/contato" className="btn btn-primary !px-5 !py-2 text-xs">
              <FontAwesomeIcon icon={faEnvelope} className="mr-2" />
              Contato
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
