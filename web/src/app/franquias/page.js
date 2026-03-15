import Link from "next/link";
import { fetchMonitor } from "@/lib/api";

export const metadata = {
  title: "Franquias e Temas | Anime Radar",
  description: "Explore o monitoramento por franquias e temas específicos do mundo anime.",
};

export const dynamic = "force-dynamic";

export default async function FranquiasPage() {
  let franchises = [];
  let errorMessage = "";

  try {
    const payload = await fetchMonitor("/franchises");
    franchises = payload?.items || [];
  } catch (error) {
    errorMessage = error.message;
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-rose-500 rounded-full" />
          <h1 className="!text-4xl">Franquias e Temas</h1>
        </div>
        <p className="lead max-w-2xl text-slate-400">
          Nosso pipeline identifica automaticamente menções a franquias e temas, 
          permitindo uma análise granular do que está em alta.
        </p>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card animate-fade-in">
          <h2 className="text-rose-400">Falha ao carregar franquias</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in-up delay-100">
        {franchises.length ? (
          franchises.map((item, idx) => (
            <Link
              key={item.slug}
              href={`/franquias/${item.slug}`}
              className="info-card !p-4 group hover:border-rose-500/30 transition-all hover:-translate-y-1"
              style={{ animationDelay: `${0.03 * idx}s` }}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-rose-500 transition-colors">#{idx + 1}</span>
                  <div className="trend-badge !text-[9px]">Ativo</div>
                </div>
                <h2 className="text-lg font-bold text-slate-100 group-hover:text-rose-400 transition-colors truncate">
                  {item.name}
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                   Ver notícias →
                </div>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-slate-500 col-span-full py-12 text-center border border-dashed border-slate-800 rounded-2xl">
            Nenhuma franquia detectada pelo monitor.
          </p>
        )}
      </div>
    </div>
  );
}
