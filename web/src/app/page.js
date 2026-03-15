import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { fetchMonitor } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";

const highlights = [
  "Agregacao de multiplas fontes com filtros por origem.",
  "Pipeline com dedupe, score e historico de aparicao.",
  "Pronto para portal editorial e API publica.",
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let latestPayload = {
    total: 0,
    items: [],
  };
  let errorMessage = "";

  try {
    latestPayload = await fetchMonitor("/articles", { limit: 4, offset: 0 });
  } catch (error) {
    errorMessage = error.message;
  }

  return (
    <section className="stack">
      <div className="hero-card">
        <p className="eyebrow">OmniZap Anime Radar</p>
        <h1>Noticias e inteligencia anime em uma unica camada.</h1>
        <p>
          Este frontend e a base do portal: navegacao pronta, layout responsivo e
          estrutura para evoluir paginas editoriais e tecnicas.
        </p>
        <div className="hero-actions">
          <Link href="/noticias" className="btn btn-primary">
            Ver noticias
          </Link>
          <Link href="/api" className="btn btn-secondary">
            Explorar API
          </Link>
        </div>
      </div>

      <article className="info-card split-card">
        <div>
          <h2>Cobertura monitorada</h2>
          <p className="kpi-number">{formatNumber(latestPayload.total || 0)}</p>
        </div>
        <div className="meta-stack">
          <p>Noticias processadas no storage principal</p>
          <p>Atualizacao continua por fonte</p>
        </div>
      </article>

      <div className="grid-cards">
        {highlights.map((item) => (
          <article key={item} className="info-card">
            <p>{item}</p>
          </article>
        ))}
      </div>

      <section className="stack">
        <div className="split-card">
          <h2>Ultimas noticias</h2>
          <Link href="/noticias" className="inline-link">
            Ver lista completa
          </Link>
        </div>

        {errorMessage ? (
          <article className="info-card warning-card">
            <h3>Falha ao carregar destaque editorial</h3>
            <p>{errorMessage}</p>
          </article>
        ) : null}

        {latestPayload.items?.length ? (
          <div className="article-grid">
            {latestPayload.items.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <article className="info-card">
            <p>Nenhuma noticia encontrada no momento.</p>
          </article>
        )}
      </section>
    </section>
  );
}
