import { formatDateTime, formatNumber } from "@/lib/formatters";

export function TrendHero({ windowHours, totals = {}, generatedAt = "" }) {
  return (
    <section className="editorial-hero animate-fade-in trend-hero-shell">
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-5">
          <span className="eyebrow animate-fade-in-up">Radar editorial em tempo real</span>
          <h1 className="animate-fade-in-up delay-100">
            Tendências que estão dominando o ciclo das últimas {windowHours} horas.
          </h1>
          <p className="lead animate-fade-in-up delay-200">
            Uma leitura premium do que realmente ganhou tração: franquias em alta, fontes que puxaram a conversa e notícias com potencial de impacto imediato para fãs de anime.
          </p>
          <div className="badge-row animate-fade-in-up delay-300">
            <span className="trend-badge">Atualizado em {formatDateTime(generatedAt)}</span>
            <span className="trend-badge">Janela: {formatNumber(windowHours)}h</span>
          </div>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4 animate-fade-in-up delay-300">
          <article className="data-card min-h-[11rem] justify-between !p-5">
            <div className="flex flex-col gap-3">
              <span className="data-card-label">Artigos analisados</span>
              <p className="kpi-number !text-4xl">{formatNumber(totals.articles || 0)}</p>
            </div>
            <p className="data-card-note">Base lida nesta janela editorial.</p>
          </article>
          <article className="data-card min-h-[11rem] justify-between !p-5">
            <div className="flex flex-col gap-3">
              <span className="data-card-label">Franquias ativas</span>
              <p className="kpi-number !text-4xl">{formatNumber(totals.franchises || 0)}</p>
            </div>
            <p className="data-card-note">Sinais recorrentes no radar.</p>
          </article>
          <article className="data-card min-h-[11rem] justify-between !p-5">
            <div className="flex flex-col gap-3">
              <span className="data-card-label">Fontes no topo</span>
              <p className="kpi-number !text-4xl">{formatNumber(totals.sources || 0)}</p>
            </div>
            <p className="data-card-note">Cobertura ativa na janela.</p>
          </article>
          <article className="data-card min-h-[11rem] justify-between !p-5">
            <div className="flex flex-col gap-3">
              <span className="data-card-label">Tópicos emergentes</span>
              <p className="kpi-number !text-4xl">{formatNumber(totals.topics || 0)}</p>
            </div>
            <p className="data-card-note">Assuntos que voltaram à conversa.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
