import Link from "next/link";
import { fetchMonitor } from "@/lib/api";
import { PageKicker } from "@/components/page-kicker";

function getSourceIconUrl(source = {}) {
  const rawUrl = source.monitorUrl || source.feedUrl || source.url || "";
  if (!rawUrl) return "";

  try {
    const { hostname } = new URL(rawUrl);
    return hostname ? `https://icons.duckduckgo.com/ip3/${hostname}.ico` : "";
  } catch {
    return "";
  }
}

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
    <div className="page-shell">
      <section className="page-intro animate-fade-in">
        <div className="section-heading">
          <PageKicker>Cobertura</PageKicker>
          <h1>Fontes monitoradas pelo radar</h1>
          <p className="lead">
            Um catálogo editorial das origens que alimentam o monitor, com acesso rápido ao histórico e à leitura por fonte.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card animate-fade-in">
          <h2 className="text-[var(--title)]">Falha ao carregar fontes</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sources.length ? (
          sources.map((source, idx) => {
            const iconUrl = getSourceIconUrl(source);

            return (
            <Link
              key={source.id}
              href={`/fontes/${source.id}`}
              className="info-card group animate-fade-in-up flex flex-col justify-between"
              style={{ animationDelay: `${0.05 * idx}s` }}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <PageKicker>{source.type || "RSS/Web"}</PageKicker>
                  <span className="trend-badge">Ativa</span>
                </div>
                <div className="flex items-center gap-3">
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt=""
                      width="22"
                      height="22"
                      loading="lazy"
                      className="h-[22px] w-[22px] rounded-sm border border-[var(--border)] bg-[var(--background-elevated)]"
                    />
                  ) : null}
                  <h2 className="text-xl">{source.name}</h2>
                </div>
                <p className="text-sm text-[var(--muted-foreground)] line-clamp-3">
                  {source.description || "Fonte oficial de notícias e atualizações do ecossistema anime."}
                </p>
              </div>

              <div className="article-footer-actions mt-6">
                <span className="text-[11px] text-[var(--muted)]">ID: {source.id}</span>
                <span className="ml-auto text-[11px] font-semibold text-[var(--title)]">Explorar cobertura →</span>
              </div>
            </Link>
            );
          })
        ) : (
          <article className="empty-state col-span-full animate-fade-in">
            <p>Nenhuma fonte cadastrada no momento.</p>
          </article>
        )}
      </section>
    </div>
  );
}
