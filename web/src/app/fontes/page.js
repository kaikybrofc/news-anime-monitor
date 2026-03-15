import Link from "next/link";
import { fetchMonitor } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";

export const metadata = {
  title: "Fontes Monitoradas | Anime Radar",
  description: "Lista de portais e fontes agregadas pelo monitor em tempo real.",
};

export const dynamic = "force-dynamic";

export default async function FontesPage() {
  let sources = [];
  let errorMessage = "";

  try {
    const payload = await fetchMonitor("/sources");
    sources = payload?.items || [];
  } catch (error) {
    errorMessage = error.message;
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-rose-500 rounded-full" />
          <h1 className="!text-4xl">Fontes Monitoradas</h1>
        </div>
        <p className="lead max-w-2xl">
          Nossa pipeline consome dados de diversos portais, blogs e redes sociais oficiais 
          para garantir que você nunca perca uma atualização.
        </p>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card animate-fade-in">
          <h2 className="text-rose-400">Falha ao carregar fontes</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sources.length ? (
          sources.map((source, idx) => (
            <Link
              key={source.id}
              href={`/fontes/${source.id}`}
              className="info-card group animate-fade-in-up flex flex-col justify-between"
              style={{ animationDelay: `${0.05 * idx}s` }}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">{source.type || "RSS/Web"}</span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                <h2 className="text-xl font-bold text-slate-100 group-hover:text-rose-400 transition-colors">
                  {source.name}
                </h2>
                <p className="text-sm text-slate-500 line-clamp-2">
                  {source.description || "Fonte oficial de notícias e atualizações do ecossistema anime."}
                </p>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-medium text-slate-400">
                <span>ID: {source.id}</span>
                <span className="text-slate-500 group-hover:text-rose-500 transition-colors">Explorar Artigos →</span>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-slate-500 animate-fade-in">Nenhuma fonte cadastrada no momento.</p>
        )}
      </div>
    </div>
  );
}
