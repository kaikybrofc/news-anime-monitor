import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { TrendEntityCard } from "@/components/trends/trend-entity-card";
import { TrendHero } from "@/components/trends/trend-hero";
import { TrendSpotlightCard } from "@/components/trends/trend-spotlight-card";
import { clampInt, fetchMonitor, readQueryInt } from "@/lib/api";
import { formatDateTime } from "@/lib/formatters";

export const metadata = {
  title: "Tendências | OmniZap Anime Radar",
  description:
    "Painel editorial de tendências com franquias em alta, fontes ativas, tópicos emergentes e notícias representativas com imagem e contexto.",
  alternates: {
    canonical: "/tendencias",
  },
};

export const dynamic = "force-dynamic";

function buildSourceDescription(source) {
  return `Cobertura puxada por ${source.sourceName}, com volume relevante no ciclo atual e uma notícia representativa para leitura rápida.`;
}

function buildFranchiseDescription(franchise) {
  return `Franquia com presença consistente no monitor, score médio competitivo e múltiplas menções recentes.`;
}

function buildTopicDescription(topic) {
  return `Tema emergente observado em diferentes fontes, com recência alta e uma notícia que ajuda a explicar por que voltou à superfície.`;
}

export default async function TendenciasPage({ searchParams }) {
  const top = clampInt(readQueryInt(searchParams, "top", 8), 1, 24, 8);
  const windowHours = clampInt(readQueryInt(searchParams, "windowHours", 72), 1, 24 * 30, 72);

  let payload = null;
  let errorMessage = "";

  try {
    payload = await fetchMonitor("/trends", {
      top,
      windowHours,
      includeEditorial: 1,
    });
  } catch (error) {
    errorMessage = error.message;
  }

  const totals = payload?.totals || {};
  const topFranchises = payload?.topFranchises || [];
  const topTopics = payload?.topTopics || [];
  const topSources = payload?.topSources || [];
  const featuredArticles = payload?.featuredArticles || [];
  const spotlight = topFranchises[0] || null;

  return (
    <div className="page-shell">
      <TrendHero
        windowHours={windowHours}
        totals={totals}
        generatedAt={payload?.generatedAt || new Date().toISOString()}
      />

      {errorMessage ? (
        <article className="info-card warning-card animate-fade-in">
          <h2 className="text-[var(--title)]">Falha ao carregar tendências</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      {spotlight?.representativeArticle ? (
        <TrendSpotlightCard
          franchise={spotlight}
          article={spotlight.representativeArticle}
        />
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3 animate-fade-in-up delay-200">
        <section className="flex flex-col gap-4">
          <div className="section-heading">
            <span className="page-kicker">Franquias</span>
            <h2>Quem realmente puxou a conversa</h2>
            <p className="section-copy">
              Os universos com maior recorrência no ciclo, cruzando volume, score e sinais de continuidade editorial.
            </p>
          </div>
          <div className="trend-card-grid">
            {topFranchises.length ? (
              topFranchises.map((franchise) => (
                <TrendEntityCard
                  key={franchise.slug}
                  eyebrow="Franquia em alta"
                  title={franchise.name}
                  description={buildFranchiseDescription(franchise)}
                  href={`/franquias/${franchise.slug}`}
                  ctaLabel="Abrir franquia"
                  article={franchise.representativeArticle}
                  metrics={[
                    { label: "Menções", value: franchise.mentions },
                    { label: "Fontes", value: franchise.sourceCount },
                    { label: "Score", value: franchise.avgScore },
                  ]}
                />
              ))
            ) : (
              <article className="empty-state">
                <p>Nenhuma franquia em destaque no momento.</p>
              </article>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="section-heading">
            <span className="page-kicker">Assuntos</span>
            <h2>Temas que voltaram à superfície</h2>
            <p className="section-copy">
              Tópicos recorrentes que ganharam espaço nas últimas horas e podem antecipar movimentos maiores do feed.
            </p>
          </div>
          <div className="trend-card-grid">
            {topTopics.length ? (
              topTopics.map((topic) => (
                <TrendEntityCard
                  key={topic.topicKey}
                  eyebrow="Tópico emergente"
                  title={topic.label || topic.topicKey}
                  description={buildTopicDescription(topic)}
                  href={`/noticias?q=${encodeURIComponent(topic.label || topic.topicKey)}`}
                  ctaLabel="Ver notícias do tema"
                  article={topic.representativeArticle}
                  metrics={[
                    { label: "Menções", value: topic.mentions },
                    { label: "Fontes", value: topic.sourceCount },
                    { label: "Score", value: topic.avgScore },
                  ]}
                />
              ))
            ) : (
              <article className="empty-state">
                <p>Nenhum tópico relevante detectado.</p>
              </article>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="section-heading">
            <span className="page-kicker">Fontes</span>
            <h2>Quem mais abasteceu o radar</h2>
            <p className="section-copy">
              Leituras rápidas das fontes mais ativas da janela, com notícia representativa para entender o tipo de pauta em alta.
            </p>
          </div>
          <div className="trend-card-grid">
            {topSources.length ? (
              topSources.map((source) => (
                <TrendEntityCard
                  key={source.sourceId}
                  eyebrow="Fonte em destaque"
                  title={source.sourceName}
                  description={buildSourceDescription(source)}
                  href={`/fontes/${source.sourceId}`}
                  ctaLabel="Abrir fonte"
                  article={source.representativeArticle}
                  metrics={[
                    { label: "Artigos", value: source.count },
                    { label: "Novos", value: source.newCount || 0 },
                    { label: "Score", value: source.avgScore },
                  ]}
                />
              ))
            ) : (
              <article className="empty-state">
                <p>Nenhuma fonte ativa nesta janela.</p>
              </article>
            )}
          </div>
        </section>
      </section>

      <section className="flex flex-col gap-6 animate-fade-in-up delay-300">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="section-heading">
            <span className="page-kicker">Leituras que sustentam o ciclo</span>
            <h2>Notícias representativas por trás das tendências</h2>
            <p className="section-copy">
              Cards editoriais completos para aprofundar rapidamente nos sinais mais fortes desta janela de monitoramento.
            </p>
          </div>
          <div className="meta-stack">
            <span>Atualização: {formatDateTime(payload?.generatedAt || "")}</span>
            <Link href="/noticias" className="inline-link">
              Ver feed completo
            </Link>
          </div>
        </div>

        {featuredArticles.length ? (
          <div className="article-grid">
            {featuredArticles.map((article, idx) => (
              <div key={article.id} className="animate-fade-in-up" style={{ animationDelay: `${0.05 * (idx + 1)}s` }}>
                <ArticleCard article={article} />
              </div>
            ))}
          </div>
        ) : (
          <article className="empty-state">
            <h2 className="mb-2 !text-2xl">Sem notícias representativas no momento</h2>
            <p>Quando o monitor reunir mais sinais úteis, os cards editoriais aparecerão aqui.</p>
          </article>
        )}
      </section>
    </div>
  );
}
