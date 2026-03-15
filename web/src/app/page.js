import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { fetchMonitor } from "@/lib/api";

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
        <h1>Notícias e inteligência sobre anime em uma única camada.</h1>
        <p>
          Este frontend é a base do portal: navegação pronta, layout responsivo e
          estrutura para evoluir páginas editoriais e técnicas.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/noticias" className="btn btn-primary">
            Ver notícias
          </Link>
          <Link href="/api" className="btn btn-secondary">
            Explorar API
          </Link>
        </div>
      </div>

      <section className="stack">
        <div className="split-card">
          <h2>Últimas notícias</h2>
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
            <p>Nenhuma notícia encontrada no momento.</p>
          </article>
        )}
      </section>
    </section>
  );
}
