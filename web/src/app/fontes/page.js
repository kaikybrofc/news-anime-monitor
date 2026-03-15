import Link from "next/link";
import { fetchMonitor } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";

const SOURCE_DEFINITIONS = [
  { id: "animenew", name: "AnimeNew" },
  { id: "animecorner", name: "Anime Corner" },
  { id: "animenewsnetwork", name: "Anime News Network" },
];

export const metadata = {
  title: "Fontes | OmniZap Anime Radar",
};

export const dynamic = "force-dynamic";

export default async function FontesPage() {
  let payload = null;
  let errorMessage = "";

  try {
    payload = await fetchMonitor("/trends", { top: 20 });
  } catch (error) {
    errorMessage = error.message;
  }

  const sourceStats = new Map(
    (payload?.topSources || []).map((item) => [String(item.sourceId), item])
  );

  return (
    <section className="stack">
      <h1>Fontes</h1>
      <p className="lead">Visão por origem, cobertura e qualidade da ingestão.</p>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2>Falha ao carregar fontes</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <div className="grid-cards">
        {SOURCE_DEFINITIONS.map((source) => {
          const stats = sourceStats.get(source.id);

          return (
            <Link
              key={source.id}
              className="info-card link-card"
              href={`/fontes/${source.id}`}
            >
              <h2>{source.name}</h2>
              <p>ID: {source.id}</p>
              <p>Artigos: {formatNumber(stats?.count || 0)}</p>
              <p>Score médio: {formatNumber(stats?.avgScore || 0)}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
