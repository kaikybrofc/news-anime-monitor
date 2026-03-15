import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { fetchMonitor } from "@/lib/api";

export const metadata = {
  title: "OmniZap Anime Radar",
  description:
    "Radar de notícias de anime com cobertura em tempo real, tendências por franquia e inteligência editorial por fonte.",
  alternates: {
    canonical: "/",
  },
};

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
      <section className="info-card">
        <div className="split-card">
          <div className="flex flex-col gap-2">
            <p className="eyebrow">Busca avançada</p>
            <h2>Encontre notícias com um único campo</h2>
            <p className="text-sm text-slate-400">
              Digite o tema e o monitor retorna os melhores resultados por
              relevância e atualização.
            </p>
          </div>
        </div>

        <form action="/noticias" method="get" className="mt-6">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Termo da busca
            </span>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                name="q"
                placeholder="Ex.: one piece, trailer, mappa, crunchyroll..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-rose-500"
              />
              <button type="submit" className="btn btn-primary sm:min-w-40">
                Buscar
              </button>
            </div>
          </label>
        </form>
      </section>

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
