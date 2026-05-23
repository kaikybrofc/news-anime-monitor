import Link from "next/link";

export const metadata = {
  title: "Contato | OmniZap Anime Radar",
  description:
    "Canais de contato para suporte técnico, sugestões e relatos de problemas no OmniZap.",
};

const GITHUB_REPO_URL = "https://github.com/kaikybrofc/news-anime-monitor";
const GITHUB_ISSUES_URL = "https://github.com/kaikybrofc/news-anime-monitor/issues";

export default function ContatoPage() {
  return (
    <div className="page-shell mx-auto max-w-5xl animate-fade-in">
      <section className="page-intro">
        <div className="section-heading">
          <span className="page-kicker">Canal aberto</span>
          <h1>Contato e colaboração</h1>
          <p className="lead">
            Use os canais abaixo para suporte, sugestões de produto, relatos de inconsistência e acompanhamento da evolução pública do projeto.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <article className="info-card flex flex-col gap-4">
          <span className="page-kicker">Suporte técnico</span>
          <h2>Abra uma issue detalhada</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Para erros, falhas de rota, inconsistências de dados ou regressões, registre um relato com passos de reprodução, contexto e impacto observado.
          </p>
          <a href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer" className="btn btn-primary w-fit">
            Abrir issue no GitHub
          </a>
        </article>

        <article className="info-card flex flex-col gap-4">
          <span className="page-kicker">Projeto e código</span>
          <h2>Acompanhe o repositório</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Consulte o repositório para acompanhar mudanças, roadmap, histórico de commits e a evolução da base que sustenta o portal.
          </p>
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="btn btn-secondary w-fit">
            Ver repositório
          </a>
        </article>
      </section>

      <section className="info-card split-card !p-8 md:!p-10">
        <div className="flex max-w-2xl flex-col gap-3">
          <span className="page-kicker">Antes de abrir contato</span>
          <h2 className="!text-3xl">Precisa consumir dados ou validar endpoints?</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Se a dúvida for sobre uso programático, consulte primeiro a documentação da API para ver endpoints, filtros, exemplos e status operacional atual.
          </p>
        </div>
        <div>
          <Link href="/api" className="btn btn-primary w-fit">
            Ir para documentação da API
          </Link>
        </div>
      </section>
    </div>
  );
}
