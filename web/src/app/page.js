import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { fetchMonitor } from "@/lib/api";

export const metadata = {
  title: "Anime Radar | Inteligência em Notícias",
  description:
    "Radar de notícias de anime com cobertura em tempo real, tendências por franquia e inteligência editorial por fonte.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let latestPayload = {
    total: 0,
    items: [],
  };
  let errorMessage = "";

  try {
    latestPayload = await fetchMonitor("/articles", { limit: 8, offset: 0 });
  } catch (error) {
    errorMessage = error.message;
  }

  return (
    <div className="flex flex-col gap-16 md:gap-24">
      {/* Hero Section */}
      <section className="relative py-12 md:py-24 animate-fade-in">
        <div className="absolute top-0 right-0 -z-10 h-96 w-96 rounded-full bg-rose-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 -z-10 h-80 w-80 rounded-full bg-sky-500/5 blur-[100px]" />
        
        <div className="flex flex-col gap-6 max-w-3xl">
          <span className="eyebrow animate-fade-in-up">Sistema de Monitoramento 24/7</span>
          <h1 className="!text-4xl md:!text-7xl font-black !leading-[1.1] tracking-tighter animate-fade-in-up delay-100">
            Inteligência de <span className="text-rose-500">Notícias Anime</span> em tempo real.
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl animate-fade-in-up delay-200">
            Acompanhe lançamentos, trailers e rumores processados por nossa pipeline. 
            Filtros avançados e inteligência por score de relevância.
          </p>
          
          <div className="flex flex-wrap gap-4 pt-4 animate-fade-in-up delay-300">
            <Link href="/noticias" className="btn btn-primary !px-8 !py-4 text-base shadow-xl shadow-rose-500/20">
              Explorar Feed
            </Link>
            <Link href="/tendencias" className="btn btn-secondary !px-8 !py-4 text-base">
              Ver Tendências
            </Link>
          </div>
        </div>
      </section>

      {/* Latest News Section */}
      <section className="flex flex-col gap-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 animate-fade-in">
          <div className="flex flex-col gap-2">
            <h2 className="!text-3xl md:!text-4xl">Últimas do Radar</h2>
            <p className="text-slate-400">Notícias processadas nos últimos minutos.</p>
          </div>
          <Link href="/noticias" className="btn btn-secondary !py-2 !px-6 text-sm w-fit">
            Ver Todas
          </Link>
        </div>

        {errorMessage ? (
          <article className="info-card warning-card animate-fade-in">
            <h3 className="text-rose-400">Falha ao carregar destaque editorial</h3>
            <p>{errorMessage}</p>
          </article>
        ) : null}

        {latestPayload.items?.length ? (
          <div className="article-grid">
            {latestPayload.items.map((article, idx) => (
              <div 
                key={article.id} 
                className="animate-fade-in-up" 
                style={{ animationDelay: `${0.1 * (idx + 1)}s` }}
              >
                <ArticleCard article={article} />
              </div>
            ))}
          </div>
        ) : (
          <article className="info-card animate-fade-in">
            <p className="text-slate-400">Nenhuma notícia encontrada no momento.</p>
          </article>
        )}
      </section>

      {/* Stats Section (Brief Preview) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
        <div className="info-card bg-rose-500/5 border-rose-500/20 flex flex-col gap-4 p-10">
          <h3 className="text-xl font-bold text-rose-400">Cobertura Total</h3>
          <p className="text-5xl font-black text-rose-500 tracking-tighter">{(latestPayload.total / 1000).toFixed(1)}k+</p>
          <p className="text-slate-400">Artigos monitorados na nossa base de dados.</p>
        </div>
        <div className="info-card flex flex-col gap-4 p-10">
          <h3 className="text-xl font-bold text-sky-400">Rede Global</h3>
          <p className="text-5xl font-black text-sky-500 tracking-tighter">24h</p>
          <p className="text-slate-400">Monitoramento contínuo em mais de 20 fontes.</p>
        </div>
      </section>
    </div>
  );
}
