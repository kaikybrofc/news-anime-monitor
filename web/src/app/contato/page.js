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
    <div className="mx-auto flex max-w-4xl flex-col gap-10 animate-fade-in">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-rose-500" />
          <h1 className="!text-4xl md:!text-5xl">Contato</h1>
        </div>
        <p className="lead text-slate-300">
          Use os canais abaixo para suporte, sugestões e melhoria contínua do projeto.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="info-card flex flex-col gap-4">
          <h2 className="text-xl font-bold text-slate-100">Suporte técnico</h2>
          <p className="text-sm text-slate-400">
            Para erros, falhas de rota, inconsistências de dados ou regressões, abra uma issue com passos de reprodução.
          </p>
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary w-fit"
          >
            Abrir issue no GitHub
          </a>
        </article>

        <article className="info-card flex flex-col gap-4">
          <h2 className="text-xl font-bold text-slate-100">Projeto e código</h2>
          <p className="text-sm text-slate-400">
            Consulte o repositório para acompanhar mudanças, roadmap e histórico de commits.
          </p>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary w-fit"
          >
            Ver repositório
          </a>
        </article>
      </section>

      <section className="info-card flex flex-col gap-4">
        <h2 className="text-xl font-bold text-slate-100">Antes de abrir contato</h2>
        <p className="text-sm text-slate-400">
          Se a dúvida for sobre consumo de dados, visite a documentação da API para ver endpoints, filtros e exemplos.
        </p>
        <div>
          <Link href="/api" className="btn btn-primary w-fit">
            Ir para documentação da API
          </Link>
        </div>
      </section>
    </div>
  );
}
